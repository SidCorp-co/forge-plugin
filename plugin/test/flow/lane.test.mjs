/* The lane through the verb that reads for it. `forge claim` holds the lease and nothing else, so
   the rung it prints the lane at costs it a comment page — and that read is the one thing here that
   can fail after the claim has already landed. The review of ISS-810 found it hard: the transport
   exits the process, so the fallback rung below was unreachable and a run that had taken the issue
   would have read the whole claim as failed. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("lane").path;

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const RUN = "the-claiming-run";
const UUID = "lane-uuid";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-810",
  status: "open",
  complexity: "s",
  title: "the lane the claim prints",
  description: "a defect",
};

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update" || args.action === "transition") {
        state.issues[0] = { ...state.issues[0], ...args.data };
      }
      return state.issues[0];
    },
    /* `state.forbids` refuses the read from the moment the lease is on the issue, which is the window this file is about: the write has landed and the read the lane wants has not. A soft read hands back a refusal for the tracker's own answer and for a failed transport alike, so the fallback stands on either. */
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "c-1" };
      if (state.forbids && state.issues[0].sessionContext) {
        return { refused: "no access to this issue's comments", code: "FORBIDDEN" };
      }
      const held = state.comments[UUID];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const asRun = (id) => ({ ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: id });

/* The read-before-write gate delivers a comment this session has not been shown and refuses once;
   the same command sent again lands. That hold is not this file's subject. */
const ran = async (argv, id = RUN) => {
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, argv, asRun(id), process.cwd());
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

const field = (over = {}) => {
  state.issues[0] = { ...ISSUE, ...over };
  state.comments[UUID] = [];
  state.forbids = false;
};

test("the claim prints the lane at the rung the complexity claims, and takes the lease", async () => {
  field();
  const run = await ran(["claim", "ISS-810"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ISS-810 {2}claim:/u, "the lease is taken and said so");
  assert.match(run.stdout, /^Lane at `fix` — every status/mu, "and the lane is printed under it");
  assert.match(run.stdout, /^ {2}approved {9}criteria; no decision, no plan at this rung$/mu,
    "a fix writes neither the reading nor the plan, and its criteria still stand where both are "
    + "dropped: two rows of the ladder on one status, and the row after the first is not silent");
});

/* Read off the record and not off the field alone: the tracker's complexity claims a fix and a
   correction on the page says the work turned out to be a feature, so the lane is a feature's. */
test("a correction that climbed a rung moves the lane the claim prints", async () => {
  field();
  state.comments[UUID] = [{
    documentId: "c-1",
    createdAt: "2026-09-09T01:00:00.000Z",
    authorId: "agent",
    body: "## Correction\n\n```forge-record\nmoved: Size: fix -> feature\nwhy: the work grew\n```\n\n`forge-record: correction · contract 1`",
  }];
  const run = await ran(["claim", "ISS-810"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Lane at `feature` — every status/mu,
    "the rung the entry checks run is the one the lane is printed at");
  assert.match(run.stdout, /^ {2}approved {9}decision, plan, criteria$/mu,
    "so the decision record and the plan a fix would not have written are owed again");
});

/* The failure this file exists for. A claim whose page read is refused has already written the
   lease, and exiting on the read would report the write it made as a failure. */
test("a comment page the tracker refuses costs the lane its rung, and never the claim", async () => {
  field();
  state.forbids = true;
  const run = await ran(["claim", "ISS-810"]);
  assert.equal(run.status, 0, `a claim that took the lease reported failure: ${run.stderr}`);
  assert.match(run.stdout, /ISS-810 {2}claim:/u, "the lease is taken, which is what the verb is for");
  assert.match(run.stdout, /comment page did not read back/u, "the run is told the rung is unread");
  assert.match(run.stdout, /^Lane at `feature` — every status/mu,
    "and the lane stands at the rung an unread page owes, which is the one that owes most");
});
