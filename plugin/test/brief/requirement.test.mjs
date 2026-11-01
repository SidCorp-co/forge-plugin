/* A judge's target has to travel in the brief: three judges sent to judge a requirement's criterion
   (REQ-79 BC-6) under an issue's brief judged that issue's own criteria instead (K156, K158, K160).
   So the brief takes a requirement target, names it on its first line, and the gate holds an issue's
   brief back from a judge whose facts name a requirement. */
import assert from "node:assert/strict";
import test from "node:test";

import { answered, callHookAsync, ranAsync } from "../fixtures.mjs";
import { trackerFor } from "../fixtures/own-project.mjs";
import { CLI, HOOK, brief, homeFor, repository } from "./fixture.mjs";

const repo = repository();
const URL_AT = "https://staging.example.com";

const refused = (run, pattern) => {
  assert.notEqual(run.status, 0, run.stdout);
  assert.equal(run.stdout, "", "a refused brief prints nothing to send");
  assert.match(run.stderr, pattern);
};

test("a requirement's brief names its target on the first line, and the judge's readings under it", () => {
  const run = brief(["--requirement", "REQ-79", "--criterion", "BC-6", "--url", URL_AT, "--identity", "794dc78"],
    repo.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.stdout.trim().split("\n"), [
    "Target: REQ-79, criteria BC-6 — judge these and write nothing else: no issue's criteria, no other record.",
    "Role: judge",
    `Deployed at: ${URL_AT}`,
    "Identity: 794dc78",
    "Tree: none",
  ]);
  const whole = brief(["--requirement", "REQ-79", "--url", URL_AT], repo.main, homeFor().env);
  assert.match(whole.stdout, /^Target: REQ-79, every criterion — judge these and write nothing else/u, whole.stderr);
});

