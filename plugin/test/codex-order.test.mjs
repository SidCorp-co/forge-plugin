import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { advisedSince } from "../hooks/_hook.mjs";

const HOOK = new URL("../hooks/codex-order.mjs", import.meta.url).pathname;

const userTurn = (text) => ({ type: "user", promptSource: "typed", message: { content: [{ type: "text", text }] } });
/* Every shape this repo's own transcripts carry that looks like a prompt and is not one. */
const summary = (text) => ({ type: "user", message: { content: text } });
const interrupted = () => ({ type: "user", message: { content: [{ type: "text", text: "[Request interrupted by user]" }] } });
const injected = (text) => ({ type: "user", isMeta: true, message: { content: [{ type: "text", text }] } });
const midTurn = (text) => ({ type: "queue-operation", message: { content: [{ type: "text", text }] } });
const advised = () => ({
  type: "assistant",
  message: { content: [{ type: "advisor_tool_result", content: { type: "advisor_redacted_result" } }] },
});
const said = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });

const room = mkdtempSync(join(tmpdir(), "codex-order-"));
test.after(() => rmSync(room, { recursive: true, force: true }));

const transcriptOf = (records, name) => {
  const path = join(room, `${name}.jsonl`);
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

let session = 0;
const gate = (command, records, { path } = {}) => {
  session += 1;
  const event = {
    tool_name: "Bash",
    tool_input: { command },
    transcript_path: path ?? transcriptOf(records, `t${session}`),
    session_id: `s${session}`,
  };
  const run = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(event), encoding: "utf8" });
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};

/* The advisor is not hookable, so the transcript is the only witness that it spoke. */
test("advisor calls are counted within the current turn only", () => {
  assert.equal(advisedSince([userTurn("go"), advised(), said("ok")]), 1);
  assert.equal(advisedSince([advised(), userTurn("go"), said("ok")]), 0, "a prior turn's advice is not this turn's");
  assert.equal(advisedSince([userTurn("a"), advised(), userTurn("b"), said("x")]), 0);
  assert.equal(advisedSince([userTurn("go"), advised(), said("x"), advised()]), 2);
  assert.equal(advisedSince([]), 0);
});

/* The compaction case is not hypothetical: it fired here, refusing a consult three minutes after the
   advice arrived, because the summary is written after the advisor call it summarises. */
test("only a real prompt closes the window, so advice is not discarded by one", () => {
  const before = [userTurn("go"), advised()];
  assert.equal(advisedSince([...before, summary("This session is being continued...")]), 1, "compaction");
  assert.equal(advisedSince([...before, interrupted()]), 1, "an interruption marker");
  assert.equal(advisedSince([...before, injected("Base directory for this skill: ...")]), 1, "a skill body");
  assert.equal(advisedSince([...before, midTurn("use stream SSE on api call.")]), 1, "typed mid-turn");
  assert.equal(advisedSince([...before, userTurn("now do something else")]), 0, "a genuine new prompt");
});

test("the gate reads command position, not prose", () => {
  const records = [userTurn("do it"), said("working")];
  const denied = (command) => gate(command, records)?.hookSpecificOutput?.permissionDecision === "deny";
  assert.ok(denied("echo why | forge codex consult a.mjs"), "a pipeline ending in the invocation");
  assert.ok(denied("cd /tmp && plugin/bin/forge codex consult a.mjs"), "after a separator, by path");
  /* A wrapper or construct this gate has never heard of must not open a hole: the runner is
     recognised by the token before `codex`, never by a list of known ones. */
  assert.ok(denied("echo i | timeout 180 node plugin/src/cli.mjs codex consult a.mjs"), "wrapped");
  assert.ok(denied("(forge codex consult a.mjs)"), "a subshell");
  assert.ok(denied("if forge codex consult a.mjs; then echo ok; fi"), "a conditional");
  assert.ok(denied("sudo forge codex consult a.mjs"), "an unforeseen wrapper");
  assert.ok(!denied('git commit -m "docs: run forge codex consult after advisor"'), "a commit message");
  assert.ok(!denied("cat > d.md <<'MD'\necho i | forge codex consult a.mjs\nMD"), "a heredoc body");
});

test("the gate stands down when the advisor tool itself is off", () => {
  const event = {
    tool_name: "Bash",
    tool_input: { command: "forge codex consult a.mjs" },
    transcript_path: transcriptOf([userTurn("do it")], "off"),
    session_id: "off",
  };
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1" },
  });
  assert.equal(run.stdout.trim(), "", "an order nobody can satisfy is not enforced");
});

test("a consult with no advice this turn is refused, with the fix named", () => {
  const held = gate("echo intent | forge codex consult a.mjs", [userTurn("do the thing"), said("working")]);
  assert.equal(held.hookSpecificOutput.permissionDecision, "deny");
  assert.match(held.hookSpecificOutput.permissionDecisionReason, /advisor\(\)/);
});

test("a consult carrying the advisor's points passes", () => {
  const records = [userTurn("do it"), advised(), said("acting on it")];
  assert.equal(gate("echo 'the advisor said X, I did Y' | forge codex consult a.mjs", records), null);
});

/* Whether an intent carries the advice is a judgement, so it is asked once and not enforced. */
test("advice given but not carried in is blocked once, then let through", () => {
  const records = [userTurn("do it"), advised(), said("acting on it")];
  const path = transcriptOf(records, "carry");
  const event = {
    tool_name: "Bash",
    tool_input: { command: "echo 'my own intent' | forge codex consult a.mjs" },
    transcript_path: path,
    /* Unique per run: `askedAlready` stamps live in the temp directory and outlive the process, so
       a fixed id makes the second run of this test see the first run's answer. */
    session_id: `carry-${process.pid}-${Date.now()}`,
  };
  const run = () => {
    const held = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(event), encoding: "utf8" });
    return held.stdout.trim() ? JSON.parse(held.stdout) : null;
  };
  const first = run();
  assert.equal(first.decision, "block");
  assert.match(first.reason, /Do this: add what it said/);
  assert.equal(run(), null, "asked once per session, not on every consult");
});

test("nothing else is gated: another verb, another tool, or no transcript at all", () => {
  const records = [userTurn("do it"), said("working")];
  assert.equal(gate("forge codex log --last 2", records), null);
  assert.equal(gate("forge codex pending", records), null);
  assert.equal(gate("forge codex consult a.mjs", [], { path: join(room, "absent.jsonl") }), null);
  const other = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: "x" } }),
    encoding: "utf8",
  });
  assert.equal(other.stdout.trim(), "");
});
