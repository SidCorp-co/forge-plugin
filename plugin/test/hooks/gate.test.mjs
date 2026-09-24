/* One process per event. Before a call the first refusal answers; after one every block and every
   context is kept, so a gate later on the line is not silenced by one before it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { answered, dirtyRepo, pathed, tempRoom } from "../fixtures.mjs";
import { patience } from "../patience.mjs";
import { gateFile } from "../../src/hooks/hook-switch.mjs";

const GATE = new URL("../../hooks/gate.mjs", import.meta.url).pathname;
const REGISTERED = new URL("../../hooks/hooks.json", import.meta.url).pathname;
const HOME = tempRoom("gate-home-");
/* The in-process cases log too, and never to the developer's own config. */
process.env.XDG_CONFIG_HOME = HOME;
const run = (names, event, env = {}) =>
  spawnSync(process.execPath, [GATE, ...names], {
    input: JSON.stringify(event),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: HOME, ...env },
  });

/* The line about where to file a wrong refusal costs a read of the project's key, bounded because a
   reader that hangs must never take a refusal already decided with it (ISS-761). */
test("a refusal near the end of its budget is emitted without the line about filing it", async () => {
  const { FILING_MS, filed } = await import("../../hooks/_hook.mjs");
  const ev = { session_id: `budget-${Date.now()}` };
  assert.equal(await filed("Refused. The rule.", ev, 0), "Refused. The rule.", "nothing is added");
  assert.equal(await filed("Refused. The rule.", ev, FILING_MS - 1), "Refused. The rule.",
    "nor a millisecond under the margin, which is the floor and not the bound");
  /* The margin exactly: `spawnSync` reads a `timeout` of 0 as no timeout, so the one budget that
     leaves the ceiling at nothing is the one that would have spawned unbounded. */
  assert.equal(await filed("Refused. The rule.", ev, FILING_MS), "Refused. The rule.",
    "nor at the margin itself, where the ceiling the read would get is zero");
  const said = await filed("Refused. The rule.", { session_id: `spend-${Date.now()}` }, FILING_MS * 100);
  assert.match(said, /forge feedback <note\.md>/u, "and with the clock to spend, the line arrives");
  assert.match(said, /^Refused\. The rule\./u, "after the refusal and never instead of it");
});

/* The shape ISS-761 was filed for: a `git` wrapper first on PATH that never answers. Nothing on this
   path asks git anything (ISS-1732), so the refusal, its reason and the line about filing all arrive,
   and the whole event still lands inside the read's own ceiling. */
test("a git that never answers costs neither the refusal nor the line about filing", () => {
  const bin = tempRoom("slow-git-");
  /* Twenty times the ceiling and no more: the timeout kills the child that asked, never the wrapper
     it is waiting on, so a longer sleep is a process this suite leaves behind for minutes. */
  writeFileSync(join(bin, "git"), "#!/bin/sh\nexec sleep 30\n", { mode: 0o755 });
  const cwd = dirtyRepo();
  const ev = { tool_name: "Bash", tool_input: { command: `pk${"ill"} -f node` }, cwd, session_id: "stalled" };
  const began = Date.now();
  const held = run(["pre", "bash-guard"], ev, { PATH: `${bin}:${process.env.PATH}`, FORGE_SESSION_ID: "stalled" });
  const took = Date.now() - began;
  const answer = answered(held)?.hookSpecificOutput;
  assert.equal(answer?.permissionDecision, "deny", `the refusal still arrives: ${held.stderr}`);
  assert.match(answer.permissionDecisionReason, /select by name/u, "and it is the rule's own reason");
  assert.match(answer.permissionDecisionReason, /forge feedback/u, "and the route still resolves, no git being asked");
  assert.ok(took < patience(6_000), `costing the read's own ceiling and not the event's clock: ${took}ms`);
});