test("an issue judge's brief leads with its target too", () => {
  const run = brief(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1,3"], repo.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.split("\n")[0], "Target: ISS-7, criteria 1, 3 — judge these and write nothing else.");
});

test("a requirement's brief refuses by name whatever would aim the judge at an issue", () => {
  const env = homeFor().env;
  for (const [argv, pattern] of [
    [["ISS-7", "--requirement", "REQ-79", "--url", URL_AT], /takes no ISS-7:/u],
    [["--requirement", "REQ-79", "--criteria", "1", "--url", URL_AT], /takes no --criteria:/u],
    [["--requirement", "REQ-79", "--tree", repo.mine, "--url", URL_AT], /takes no --tree:/u],
    [["--requirement", "REQ-79"], /lacks --url:\n {2}forge brief --requirement REQ-79 /u],
    [["--requirement", "ISS-7", "--url", URL_AT], /--requirement takes one requirement key, as REQ-79/u],
    [["--requirement", "REQ-79", "--criterion", "6", "--url", URL_AT], /--criterion takes the requirement's criteria as BC-6/u],
    [["ISS-7", "--judge", "--criterion", "BC-6", "--url", URL_AT, "--criteria", "1"], /--criterion names a requirement's criteria/u],
  ]) refused(brief(argv, repo.main, env), pattern);
});

/* The gate, against a tracker holding ISS-7 and the facts its dispatcher left on the lease. */
const state = {};
const { tracker, env } = await trackerFor(state, [repo.main]);
test.after(() => tracker.close());
const issues = (next) => Array.from({ length: 7 }, (_, at) => ({
  documentId: `uuid-${at + 1}`, issueId: `ISS-${at + 1}`, status: "in_progress", title: "t",
  ...(at === 6 && next !== undefined ? { sessionContext: { lease: { holder: "dispatcher", minutes: 1, next } } } : {}),
}));
const SESSION = { ...env, CLAUDE_CODE_SESSION_ID: "session-req" };

const dispatch = async (prompt, role) => {
  const run = await callHookAsync(HOOK, {
    session_id: "session-req", cwd: repo.main, tool_name: "Agent",
    tool_input: { description: "judge it", prompt, subagent_type: role },
  }, SESSION, repo.main);
  const answer = answered(run)?.hookSpecificOutput ?? {};
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason ?? "",
    context: answer.additionalContext ?? "" };
};
const printed = (argv) => {
  const run = brief(argv, repo.main, SESSION);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

test("the gate takes a requirement's brief for the judge, and refuses it to a builder", async () => {
  state.issues = issues();
  const sent = printed(["--requirement", "REQ-79", "--criterion", "BC-6", "--url", URL_AT]);
  assert.equal((await dispatch(sent, "forge:qa")).allowed, true);
  const builder = await dispatch(sent, "forge:runner");
  assert.equal(builder.allowed, false);
  assert.match(builder.reason, /^Hold — a requirement's brief is a judge's/u);
});

test("an issue's brief to a judge whose facts name a requirement is refused, naming the requirement", async () => {
  state.issues = issues("judge REQ-79 BC-6 at staging, not the issue's own criteria");
  const said = await dispatch(printed(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1"]), "forge:qa");
  assert.equal(said.allowed, false);
  assert.match(said.reason, /^Hold — run `forge brief --requirement REQ-79 \[--criterion BC-n\] --url /u);
  assert.match(said.reason, /The facts left on ISS-7 for this judge name REQ-79/u);
});

test("an issue's brief to a judge passes where its facts name no requirement, or say nothing", async () => {
  for (const next of ["judge criteria 1 and 2 on staging", undefined]) {
    state.issues = issues(next);
    const said = await dispatch(printed(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1"]), "forge:qa");
    assert.equal(said.allowed, true, `${next}: ${said.reason}`);
    assert.equal(said.context, "", "nothing to say where the facts were read");
  }
});

test("where the facts cannot be read, the judge's brief passes and the session is told it was not checked", async () => {
  const who = homeFor();
  const generated = brief(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1"], repo.main, who.env);
  const run = await callHookAsync(HOOK, {
    session_id: who.session, cwd: repo.main, tool_name: "Agent",
    tool_input: { description: "judge it", prompt: generated.stdout, subagent_type: "forge:qa" },
  }, who.env, repo.main);
  const answer = answered(run)?.hookSpecificOutput ?? {};
  assert.notEqual(answer.permissionDecision, "deny");
  assert.match(answer.additionalContext ?? "", /^Not checked: whether the facts left on ISS-7 name a requirement/u);
});

/* FB-30: two adminhub judges (ISS-90, ISS-80) judged behaviour at commit only, missing the dispatcher's
   facts, because those rode the lease and the judge read only the brief. The issue judge's brief now
   reads the lease at the dispatch and carries the note as its last line, below the structured readings.
   Run async (not the spawnSync `brief` fixture): the fakeTracker serves from this test's own event
   loop, which a blocking child would hold, so the subprocess's lease read could never be answered. */
const judgedFacts = async (argv) => {
  const run = await ranAsync(process.execPath, [CLI, "brief", ...argv], SESSION, repo.main);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

test("FB-30: an issue judge's brief carries the dispatcher's lease facts as its last line", async () => {
  state.issues = issues("served 3.36.652 de70833e; testing-profile run 9f2c; judge criteria 1,2 at staging");
  const lines = (await judgedFacts(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1,2"])).trim().split("\n");
  assert.equal(lines.at(-1), "Dispatcher facts: served 3.36.652 de70833e; testing-profile run 9f2c; judge criteria 1,2 at staging");
  assert.equal(lines[0], "Target: ISS-7, criteria 1, 2 — judge these and write nothing else.", "the target still leads");
});

test("FB-30: the facts line is left out where the lease names a requirement or carries no note", async () => {
  for (const next of ["judge REQ-79 BC-6 at staging", undefined]) {
    state.issues = issues(next);
    assert.doesNotMatch(await judgedFacts(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1"]), /Dispatcher facts:/u,
      `${next}: a requirement note is the gate's to catch, and no note carries nothing to the brief`);
  }
});

test("FB-30: a judge's brief carries no facts line where the lease cannot be read", () => {
  const run = brief(["ISS-7", "--judge", "--url", URL_AT, "--criteria", "1"], repo.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /Dispatcher facts:/u);
});

/* FB-26: a qa run sent to judge a CLI criterion (ISS-791, forge-runner 0.18.0) was refused a judge's
   brief and judged with a general-purpose agent instead. A judge aimed at a program is a judge's form,
   so the gate takes it for forge:qa as it does a deployment judge's. */
test("FB-26: the gate takes a CLI judge's brief, aimed at a program, for the judge", async () => {
  state.issues = issues();
  const sent = printed(["ISS-7", "--judge", "--program", "/usr/local/bin/forge-runner", "--identity", "de70833e", "--criteria", "1", "--tree", repo.main]);
  assert.match(sent, /^Program: \/usr\/local\/bin\/forge-runner$/mu, sent);
  assert.ok(sent.split("\n").includes(`Run the program in: ${repo.main}`), sent);
  assert.equal((await dispatch(sent, "forge:qa")).allowed, true);
});
