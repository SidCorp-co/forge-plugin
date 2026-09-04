/* One process per event. Before a call the first refusal answers; after one every block and every
   context is kept, so a gate later on the line is not silenced by one before it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dirtyRepo, tempRoom } from "../fixtures.mjs";

const GATE = new URL("../../hooks/gate.mjs", import.meta.url).pathname;
const HOME = tempRoom("gate-home-");
/* The in-process cases log too, and never to the developer's own config. */
process.env.XDG_CONFIG_HOME = HOME;
const run = (names, event, env = {}) =>
  spawnSync(process.execPath, [GATE, ...names], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: HOME, ...env },
  });
const out = (held) => (held.stdout.trim() ? JSON.parse(held.stdout) : null);

test("before a call, the first gate to refuse is the answer and the rest are not asked", () => {
  const cwd = dirtyRepo();
  const ev = { tool_name: "Bash", tool_input: { command: "git stash" }, cwd, session_id: "g1" };
  const held = out(run(["bash-guard", "codex-second", "learning-gate", "codex-order", "issue-read-first"], ev));
  assert.equal(held.hookSpecificOutput.permissionDecision, "deny");
  assert.match(held.hookSpecificOutput.permissionDecisionReason, /git stash silently reverts/u);
  assert.match(held.hookSpecificOutput.permissionDecisionReason, /forge hooks --how bash-guard/u, "the refusal names its own gate");
  assert.equal(out(run(["bash-guard"], { ...ev, tool_input: { command: "git stash list" } })), null, "silence is silence");
  /* Two gates with a reason: one answer, the first's, and the second is never asked. */
  const twice = `git stash; sed -i s/a/b/ ${cwd}/.claude/projects/x/memory/note.md`;
  const both = run(["bash-guard", "learning-gate"], { ...ev, tool_input: { command: twice } });
  assert.doesNotThrow(() => JSON.parse(both.stdout), "one JSON answer, not two");
  assert.match(JSON.parse(both.stdout).hookSpecificOutput.permissionDecisionReason, /git stash/u);
});

test("a gate switched off on the line is skipped, and one that is not still answers", () => {
  const cwd = dirtyRepo();
  mkdirIfNeeded(join(HOME, "forge"));
  writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({ hooksOff: ["bash-guard"] }));
  try {
    const ev = { tool_name: "Bash", tool_input: { command: "git stash" }, cwd, session_id: "g2" };
    assert.equal(out(run(["bash-guard", "codex-order"], ev)), null, "the switched-off gate does not refuse");
    writeFileSync(join(HOME, "forge", "config.json"), "{}");
    assert.equal(out(run(["bash-guard"], ev))?.hookSpecificOutput?.permissionDecision, "deny");
  } finally {
    writeFileSync(join(HOME, "forge", "config.json"), "{}");
  }
});

test("after a call, every gate's block and context travel together", () => {
  const room = tempRoom("gate-post-");
  spawnSync("git", ["init", "-q", room]);
  const checker = join(room, "scripts", "check-things.mjs");
  mkdirIfNeeded(join(room, "scripts"));
  writeFileSync(checker, 'const KINDS = ["ALPHA", "BETA", "GAMMA"];\nexport default KINDS;\n');
  mkdirIfNeeded(join(room, "docs"));
  writeFileSync(join(room, "docs", "PLAN.md"), "# plan\n");
  const ev = { tool_name: "Bash", tool_input: { command: "touch scripts/check-things.mjs docs/PLAN.md" }, cwd: room, session_id: `g3-${Date.now()}` };
  const held = out(run(["derive-dont-list", "codex-turn"], ev));
  assert.equal(held.decision, "block", "derive-dont-list blocked");
  assert.match(held.reason, /hard-code 3 constants/u);
  assert.match(held.hookSpecificOutput.additionalContext, /You changed a document this turn/u, "and codex-turn still spoke");
});

function mkdirIfNeeded(dir) {
  spawnSync("mkdir", ["-p", dir]);
}

