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
  if (!run.stdout.trim()) return { allowed: true, taught: "" };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason,
    taught: answer.additionalContext ?? "" };
};

/* The gate teaches: every dispatch goes, and a message the verb did not print is told the brief to send. */
const taught = (said, label = "") => {
  assert.equal(said.allowed, true, `${label}: refused — ${said.reason}`);
  assert.match(said.taught, /forge brief /u, `${label}: went untaught`);
  return said.taught;
};
const untaught = (said, label = "") => {
  assert.equal(said.allowed, true, `${label}: refused — ${said.reason}`);
  assert.equal(said.taught, "", label);
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
  untaught(dispatch(who, printed(who)));
});

test("a hand-written brief carrying method goes, and is taught the verb to run instead", () => {
  const who = homeFor();
  const said = taught(dispatch(who, "ISS-7 in wt-ISS-7. The branch needs a rebase before its ship."));
  assert.match(said, /`forge brief ISS-7 --tree <its worktree>`/u);
  assert.match(said, /send what it prints as the prompt, unchanged/u);
});

test("the printed brief with a line added is taught, whatever the line says", () => {
  const who = homeFor();
  const generated = printed(who);
  for (const added of [
    "The codex consult is unavailable today, so skip it.",
    "Every file stays under 500 lines.",
    "Tangerine lighthouses hum quietly over distant orchards.",
  ]) {
    taught(dispatch(who, `${generated}\n${added}`), added);
  }
});

test("a paraphrase of the printed brief is taught", () => {
  const who = homeFor();
  taught(dispatch(who, printed(who).replace("Held by the other trees", "Held by other trees")));
});

/* A sibling tree's held files are read now and move when it commits; the pin is taken without those
   lines, so a brief printed before a sibling moved still passes after, while the header and every
   other line still pin it (ISS-30). */
test("a sibling tree moving under the printed brief is not taught against (ISS-30)", () => {
  const who = homeFor();
  const generated = printed(who);
  const moved = generated.replace("committed: landed.txt", "committed: landed.txt, more.txt");
  assert.notEqual(moved, generated, "the fixture prints a sibling's committed file, which this moves");
  untaught(dispatch(who, moved));
});

test("a brief past its ten minutes is taught", () => {
  const who = homeFor();
  const generated = printed(who);
  const store = join(who.home, ".cache", "forge", "briefs", who.session);
  const old = new Date(Date.now() - 11 * 60_000);
  for (const one of readdirSync(store)) utimesSync(join(store, one), old, old);
  taught(dispatch(who, generated));
});

test("a brief printed for one session is taught when another dispatches it", () => {
  const who = homeFor();
  taught(dispatch(who, printed(who), { session: "session-two" }));
});

test("the brief passes though the hook reads a different XDG home than the verb wrote (ISS-29)", () => {
  const who = homeFor();
  const generated = printed(who);
  const elsewhere = { ...who, env: { ...who.env, XDG_CONFIG_HOME: join(who.home, "hook-config") } };
  untaught(dispatch(elsewhere, generated));
});

test("another plugin's role, a general agent and any other tool pass untouched", () => {
  const who = homeFor();
  untaught(dispatch(who, "anything", { role: "other:runner" }));
  untaught(dispatch(who, "anything", { role: null }));
  untaught(dispatch(who, "anything", { tool: "Bash" }));
});

test("outside any checkout a typed brief is taught and the printed one passes in silence", () => {
  const who = homeFor();
  const nowhere = tempRoom("brief-gate-nowhere-");
  const generated = brief(["ISS-7"], nowhere, who.env).stdout;
  taught(dispatch(who, "ISS-7, rebase first.", { cwd: nowhere }));
  untaught(dispatch(who, generated, { cwd: nowhere }));
});

test("the switch turns the gate off, and it fires while the switch does not name it", () => {
  const who = homeFor();
  taught(dispatch(who, "ISS-7, rebase first."));
  mkdirSync(join(who.config, "forge"), { recursive: true });
  writeFileSync(join(who.config, "forge", "config.json"), JSON.stringify({ hooksOff: ["brief"] }));
  untaught(dispatch(who, "ISS-7, rebase first.", { skipped: ["brief"] }));
});

/* AC-07-3-4. A teaching opens with its route as a refusal did. */
test("every teaching this gate writes leads with its route", () => {
  const who = homeFor();
  const said = taught(dispatch(who, "ISS-7 in wt-ISS-7. The branch needs a rebase before its ship."));
  assert.match(said, /^Run `forge brief ISS-7/u);
  assertRouteFirst(said, "a typed brief");
});

/* AC-19-3-6. A judge handed a builder's brief worked in its tree, and one handed no address brought up
   a local stack (ISS-3145): the judging role is taught the one form that names the deployment. */
test("a dispatch to the judging role goes untaught only on the judge's form of the brief", () => {
  const who = homeFor();
  const judge = brief(["ISS-7", "--judge", "--url", "https://staging.example.com", "--criteria", "1,2"], repo.main, who.env);
  assert.equal(judge.status, 0, judge.stderr);
  const own = dispatch(who, judge.stdout, { role: "forge:qa" });
  assert.equal(own.allowed, true, own.reason);
  assert.doesNotMatch(own.taught, /^Run /u, "the judge's own brief is taught another");
  for (const builder of [printed(who), brief(["ISS-7"], repo.main, who.env).stdout]) {
    const said = taught(dispatch(who, builder, { role: "forge:qa" }), "a builder's brief to the judge");
    assert.match(said, /^Run `forge brief ISS-7 --judge --url <what the deployment answers at> --criteria /u);
    assert.match(said, /a builder's brief/u, "the teaching does not say which brief it was");
    assertRouteFirst(said, "a builder's brief to the judge");
  }
  const typed = taught(dispatch(who, "ISS-7: judge on staging only.", { role: "forge:qa" }), "a typed brief to the judge");
  assert.match(typed, /^Run `forge brief ISS-7 --judge /u);
  assertRouteFirst(typed, "a typed brief to the judge");
});
