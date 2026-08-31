import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unspentAdvice } from "../hooks/_hook.mjs";
import { lastConsultAt } from "../src/codex-log.mjs";

const HOOK = new URL("../hooks/codex-order.mjs", import.meta.url).pathname;

const userTurn = (text) => ({ type: "user", promptSource: "typed", message: { content: [{ type: "text", text }] } });
const advised = (at = new Date().toISOString()) => ({
  type: "assistant",
  timestamp: at,
  message: { content: [{ type: "advisor_tool_result", content: { type: "advisor_redacted_result" } }] },
});
const said = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });

const room = mkdtempSync(join(tmpdir(), "codex-order-"));
/* An empty consult log, so what the gate reads is the fixture and not this machine's history. */
const env = { ...process.env, XDG_CONFIG_HOME: room };
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
  const run = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(event), encoding: "utf8", env });
  return run.stdout.trim() ? JSON.parse(run.stdout) : null;
};

/* The advisor is not hookable, so the transcript is the only witness that it spoke. */
test("advice holds until a consult spends it", () => {
  const spent = Date.parse("2026-08-31T10:46:15Z");
  assert.ok(unspentAdvice([userTurn("go"), advised("2026-08-31T11:16:49Z")], spent), "newer than the consult");
  assert.ok(!unspentAdvice([userTurn("go"), advised("2026-08-31T10:00:00Z")], spent), "already spent by it");
  assert.ok(unspentAdvice([advised("2026-08-31T09:00:00Z"), userTurn("go")]), "no consult yet: any call counts");
  assert.ok(!unspentAdvice([userTurn("go"), said("ok")], spent), "never called");
  assert.ok(!unspentAdvice([], 0));
});

/* What spends it: a consult that finished, in this checkout. A `started` entry means one launched,
   and the user chose to let an interrupted consult license its own retry. */
test("only a finished consult in this checkout spends the advice", () => {
  const entries = [
    { kind: "started", at: "2026-08-31T11:34:11Z", root: "/here" },
    { kind: "consult", at: "2026-08-31T11:40:00Z", root: "/here", ok: false },
    { kind: "consult", at: "2026-08-31T11:23:37Z", root: "/here", ok: true, reply: "CODEX: 0 findings" },
    { kind: "consult", at: "2026-08-31T12:00:00Z", root: "/elsewhere", ok: true, reply: "x" },
  ];
  assert.equal(lastConsultAt("/here", entries), Date.parse("2026-08-31T11:23:37Z"), "launch and failure do not count");
  assert.equal(lastConsultAt("/nowhere", entries), 0, "another checkout's consult is not this one's");
});

/* Measured here: a prompt closing the window refused a re-run 47 seconds after the advice arrived,
   and the user's habit of typing mid-task made that the common case rather than the edge one. */
test("a prompt after the advice does not refuse the re-run", () => {
  const records = [userTurn("go"), advised("2026-08-31T11:16:49Z"), userTurn("and the hook did not run")];
  assert.ok(unspentAdvice(records, Date.parse("2026-08-31T10:46:15Z")));
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
    env: { ...env, CLAUDE_CODE_DISABLE_ADVISOR_TOOL: "1" },
  });
  assert.equal(run.stdout.trim(), "", "an order nobody can satisfy is not enforced");
});

test("a consult with no unspent advice is refused, with the fix named", () => {
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
    const held = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(event), encoding: "utf8", env });
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
