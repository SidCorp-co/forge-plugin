/* `forge release-batch`, against a spawned fakeTracker: every case reads `state.calls`, the fixture's own
   record of the real path and method its HTTP server received, so a wrong route in `routes.mjs`
   fails here rather than being masked by a fixture answering the same body for any call (ISS-1484). */
import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-keys.mjs";
import { minutesSince } from "../../src/tools/release-batch/verb.mjs";

test("minutesSince reads the exact whole minutes between a stamp and a chosen now, rounding to the nearest", () => {
  const at = "2026-09-01T00:00:00.000Z";
  assert.equal(minutesSince(at, Date.parse(at)), 0);
  assert.equal(minutesSince(at, Date.parse(at) + 5 * 60_000), 5);
  assert.equal(minutesSince(at, Date.parse(at) + 90_000), 2, "90s rounds up to the nearest minute");
  assert.equal(minutesSince(at, Date.parse(at) + 89_000), 1, "89s rounds down to the nearest minute");
  assert.equal(minutesSince("not a date", Date.now()), null);
});

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

const RUN_ID = "cccccccc-0000-4000-8000-000000000003";
const ISSUE_IDS = ["dddddddd-0000-4000-8000-000000000004", "eeeeeeee-0000-4000-8000-000000000005"];
const STARTED_AT = "2026-09-01T00:00:00.000Z";

const boundsOf = (holding) => ({
  holding,
  crossedNames: holding ? ["stall"] : [],
  bounds: [
    { name: "total", crossed: false, measuredMs: null, thresholdMs: 5_400_000,
      why: "this run has recorded no promotion, so nothing has reached production to measure from" },
    { name: "stall", crossed: holding, measuredMs: holding ? 2_000_000 : null, thresholdMs: 1_500_000,
      why: holding ? "time since the newest write to this run's ledger" : "this run has recorded no "
        + "promotion, so nothing has reached production to measure from" },
    { name: "regression", crossed: false, measuredMs: null, thresholdMs: null,
      why: "the newest settled attempt reads the application down after an earlier one read it up" },
  ],
});

const state = {
  active: null,
  runState: null,
  abortResult: null,
  answer: {
    forge_release_batch: (args) => {
      if (args.action === "active") return state.active;
      if (args.action === "state") return state.runState;
      if (args.action === "abort") {
        return state.abortResult ?? { aborted: true, releasedIds: ISSUE_IDS };
      }
      throw new Error(`forge release-batch test double asked for an action it does not know: ${args.action}`);
    },
  },
};

const tracker = await fakeTracker(state);
after(() => tracker.close());

const home = tracker.env.XDG_CONFIG_HOME;
const bare = projectRoom(tempRoom("release-cwd-"), home, { slug: OWN.slug });

const ran = async (...argv) => {
  state.calls = [];
  const answer = await ranAsync(FORGE, ["release-batch", ...argv], tracker.env, bare);
  const calls = (state.calls ?? []).map((one) => `${one.method} ${one.path.replace(/\/projects\/[^/]+\//u, "/projects/:id/")}`);
  /* A write also spends one `GET /api/projects/:id` of its own, off the credential-leak guard every
     write in this CLI takes before it sends (`refuseCredential`, `rest.mjs`) — present or absent by
     whether this case wrote at all, and never one of the three release-batch routes a case here is
     about. Read apart so a case can assert this route's own order without restating that guard's. */
  const released = calls.filter((one) => one.includes("/release-batches/"));
  return { ...answer, calls, released };
};

const ACTIVE_ROUTE = "GET /api/projects/:id/release-batches/active";
const STATE_ROUTE = `GET /api/projects/:id/release-batches/${RUN_ID}/state`;
const ABORT_ROUTE = `POST /api/projects/:id/release-batches/${RUN_ID}/abort`;

test("no batch running: status calls active alone and prints so", async () => {
  state.active = null;
  const run = await ran();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /no release batch is running for this project/u);
  assert.deepEqual(run.released, [ACTIVE_ROUTE], "the state route is never asked with no runId to ask it about");
});

test("a batch running: status calls active then state, in that order, and prints runId, age, roster and the bounds reading", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(false) };
  const run = await ran();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(RUN_ID, "u"));
  /* The exact arithmetic is `minutesSince`'s own unit test, against a chosen `now` and no real
     clock; what this end-to-end case is owed is that a subprocess reading a real elapsed span
     prints one, which real wall-clock elapsed time cannot bound by a constant (ISS-1274). */
  assert.match(run.stdout, /\(\d+ minute\(s\) ago\)/u, `no computed age in: ${run.stdout}`);
  assert.match(run.stdout, new RegExp(`2 issue\\(s\\): ${ISSUE_IDS[0]}, ${ISSUE_IDS[1]}`, "u"));
  assert.match(run.stdout, /holding\s+no/u);
  assert.match(run.stdout, /total\s+crossed=false measuredMs=null thresholdMs=5400000/u);
  assert.match(run.stdout, /stall\s+crossed=false measuredMs=null thresholdMs=1500000/u);
  assert.match(run.stdout, /regression\s+crossed=false measuredMs=null thresholdMs=null/u);
  assert.match(run.stdout, /why: this run has recorded no promotion/u);
  assert.match(run.stdout, /why: the newest settled attempt reads the application down after an earlier one read it up/u);
  assert.deepEqual(run.released, [ACTIVE_ROUTE, STATE_ROUTE]);
});