test("before a call, the first gate to refuse is the answer and the rest are not asked", () => {
  const cwd = dirtyRepo();
  const ev = { tool_name: "Bash", tool_input: { command: "git stash" }, cwd, session_id: "g1" };
  const held = answered(run(["bash-guard", "codex-second", "learning-gate", "issue-read-first"], ev, { FORGE_SESSION_ID: "g1" }));
  assert.equal(held.hookSpecificOutput.permissionDecision, "deny");
  assert.match(held.hookSpecificOutput.permissionDecisionReason, /git stash silently reverts/u);
  assert.match(held.hookSpecificOutput.permissionDecisionReason, /forge hooks --how bash-guard/u, "the refusal names its own gate");
  assert.equal(answered(run(["bash-guard"], { ...ev, tool_input: { command: "git stash list" } })), null, "silence is silence");
  /* Two gates with a reason: one answer, the first's, and the second is never asked. Its own
     session, because what this asks is which gate answered and not what the answer said in full. */
  const twice = `git stash; sed -i s/a/b/ ${pathed(`${cwd}/.claude/projects/x/memory/note.md`)}`;
  const both = run(["bash-guard", "learning-gate"], { ...ev, session_id: "g1-both", tool_input: { command: twice } },
    { FORGE_SESSION_ID: "g1-both" });
  assert.doesNotThrow(() => JSON.parse(both.stdout), "one JSON answer, not two");
  assert.match(JSON.parse(both.stdout).hookSpecificOutput.permissionDecisionReason, /git stash/u);
});

test("a gate switched off on the line is skipped, and one that is not still answers", () => {
  const cwd = dirtyRepo();
  mkdirIfNeeded(join(HOME, "forge"));
  writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({ hooksOff: ["bash-guard"] }));
  try {
    const ev = { tool_name: "Bash", tool_input: { command: "git stash" }, cwd, session_id: "g2" };
    const held = run(["bash-guard", "codex-turn"], ev);
    assert.match(held.stderr, /^forge hooks: bash-guard was skipped: the switch is off$/mu,
      `a gate the switch turned off says so where the caller reads it:\n${held.stderr}`);
    assert.equal(answered(held, { skipped: ["bash-guard"] }), null, "and the switched-off gate refuses nothing");
    writeFileSync(join(HOME, "forge", "config.json"), "{}");
    assert.equal(answered(run(["bash-guard"], ev))?.hookSpecificOutput?.permissionDecision, "deny");
  } finally {
    writeFileSync(join(HOME, "forge", "config.json"), "{}");
  }
});

test("after a call, every gate's block and context travel together", () => {
  const room = tempRoom("gate-post-");
  spawnSync("git", ["init", "-q", room], { cwd: dirname(room) });
  const checker = join(room, "scripts", "check-things.mjs");
  mkdirIfNeeded(join(room, "scripts"));
  writeFileSync(checker, 'const KINDS = ["ALPHA", "BETA", "GAMMA"];\nexport default KINDS;\n');
  mkdirIfNeeded(join(room, "docs"));
  writeFileSync(join(room, "docs", "PLAN.md"), "# plan\n");
  const ev = { tool_name: "Bash", tool_input: { command: "touch scripts/check-things.mjs docs/PLAN.md" }, cwd: room, session_id: `g3-${Date.now()}` };
  const held = answered(run(["derive-dont-list", "codex-turn"], ev));
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
  /* Bracketed and not equated: what the budget has spent is this process's own age at the instant
     `remaining()` read the clock, and reading that age either side of the call holds however long
     the box takes to schedule the three reads. A budget started at this import instead — whole
     cases into the run — would show a spend below the first bracket. */
  const before = Date.now() - performance.timeOrigin;
  const spent = DEADLINES.post - remaining();
  const after = Date.now() - performance.timeOrigin;
  assert.ok(spent >= Math.floor(before) - 1 && spent <= Math.ceil(after) + 1,
    `the budget has spent ${spent}ms of a process ${Math.round(after)}ms old`);
  assert.match(readFileSync(new URL("../../hooks/_hook.mjs", import.meta.url), "utf8"),
    /const startedAt = performance\.timeOrigin;/u, "and the origin it counts from is the process's own");
  const text = readFileSync(gateFile("code-quality"), "utf8");
  assert.match(text, /remaining\(\)/u, "code-quality budgets from the shared clock");
  assert.doesNotMatch(text, /BUDGET_MS/u, "and not from a clock of its own");
  for (const gate of ["bash-guard", "codex-second"]) {
    const source = readFileSync(gateFile(gate), "utf8");
    assert.doesNotMatch(source, /timeout: \d+,/u, `${gate} spawns nothing on a clock of its own`);
    assert.match(source, /remaining\(\)/u, `${gate} budgets from the shared clock`);
  }
});

