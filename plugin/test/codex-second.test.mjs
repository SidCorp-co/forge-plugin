import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("../hooks/codex-second.mjs", import.meta.url).pathname;
const room = mkdtempSync(join(tmpdir(), "codex-second-"));
const REPO = join(room, "repo");
mkdirSync(join(REPO, ".git"), { recursive: true });
mkdirSync(join(room, "forge"), { recursive: true });
spawnSync("git", ["init", "-q", REPO]);
test.after(() => rmSync(room, { recursive: true, force: true }));

/* Real clock, because the gate compares a consult's timestamp against a file's mtime. */
const now = Date.now();
const at = (msAgo) => new Date(now - msAgo).toISOString();
const userTurn = () => ({
  type: "user",
  promptSource: "typed",
  timestamp: at(600_000),
  message: { content: [{ type: "text", text: "go" }] },
});
const advised = (msAgo = 1000) => ({
  type: "assistant",
  timestamp: at(msAgo),
  message: { content: [{ type: "advisor_tool_result", content: {} }] },
});

let count = 0;
const gate = (records, { consultAt, clean, staleBy, session, env = {}, writes } = {}) => {
  count += 1;
  const path = join(room, `t${count}.jsonl`);
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  writeFileSync(
    join(room, "forge", "codex-log.jsonl"),
    consultAt
      ? `${JSON.stringify({ kind: "consult", at: consultAt, root: REPO, ok: true, reply: "CODEX: 0 findings" })}\n`
      : "",
  );
  /* Dirt is what makes a review possible, so the fixture's tree is dirty unless a case says not. */
  if (clean) rmSync(join(REPO, "work.mjs"), { force: true });
  else writeFileSync(join(REPO, "work.mjs"), `// ${count}\n`);
  /* Work that predates the consult has been read already, whatever the tree still shows. */
  if (staleBy) utimesSync(join(REPO, "work.mjs"), new Date(now - staleBy), new Date(now - staleBy));
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: writes ?? join(REPO, "next.mjs") },
      transcript_path: path,
      session_id: session ?? `s${count}`,
      cwd: REPO,
    }),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: room, ...env },
  });
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

/* It demanded a review of the sid-growth tree because a memory file under ~/.claude was written:
   the root comes from the session's cwd, and nothing asked where the write was going. */
test("a write outside the tree is not something codex could review", () => {
  const outside = join(room, "elsewhere", "a-fact.md");
  assert.equal(gate([userTurn(), advised()], { writes: outside }), null);
  assert.ok(gate([userTurn(), advised()]), "a write inside it still stops");
});

/* The failure this exists for: the advisor ran, the turn wrote and committed, and the consult that
   was supposed to follow never did — the end-of-turn reminder is context, and it was ignored. */
test("advice with work in the tree and no consult behind it stops the next write", () => {
  const out = gate([userTurn(), advised()]);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.match(because(out), /forge codex consult/);
  assert.match(because(out), /FORGE_CODEX_DISABLE=1/);
});

test("one consult clears the rest of the turn", () => {
  assert.equal(gate([userTurn(), advised(60_000)], { consultAt: at(0) }), null);
  assert.ok(gate([userTurn(), advised()], { consultAt: at(300_000) }), "an older one does not");
});

/* Codex found the rule this changes: the gate now makes one decision per advisor call rather than
   one per write, deliberately — deciding again mid-build refuses the second write and reviews a
   fragment. So a stand-down is remembered and a refusal is not. */
test("work the last consult already covered is not asked for again", () => {
  assert.equal(
    gate([userTurn(), advised()], { consultAt: at(120_000), staleBy: 300_000 }),
    null,
    "dirt older than the consult was in it",
  );
});

test("the stand-down is remembered for the turn; a refusal is not", () => {
  const session = `stamp-${process.pid}-${now}`;
  const advice = advised();
  assert.equal(
    gate([userTurn(), advice], { consultAt: at(120_000), staleBy: 300_000, session }),
    null,
    "stood down, and stamped",
  );
  assert.equal(
    gate([userTurn(), advice], { consultAt: at(120_000), session }),
    null,
    "the write it allowed made new dirt; the decision holds for this advisor call",
  );
  const later = `stamp2-${process.pid}-${now}`;
  assert.ok(gate([userTurn(), advised(500)], { consultAt: at(120_000), session: later }), "refused");
  assert.ok(
    gate([userTurn(), advised(500)], { consultAt: at(120_000), session: later }),
    "and refused again, because a refusal leaves no stamp",
  );
});

test("a clean tree has nothing for codex to read", () => {
  assert.equal(gate([userTurn(), advised()], { clean: true }), null);
});

/* With no first opinion there is nothing to be second to, and the system prompt is what asks for
   the advisor call — a hook repeating that ask was removed for charging a refusal to enforce it. */
test("a turn with no advisor call is not this gate's business", () => {
  assert.equal(gate([userTurn()]), null);
});

test("either disable switch stands it down", () => {
  assert.equal(gate([userTurn(), advised()], { env: { FORGE_CODEX_DISABLE: "1" } }), null);
  assert.equal(gate([userTurn(), advised()], { env: { CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1" } }), null);
});
