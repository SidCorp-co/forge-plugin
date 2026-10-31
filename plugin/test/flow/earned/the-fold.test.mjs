/* The rung the ladder folded away: `clarified` is no status core holds (ISSUE_STATUS_LEGACY), its
   decision record is read at `approved`, and both routes a run can still reach the retired name by
   are answered with the place core says took it over rather than with a placeholder (ISS-1066). */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("the-fold").path;
const { CITED, PHASE } = await import("../../../src/guides/phases.mjs");
const { CHECKS, LADDER } = await import("../../../src/flow/earned.mjs");
const { MOVES } = await import("../../../src/resolve/handler.mjs");
const { statusKind } = await import("../../../src/tracker/rest.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { targetOf, viewFrom } = await import("../../../src/flow/route.mjs").then(async (route) => ({
  ...route, viewFrom: (await import("../../../src/flow/earned.mjs")).viewFrom,
}));

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const GONE = "clarified";
const TOOK_OVER = "in_progress:plan";
/* Where the decision record the folded rung was earned by is read now. */
const DECIDED_AT = "approved";

test("the folded rung is no step of the flow, and nothing routes to it", () => {
  assert.equal(LADDER.includes(GONE), false, "the sequence holds it nowhere");
  assert.equal(CHECKS[GONE], undefined, "no entry check answers for it");
  assert.equal(PHASE[GONE], undefined, "and the flow table gives it no phase to owe");
  assert.equal(CITED[GONE], undefined, "no record is cited as earning it");
  assert.equal(MOVES[GONE], undefined, "and the handler performs no word that advances to it");
  assert.deepEqual(statusKind(GONE), { name: GONE, replacedBy: TOOK_OVER },
    "the declaration says which place took it over, which is what both refusals below read");
  assert.deepEqual(CITED[DECIDED_AT], ["decision", "plan", "criteria"],
    "and the record it used to be earned by is cited at that rung, ahead of the plan a run writes after it");
});

/* A park record outlives the fold and names the status it left, so the way back is refused with the
   rung that took it over named in the command rather than left for the reader to work out. */
test("a park recorded from the folded rung is refused the way back, naming what replaced it", () => {
  const at = (minute, body) => ({ createdAt: `2026-09-09T10:0${minute}:00.000Z`, authorId: "agent", body });
  const said = at(0, "❓ **Needs info** — moved from `in_progress`\n\nlook at it");
  const park = at(1, render("park", {
    kind: "release-decision", why: "the release waits on a person", evidence: ["43b811e"] }, GONE));
  assert.throws(() => targetOf(viewFrom("the-uuid", { status: "needs_info" }, [said, park]), "ISS-97"), (error) => {
    assert.match(error.message, /names `clarified` as the status it left/u);
    assert.match(error.message, /took it over is `in_progress:plan`/u);
    assert.match(error.message, /--set in_progress:plan/u, "and the command carries the name, not `<status>`");
    return true;
  });
});