test("clear with no --reason is refused before anything is sent, --force included", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  const bare1 = await ran("clear", RUN_ID);
  assert.equal(bare1.status, 1);
  assert.match(bare1.stderr, /--reason is owed/u);
  assert.deepEqual(bare1.released, []);
  const forced = await ran("clear", RUN_ID, "--force");
  assert.equal(forced.status, 1);
  assert.match(forced.stderr, /--reason is owed/u);
  assert.deepEqual(forced.released, [], "--force names no way around the reason a record is owed");
});

test("clear names a runId a fresh read disagrees with, and refuses before the state or the abort route is asked", async () => {
  state.active = { runId: "ffffffff-0000-4000-8000-000000000006", issueIds: [], startedAt: STARTED_AT };
  const run = await ran("clear", RUN_ID, "--reason", "stale copy from an old terminal");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /the batch running now is ffffffff-0000-4000-8000-000000000006, not cccccccc/u);
  assert.deepEqual(run.released, [ACTIVE_ROUTE], "the mismatch is read off active alone");
});

test("clear where no batch is active at all is refused off that one read", async () => {
  state.active = null;
  const run = await ran("clear", RUN_ID, "--reason", "nothing to clear");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no release batch is running for this project/u);
  assert.deepEqual(run.released, [ACTIVE_ROUTE]);
});

test("clear on a run the tracker's own bounds do not call holding is refused after active and state, before abort, printing the rerun with --force", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(false) };
  const run = await ran("clear", RUN_ID, "--reason", "guessing it is dead");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /has crossed none of the tracker's own bounds/u);
  assert.match(run.stderr, new RegExp(`forge release-batch clear ${RUN_ID} --reason 'guessing it is dead' --force`, "u"));
  assert.deepEqual(run.released, [ACTIVE_ROUTE, STATE_ROUTE], "nothing was aborted");
});

test("clear's printed rerun single-quotes a reason holding a double quote, so the line it prints reads back as the reason it names (codex F2)", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(false) };
  const run = await ran("clear", RUN_ID, "--reason", `operator said "wait"`);
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`--reason 'operator said "wait"' --force`, "u"));
});

test("clear's printed rerun escapes a reason holding a single quote, so the line it prints still reads back as one shell argument", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(false) };
  const run = await ran("clear", RUN_ID, "--reason", "it's stale");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--reason 'it'\\''s stale' --force/u);
});

test("clear --force on a run whose state names no bounds at all is refused before abort, since nothing measured is nothing to force past", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running" };
  const run = await ran("clear", RUN_ID, "--reason", "guessing, with no bounds reading at all", "--force");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /did not come back/u);
  assert.deepEqual(run.released, [ACTIVE_ROUTE, STATE_ROUTE], "nothing was aborted");
});

test("clear --force past a not-holding state sends the abort", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(false) };
  state.abortResult = { aborted: true, releasedIds: ISSUE_IDS };
  const run = await ran("clear", RUN_ID, "--reason", "operator override", "--force");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /aborted\s+yes/u);
  assert.match(run.stdout, new RegExp(`released\\s+2 issue\\(s\\): ${ISSUE_IDS[0]}, ${ISSUE_IDS[1]}`, "u"));
  assert.deepEqual(run.released, [ACTIVE_ROUTE, STATE_ROUTE, ABORT_ROUTE],
    "--force skips only the holding refusal and never the re-read it is measured against");
});

test("clear on a run the tracker's own bounds do call holding sends the abort with no --force needed", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(true) };
  state.abortResult = { aborted: true, releasedIds: ISSUE_IDS };
  const run = await ran("clear", RUN_ID, "--reason", "past its stall bound");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /aborted\s+yes/u);
  assert.deepEqual(run.released, [ACTIVE_ROUTE, STATE_ROUTE, ABORT_ROUTE]);
});

test("no case in this file ever reaches the tracker's MCP endpoint", async () => {
  state.active = { runId: RUN_ID, issueIds: ISSUE_IDS, startedAt: STARTED_AT };
  state.runState = { runId: RUN_ID, projectId: "p", runStatus: "running", bounds: boundsOf(true) };
  state.abortResult = { aborted: true, releasedIds: ISSUE_IDS };
  const status = await ran();
  const cleared = await ran("clear", RUN_ID, "--reason", "checked again");
  for (const call of [...status.calls, ...cleared.calls]) {
    assert.ok(!call.includes("/mcp"), `${call} reached /mcp`);
  }
});