test("a gate that crashes is skipped and logged, and the line goes on", () => {
  const room = tempRoom("gate-boom-");
  spawnSync("git", ["init", "-q", room], { cwd: dirname(room) });
  mkdirIfNeeded(join(room, "docs"));
  writeFileSync(join(room, "docs", "PLAN.md"), "# plan\n");
  const ev = { tool_name: "Write", tool_input: { file_path: join(room, "docs", "PLAN.md") }, cwd: room, session_id: `g4-${Date.now()}` };
  const held = run(["post", "../../test/boom-gate", "codex-turn"], ev);
  assert.match(held.stderr, /boom-gate failed and was skipped: boom/u);
  const told = answered(held, { skipped: ["../../test/boom-gate"] }).hookSpecificOutput.additionalContext;
  assert.match(told, /You changed a document/u, "the gate after it still spoke");
  assert.match(told, /boom-gate could not judge this call and did not hold it: boom\nThat is a defect in this plugin/u,
    "and the crash reaches the session in the same answer, not on stderr alone");
  const log = readFileSync(join(HOME, "forge", "hook-log.jsonl"), "utf8").trim().split("\n").map((one) => JSON.parse(one));
  assert.ok(log.some((one) => one.decision === "error" && /boom/u.test(one.reason)), "the crash is a line in the log");
});

test("the clock is the event's kind: before a call it is short, after one it is long", async () => {
  const { DEADLINES, dispatch, remaining } = await import("../../hooks/_hook.mjs");
  assert.ok(DEADLINES.pre < 10_000 && DEADLINES.post < 90_000, "each under what hooks.json registers");
  /* Which ceiling is in force, read as the one the spend accounts against: after a pre the spend
     is this process's age out of the short budget, and after a post it is the same age out of the
     long one. Neither reads how long the run has taken to get here. */
  const accounts = (ceiling) => {
    const before = Date.now() - performance.timeOrigin;
    const spent = ceiling - remaining();
    const after = Date.now() - performance.timeOrigin;
    return spent >= Math.floor(before) - 1 && spent <= Math.ceil(after) + 1;
  };
  await dispatch(["pre"], { tool_name: "Bash", tool_input: { command: "true" } });
  assert.ok(accounts(DEADLINES.pre), `pre: ${remaining()} is not counted against ${DEADLINES.pre}`);
  await dispatch(["post"], { tool_name: "Bash", tool_input: { command: "true" } });
  assert.ok(accounts(DEADLINES.post), `post: ${remaining()} is not counted against ${DEADLINES.post}`);
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

/* A gate the clock skipped writes no answer and exits zero, and so does a gate that allowed: one
   value for two meanings, which is what a case reading that silence would assert (ISS-1909). Read
   from a child, because what the rule is about is what a caller holding the result can tell. */
test("a post gate the clock skipped says so where the caller reads it, and leaves the call allowed", () => {
  const harness = new URL("../../hooks/_hook.mjs", import.meta.url).href;
  const probe = `const { DEADLINES, dispatch } = await import(${JSON.stringify(harness)});\n`
    + `DEADLINES.post = -1;\n`
    + `await dispatch(["post", "codex-turn"], { tool_name: "Bash", tool_input: { command: "true" },`
    + ` cwd: process.cwd(), session_id: "clock" });\n`;
  const held = spawnSync(process.execPath, ["--input-type=module", "-e", probe],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: HOME } });
  assert.equal(held.status, 0, held.stderr);
  assert.equal(held.stdout, "", "the call still goes: a gate that did not run refuses nothing");
  assert.match(held.stderr, /^forge hooks: codex-turn was skipped: the post clock ran out before it$/mu,
    `the skip is only in the log, which the caller does not hold:\n${held.stderr}`);
});