const CONFIRMED = {
  documentId: "fold-uuid",
  issueId: "ISS-97",
  status: "in_progress",
  workState: { step: "plan" },
  title: "the fix standing where the reading and the plan are both written",
  description: "no mark here",
  acceptanceCriteria: "1. BR-09~1: the one outcome.",
  complexity: "s",
};
const APPROVED = {
  documentId: "resumed-uuid",
  issueId: "ISS-96",
  status: "approved",
  title: "the feature whose reading and plan are both behind it",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\n\n## Steps\n\n1. The one step — criteria 1",
  acceptanceCriteria: "1. BR-09~1: the one outcome.",
  complexity: "m",
};
const state = {
  calls: [],
  issues: [CONFIRMED, APPROVED],
  comments: {
    "resumed-uuid": [
      { createdAt: "2026-09-09T09:00:00.000Z", authorId: "agent",
        body: render("confirmation", { where: ["a.mjs"], is: "it holds", finding: "holds" }) },
      { createdAt: "2026-09-09T09:01:00.000Z", authorId: "agent",
        body: render("decision", { decision: [], none: "none found" }) },
    ],
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

test("the place after in_progress:plan is the one that took the fold over, and no lane names the folded one", async () => {
  const run = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^ISS-97 is in_progress:plan; approved is next/mu, "one rung fewer between the two");
  assert.equal(run.stdout.includes(GONE), false, `a line of the answer still names the folded rung: ${run.stdout}`);
  assert.equal(state.calls.some((one) => one.args?.action === "transition"), false, "and --owed moved nothing");
});

/* A name core refuses is offered nowhere: the write is refused by the name of the place that replaced
   it, and a filter naming it is refused before anything is sent, core holding no row at it. */
test("the folded name is refused a set and a filter alike", async () => {
  const set = await ranAsync(FORGE,
    ["advance", "ISS-97", "--set", GONE, "--why", "the reading is decided"], ENV);
  const said = set.stdout + set.stderr;
  assert.equal(set.status, 1, set.stdout);
  assert.match(said, /`clarified` is no status core holds: it refuses the name ISSUE_STATUS_LEGACY/u);
  assert.match(said, /`in_progress:plan` is the place that took it over/u);
  assert.match(said, /forge advance ISS-97 --set in_progress:plan --why/u,
    "the replacement is a command to run, not a name to look up");
  assert.deepEqual(state.calls.filter((one) => one.args?.action === "transition"), [], "nothing was sent");
  /* A named target never reaches the column: the jump is refused first, and what it owes is the
     rung that is next — which after the fold is the one the folded name was replaced by anyway. */
  const jump = await ranAsync(FORGE, ["advance", "ISS-97", "--to", GONE], ENV);
  assert.equal(jump.status, 1, jump.stdout);
  assert.match(jump.stdout + jump.stderr, /in_progress:plan is the place that took it over, and approved is next/u,
    "and a named target is answered by the refusal naming what took it over and the place that is next");
  state.calls = [];
  const read = await ranAsync(FORGE, ["issue", "--status", GONE], ENV);
  assert.equal(read.status, 1, `${read.stdout}${read.stderr}`);
  assert.match(read.stderr, /No status named clarified/u, "the filter is refused by the name it was given");
  assert.deepEqual(state.calls.filter((one) => one.args?.action === "list"), [], "and no list was read for it");
});

/* What a run resuming somebody else's issue is told: the two phases the fold left at one rung are
   one line behind it, named by the record that discharged them, and the phase owed is still its own. */
test("a resume at the rung above the fold names both phases behind it on one line", async () => {
  const run = await ranAsync(FORGE, ["resume", "ISS-96"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^ {2}passed: 2 Clarify; 3 Plan {2}— {2}decision$/mu,
    "one line for the rung, and the reading is what says the work at it was done");
  assert.match(run.stdout, /^ {2}passed: 1 Triage {2}— {2}confirmation$/mu, "with the rung below it above that");
  assert.match(run.stdout, /Phase owed:\s+4 Implement, to the branch/iu, "and what is owed is the status's own");
  assert.equal(run.stdout.includes(GONE), false, `the resume still names the folded rung: ${run.stdout}`);
});

/* The served half, read through the verb rather than off the directory: a run reaches the contract
   by these two calls, and a fold that left a part behind or moved a payload without moving the
   sentence about it would answer both of them wrongly and fail nothing else. */
test("the contract serves one part fewer, none of them the folded rung, and states the record it moved", async () => {
  const contents = await ranAsync(FORGE, ["guide", "contract"], ENV);
  assert.equal(contents.status, 0, `${contents.stdout}${contents.stderr}`);
  assert.match(contents.stdout, /^The issue-flow contract — this plugin's own, contract 1, 19 part\(s\)\./mu);
  assert.equal(contents.stdout.includes(GONE), false, `a row still addresses the folded rung: ${contents.stdout}`);
  const part = await ranAsync(FORGE, ["guide", "contract", DECIDED_AT], ENV);
  assert.equal(part.status, 0, `${part.stdout}${part.stderr}`);
  assert.match(part.stdout, /decision record/u, "the rung that reads it says so where a run is sent for it");
  const gone = await ranAsync(FORGE, ["guide", "contract", GONE], ENV);
  assert.equal(gone.status, 1, gone.stdout);
  assert.match(gone.stdout + gone.stderr, /lists every part/u,
    "and asking for the part that left is a refusal naming the way to the list, not an empty answer");
});
