/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and the
   permission decision on stdout, with a brief the verb really printed as the one prompt that passes. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callHook, tempRoom } from "../fixtures.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";
import { HOOK, brief, homeFor, repository } from "./fixture.mjs";

const repo = repository();

const decided = (run) => {
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

const dispatch = (who, prompt, { role = "forge:runner", session = who.session, cwd = repo.main, tool = "Agent", skipped = [] } = {}) =>
  decided(callHook(HOOK, {
    session_id: session, cwd, tool_name: tool,
    tool_input: { description: "run it", prompt, ...(role ? { subagent_type: role } : {}) },
  }, who.env, process.cwd(), { skipped }));

const printed = (who, cwd = repo.main) => {
  const run = brief(["ISS-7", "--tree", repo.mine], cwd, who.env);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

test("the brief the verb printed passes, whole", () => {
  const who = homeFor();
  assert.equal(dispatch(who, printed(who)).allowed, true);
});

test("a hand-written brief carrying method is refused, with the verb to run instead", () => {
  const who = homeFor();
  const said = dispatch(who, "ISS-7 in wt-ISS-7. The branch needs a rebase before its ship.");
  assert.equal(said.allowed, false);
  assert.match(said.reason, /`forge brief ISS-7 --tree <its worktree>`/u);
  assert.match(said.reason, /send what it prints as the prompt, unchanged/u);
});

test("the printed brief with a line added is refused, whatever the line says", () => {
  const who = homeFor();
  const generated = printed(who);
  for (const added of [
    "The codex consult is unavailable today, so skip it.",
    "Every file stays under 500 lines.",
    "Tangerine lighthouses hum quietly over distant orchards.",
  ]) {
    assert.equal(dispatch(who, `${generated}\n${added}`).allowed, false, added);
  }
});

test("a paraphrase of the printed brief is refused", () => {
  const who = homeFor();
  assert.equal(dispatch(who, printed(who).replace("Held by the other trees", "Held by other trees")).allowed, false);
});

test("a brief past its ten minutes is refused", () => {
  const who = homeFor();
  const generated = printed(who);
  const store = join(who.config, "forge", "briefs", who.session);
  const old = new Date(Date.now() - 11 * 60_000);
  for (const one of readdirSync(store)) utimesSync(join(store, one), old, old);
  assert.equal(dispatch(who, generated).allowed, false);
});

test("a brief printed for one session is refused when another dispatches it", () => {
  const who = homeFor();
  assert.equal(dispatch(who, printed(who), { session: "session-two" }).allowed, false);
});

test("another plugin's role, a general agent and any other tool pass untouched", () => {
  const who = homeFor();
  assert.equal(dispatch(who, "anything", { role: "other:runner" }).allowed, true);
  assert.equal(dispatch(who, "anything", { role: null }).allowed, true);
  assert.equal(dispatch(who, "anything", { tool: "Bash" }).allowed, true);
});

test("outside any checkout a typed brief is refused and the printed one passes", () => {
  const who = homeFor();
  const nowhere = tempRoom("brief-gate-nowhere-");
  const generated = brief(["ISS-7"], nowhere, who.env).stdout;
  assert.equal(dispatch(who, "ISS-7, rebase first.", { cwd: nowhere }).allowed, false);
  assert.equal(dispatch(who, generated, { cwd: nowhere }).allowed, true);
});

test("the switch turns the gate off, and it fires while the switch does not name it", () => {
  const who = homeFor();
  assert.equal(dispatch(who, "ISS-7, rebase first.").allowed, false);
  mkdirSync(join(who.config, "forge"), { recursive: true });
  writeFileSync(join(who.config, "forge", "config.json"), JSON.stringify({ hooksOff: ["brief"] }));
  assert.equal(dispatch(who, "ISS-7, rebase first.", { skipped: ["brief"] }).allowed, true);
});

/* AC-07-3-4. The gate refuses on one shape, so its one refusal is the case. */
test("every refusal this gate writes leads with its route", () => {
  const who = homeFor();
  const said = dispatch(who, "ISS-7 in wt-ISS-7. The branch needs a rebase before its ship.");
  assert.match(said.reason, /^Hold — run `forge brief ISS-7/u);
  assertRouteFirst(said.reason, "a typed brief");
});