/* A refusal before a call refuses the whole command, so a `git add` ahead of the refused part never
   ran: re-sending that part alone finds nothing staged (ISS-329). */
test("a refused compound command says none of it ran, and one command or one pipeline does not", () => {
  const cwd = dirtyRepo();
  const said = (command, id) => answered(run(["bash-guard"], { tool_name: "Bash", tool_input: { command }, cwd, session_id: id },
    { FORGE_SESSION_ID: id }))?.hookSpecificOutput?.permissionDecisionReason ?? "";
  const whole = said("git add a.txt && git stash", `whole-${Date.now()}`);
  assert.match(whole, /^Refused — copy the file aside to undo a probe/u, "the gate's own route still opens the refusal");
  assert.match(whole, /git stash silently reverts/u, "with its reason after it");
  assert.match(whole, /\n\nNothing in this command ran, the parts before the refused one included, so it is re-sent whole\./u);
  assert.match(said("git stash", `one-${Date.now()}`), /git stash silently reverts/u);
  assert.doesNotMatch(said("git stash", `one-${Date.now()}`), /Nothing in this command ran/u, "one command needs no telling");
  for (const trailing of ["git stash;", "git stash\n", "git stash ; "]) {
    const one = said(trailing, `trailing-${Date.now()}`);
    assert.match(one, /git stash silently reverts/u, `${JSON.stringify(trailing)} is still refused`);
    assert.doesNotMatch(one, /Nothing in this command ran/u, `and ${JSON.stringify(trailing)} is one command, its separator opening nothing`);
  }
  const piped = said("git stash | cat", `pipe-${Date.now()}`);
  assert.match(piped, /git stash/u, "a pipeline is still refused");
  assert.doesNotMatch(piped, /Nothing in this command ran/u, "and a pipeline is one command");
});

/* The shown ledger cuts a rule already read to one line; which parts of this call ran is not the rule's text, so it rides on that line. */
test("a refused compound command read again in one line still says none of it ran, on that line", () => {
  const cwd = dirtyRepo();
  const id = `again-${Date.now()}`;
  const said = (command) => answered(run(["bash-guard"], { tool_name: "Bash", tool_input: { command }, cwd, session_id: id },
    { FORGE_SESSION_ID: id }))?.hookSpecificOutput?.permissionDecisionReason ?? "";
  said(`git ${"add"} -A && git commit -m one`);
  const again = said(`git ${"add"} -A && git commit -m two`);
  assert.equal(again.split("\n").length, 1, `a repeat stays one line: ${again}`);
  assert.match(again, /^Refused again.* Nothing in this command ran, the parts before the refused one included, so it is re-sent whole\.$/u);
});

test("a compound command the clock refused says none of it ran", () => {
  const harness = new URL("../../hooks/_hook.mjs", import.meta.url).href;
  const probe = `const { DEADLINES, dispatch } = await import(${JSON.stringify(harness)});\n`
    + `DEADLINES.pre = -1;\n`
    + `await dispatch(["pre", "bash-guard"], { tool_name: "Bash", tool_input: { command: "git add a && git commit -m x" },`
    + ` cwd: process.cwd(), session_id: "clock-whole" });\n`;
  const held = spawnSync(process.execPath, ["--input-type=module", "-e", probe],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: HOME } });
  const reason = JSON.parse(held.stdout).hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /^The hooks ran out of time before bash-guard could decide this call\./u);
  assert.match(reason, /Nothing in this command ran, the parts before the refused one included, so it is re-sent whole\./u);
});

/* The advisor is server-side: nothing fires when it speaks, so a transcript is all a gate could read
   and the carry could only be judged by a word. The line is read off hooks.json rather than listed,
   so a gate added to it is asked this too instead of bringing that reading back unnoticed. */