/* The clock is the event's: a gate late on the line spends what the ones before it left. */
test("the deadline runs from the process start, and the last gate reads what is left", async () => {
  const { DEADLINES, remaining } = await import("../../hooks/_hook.mjs");
  assert.ok(remaining() <= DEADLINES.post && remaining() > DEADLINES.post - 10_000, `remaining ${remaining()} of ${DEADLINES.post}`);
  const text = readFileSync(new URL("../../hooks/gates/code-quality.mjs", import.meta.url), "utf8");
  assert.match(text, /remaining\(\)/u, "code-quality budgets from the shared clock");
  assert.doesNotMatch(text, /BUDGET_MS/u, "and not from a clock of its own");
  for (const gate of ["bash-guard", "codex-second"]) {
    const source = readFileSync(new URL(`../../hooks/gates/${gate}.mjs`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /timeout: \d+,/u, `${gate} spawns nothing on a clock of its own`);
    assert.match(source, /remaining\(\)/u, `${gate} budgets from the shared clock`);
  }
});

test("a gate that crashes is skipped and logged, and the line goes on", () => {
  const room = tempRoom("gate-boom-");
  spawnSync("git", ["init", "-q", room]);
  mkdirIfNeeded(join(room, "docs"));
  writeFileSync(join(room, "docs", "PLAN.md"), "# plan\n");
  const ev = { tool_name: "Write", tool_input: { file_path: join(room, "docs", "PLAN.md") }, cwd: room, session_id: `g4-${Date.now()}` };
  const held = run(["post", "../../test/boom-gate", "codex-turn"], ev);
  assert.match(held.stderr, /boom-gate failed and was skipped: boom/u);
  assert.match(out(held).hookSpecificOutput.additionalContext, /You changed a document/u, "the gate after it still spoke");
  const log = readFileSync(join(HOME, "forge", "hook-log.jsonl"), "utf8").trim().split("\n").map((one) => JSON.parse(one));
  assert.ok(log.some((one) => one.decision === "error" && /boom/u.test(one.reason)), "the crash is a line in the log");
});

test("the clock is the event's kind: before a call it is short, after one it is long", async () => {
  const { DEADLINES, dispatch, remaining } = await import("../../hooks/_hook.mjs");
  assert.ok(DEADLINES.pre < 10_000 && DEADLINES.post < 90_000, "each under what hooks.json registers");
  await dispatch(["pre"], { tool_name: "Bash", tool_input: { command: "true" } });
  assert.ok(remaining() <= DEADLINES.pre, `pre: ${remaining()}`);
  await dispatch(["post"], { tool_name: "Bash", tool_input: { command: "true" } });
  assert.ok(remaining() > DEADLINES.pre, `post: ${remaining()}`);
});

test("out of time before a call refuses it, and after one is a line in the log", async () => {
  const { DEADLINES, dispatch } = await import("../../hooks/_hook.mjs");
  const [pre, post] = [DEADLINES.pre, DEADLINES.post];
  DEADLINES.pre = -1;
  DEADLINES.post = -1;
  try {
    const cwd = dirtyRepo();
    await dispatch(["pre", "bash-guard"], { tool_name: "Bash", tool_input: { command: "git stash list" }, cwd, session_id: "g5" });
    await dispatch(["post", "codex-turn"], { tool_name: "Bash", tool_input: { command: "true" }, cwd, session_id: "g5" });
  } finally {
    DEADLINES.pre = pre;
    DEADLINES.post = post;
  }
  const log = readFileSync(join(HOME, "forge", "hook-log.jsonl"), "utf8").trim().split("\n").map((one) => JSON.parse(one));
  assert.ok(log.some((one) => one.decision === "deny" && /ran out of time before bash-guard could decide/u.test(one.reason)), "a call nobody could judge is refused, not waved through");
  assert.ok(log.some((one) => one.decision === "error" && /codex-turn skipped: the post clock ran out/u.test(one.reason)));
});
