/* A delegated run keeps its consults under the home inside its scratch while every hook fires in the
   session's environment, so each case hands the hook one home and the run another, and asks which of
   the two the answer came from (ISS-2651). */
import assert from "node:assert/strict";
import test from "node:test";

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, callHook, pathed, projectRecord, tempRoom } from "../../fixtures.mjs";
import { digest } from "../../../src/codex/codex-api.mjs";

const OWED = new URL("../../../hooks/entries/codex/codex-owed.mjs", import.meta.url).pathname;
const COMMIT = new URL("../../../hooks/entries/codex/codex-second.mjs", import.meta.url).pathname;
const TURN = new URL("../../../hooks/entries/codex/codex-turn.mjs", import.meta.url).pathname;

const room = tempRoom("run-home-");
test.after(() => rmSync(room, { recursive: true, force: true }));

const SESSION = join(room, "session");
const PROJECT = { slug: "fixture", codex: { owed: ["gate", "commit"] }, stats: { commands: { gate: "npm run check" } } };
const TEXT = "// the bytes that went up\n";

let count = 0;
/* A checkout carrying the two records a workspace start writes beside its git directory, the scratch
   named in the one form the reader accepts, and the session's home holding the project's keys. */
const runTree = (name, { scratch = true } = {}) => {
  const tree = join(room, name);
  spawnSync("git", ["init", "-q", tree], { cwd: room });
  const root = realpathSync(tree);
  const id = `iss-2651-${String(count += 1).padStart(8, "0")}`;
  const at = join(room, `forge-run-${id}`);
  if (scratch) {
    writeFileSync(join(root, ".git", "forge-run-id"), `${id}\n`);
    writeFileSync(join(root, ".git", "forge-run-scratch"), `${at}\n`);
  }
  projectRecord(root, SESSION, PROJECT);
  writeFileSync(join(root, "work.mjs"), TEXT);
  return { root, home: join(at, "home") };
};

/* One home's record: the path owed and, where given, a consult that read it at these bytes. */
const holding = (home, root, { read = false, open = false } = {}) => {
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex.json"),
    JSON.stringify({ turns: { [root]: { files: ["work.mjs"], at: Date.now() - 90_000 } } }));
  const rows = [];
  if (read) {
    rows.push({ kind: "consult", id: "c1", ok: true, root, at: new Date(Date.now() - 60_000).toISOString(),
      reply: "no blocker found", files: ["work.mjs"],
      sent: [{ rel: "work.mjs", sha: digest(TEXT), chars: TEXT.length, clipped: false }] });
  }
  if (open) {
    rows.push({ kind: "consult", id: "c9", ok: true, root, at: new Date(Date.now() - 30_000).toISOString(),
      files: ["work.mjs"], reply: "- **F1 — New — major:** `work.mjs:1` — x.",
      sent: [{ rel: "work.mjs", sha: digest(TEXT), chars: TEXT.length, clipped: false }] });
  }
  writeFileSync(join(home, "forge", "codex-log.jsonl"), rows.map((one) => `${JSON.stringify(one)}\n`).join(""));
};

const ENV = { ...process.env, HOME: SESSION, XDG_CONFIG_HOME: SESSION };

const asked = (hook, root, command) => {
  spawnSync("git", ["-C", root, "add", "work.mjs"], { cwd: root });
  const run = callHook(hook, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command },
    session_id: `s${count += 1}`, cwd: root }, ENV);
  assert.equal(run.status, 0, run.stderr);
  return answered(run)?.hookSpecificOutput?.permissionDecisionReason ?? null;
};

test("a consult logged under the run's home clears the gate door and the commit, the session's home owing it", () => {
  const { root, home } = runTree("cleared");
  holding(SESSION, root);
  holding(home, root, { read: true });
  assert.equal(asked(OWED, root, "npm run check"), null, "the gate door read the session's record");
  assert.equal(asked(COMMIT, root, "git commit -m x"), null, "the commit read the session's record");
});

test("the run's home is what both doors refuse over, and each refusal names it", () => {
  const { root, home } = runTree("refused");
  holding(SESSION, root, { read: true });
  holding(home, root);
  for (const [hook, command] of [[OWED, "npm run check"], [COMMIT, "git commit -m x"]]) {
    const said = asked(hook, root, command);
    assert.match(said ?? "", /forge codex consult --diff/u, `${command} went through on the session's consult`);
    assert.ok(said.includes(`Read from ${join(home, "forge")}`), `the refusal names another home:\n${said}`);
  }
  holding(home, root, { read: true, open: true });
  for (const [hook, command] of [[OWED, "npm run check"], [COMMIT, "git commit -m x"]]) {
    const said = asked(hook, root, command);
    assert.match(said ?? "", /forge codex verdict --of c9/u, `${command} missed the run's open finding`);
    assert.ok(said.includes(`Read from ${join(home, "forge")}`), `the refusal names another home:\n${said}`);
  }
});

test("a tree recording no scratch is read under the hook's own home, as before", () => {
  const { root, home } = runTree("plain", { scratch: false });
  holding(SESSION, root, { read: true });
  holding(home, root);
  assert.equal(asked(OWED, root, "npm run check"), null, "a tree naming no run read some other home");
  holding(SESSION, root);
  const said = asked(OWED, root, "npm run check");
  assert.ok(said?.includes(`Read from ${join(SESSION, "forge")}`), `the refusal names another home:\n${said}`);
});

test("a document written in a run's tree is owed in the run's record and the session's gains nothing", () => {
  const { root, home } = runTree("recorded");
  rmSync(join(SESSION, "forge", "codex.json"), { force: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  const file = join(root, "docs", "A.md");
  const transcript = join(room, `t-${count}.jsonl`);
  writeFileSync(transcript, `${JSON.stringify({ type: "user", promptSource: "typed", timestamp: new Date().toISOString() })}\n`);
  writeFileSync(file, "// changed\n");
  const run = callHook(TURN, { session_id: `s${count += 1}`, tool_name: "Bash",
    tool_input: { command: `printf x > ${pathed(file)}` }, transcript_path: transcript, cwd: root }, ENV);
  assert.equal(run.status, 0, run.stderr);
  const turns = (at) => {
    try {
      return JSON.parse(readFileSync(join(at, "forge", "codex.json"), "utf8")).turns ?? {};
    } catch {
      return {};
    }
  };
  assert.deepEqual(turns(home)[root]?.files, ["docs/A.md"], "the run's record does not hold the write");
  assert.equal(turns(SESSION)[root], undefined, "the session's record took the run's write");
});