test("a transcript holding an advisor result stops neither the consult after it nor the write", () => {
  const line = /gate\.mjs pre ([\w\s-]+)"/u.exec(readFileSync(REGISTERED, "utf8"));
  const registered = line[1].trim().split(/\s+/u);
  assert.ok(registered.length >= 4, `the registered line names ${registered.length} gate(s)`);
  const cwd = dirtyRepo();
  const path = join(HOME, "advised.jsonl");
  const records = [
    { type: "user", promptSource: "typed", timestamp: new Date(Date.now() - 60_000).toISOString() },
    {
      type: "assistant",
      timestamp: new Date().toISOString(),
      message: { content: [{ type: "advisor_tool_result", content: { type: "advisor_redacted_result" } }] },
    },
  ];
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  const ev = {
    tool_name: "Bash",
    tool_input: { command: "echo 'my own intent' | forge codex consult a.mjs" },
    transcript_path: path,
    cwd,
    session_id: `advised-${Date.now()}`,
  };
  assert.equal(answered(run(registered, ev)), null, "the consult goes, whatever the advisor said and the intent left out");
  const wrote = { ...ev, tool_input: { command: `printf x > ${pathed(join(cwd, "work.mjs"))}` } };
  assert.equal(answered(run(registered, wrote)), null, "and so does the write after it, with the tree unconsulted");
});

/* A gate that meets `fail()` — the tracker turning its token down — stands down in the answer rather than ending the
   process with an empty stdout, which a session reads as the gate allowing, and the line goes on (ISS-215). */
const REFUSED = "../../test/fixtures/refused-gate";

test("a gate refused through fail() stands down in the answer, and the gate after it still refuses", () => {
  const cwd = dirtyRepo();
  const ev = { tool_name: "Bash", tool_input: { command: "git stash" }, cwd, session_id: `refused-${Date.now()}` };
  const held = run(["pre", REFUSED, "bash-guard"], ev, { FORGE_SESSION_ID: ev.session_id });
  assert.equal(held.status, 0, `the process was not ended by the refusal: ${held.stderr}`);
  const answer = answered(held, { skipped: [REFUSED] }).hookSpecificOutput;
  assert.equal(answer.permissionDecision, "deny", "bash-guard, named after it, still answered");
  assert.match(answer.permissionDecisionReason, /git stash silently reverts/u);
  assert.match(answer.additionalContext, /refused-gate could not judge this call and did not hold it: UNAUTHENTICATED: Forge answered 401/u,
    "and the stand-down travels beside the refusal rather than being dropped by it");
});

test("a stand-down before a call is context the session reads, and grants no permission", () => {
  const ev = { tool_name: "Bash", tool_input: { command: "true" }, cwd: dirtyRepo(), session_id: `alone-${Date.now()}` };
  const answer = answered(run(["pre", REFUSED], ev), { skipped: [REFUSED] });
  assert.equal(answer.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(answer.hookSpecificOutput.permissionDecision, undefined, "the permission flow is left as it was");
  assert.match(answer.hookSpecificOutput.additionalContext, /`forge doctor` checks the endpoint, the token and the project a gate reads/u);
  assert.match(answer.hookSpecificOutput.additionalContext, /`forge doctor --token <pat>`/u);
  assert.match(answer.hookSpecificOutput.additionalContext, /`forge hooks --how stood-down`/u);
  assert.doesNotMatch(answer.hookSpecificOutput.additionalContext, /defect in this plugin/u,
    "a refusal is the tracker's answer, not this plugin's crash");
});

test("a stand-down on a stop event is the answer's warning, that event having no context to carry", () => {
  const ev = { hook_event_name: "Stop", cwd: dirtyRepo(), session_id: `stop-${Date.now()}` };
  const answer = answered(run(["stop", REFUSED], ev), { skipped: [REFUSED] });
  assert.match(answer.systemMessage, /refused-gate could not judge this call/u);
  assert.equal(answer.hookSpecificOutput, undefined, "and no tool event's field is sent on an event that has none");
});
