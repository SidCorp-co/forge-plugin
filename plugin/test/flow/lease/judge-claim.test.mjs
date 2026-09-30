/* A judge claims no lease: its verdict is the one record written past another run's. So a judge that
   claims anyway, at the rung it judges from, is owed that route and not the dispatch's, which sent it
   to a tree it is told not to hold and told it to unset the id it was told to set (ISS-1798). The
   builder's half is the line `advance --owed` prints while the checkpoint can still be captured. */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("judge-claim").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("judge-claim-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const { JUDGED_AT, ORDER } = await import("../../../src/flow/earned.mjs");
const { JUDGING_AT } = await import("../../../src/flow/lease/dispatched.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "5c67337e-0000-4000-8000-000000001798";
const BUILDER = "iss-1798-3fe7c301";
const JUDGE = "qa-judge-of-its-own";
const WAVE = "the-dispatching-session";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1798",
  status: "developed",
  title: "a judge meets the builder's live lease",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "s",
};

const heldBy = (holder, status) => {
  ISSUE.status = status;
  ISSUE.sessionContext = {
    lease: { holder, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 60,
      next: "the builder's own next step", history: [] },
  };
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false, qa: "independent" } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[UUID] ?? [], returned: 0, hasMore: false };
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
test.after(() => tracker.close());

/* An id the caller set, or the one it inherited from whoever dispatched it. */
const asked = (argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: JUDGE, CLAUDE_CODE_SESSION_ID: "" }, AWAY);
const inherited = (argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: "", CLAUDE_CODE_SESSION_ID: WAVE }, AWAY);
const updates = () => state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "update").length;

test("a judge's claim at developed or testing is refused naming the verdict's route and the owed read", async () => {
  for (const status of ["developed", "testing"]) {
    heldBy(BUILDER, status);
    const before = updates();
    const refused = await asked(["claim", "ISS-1798"]);
    assert.equal(refused.status, 1, `${status}: the lease is the builder's:\n${refused.stdout}${refused.stderr}`);
    assert.match(refused.stderr, /Where this call is a judge's, it claims no lease: a verdict goes up past this one/u, status);
    assert.match(refused.stderr, /\n {2}forge advance ISS-1798 --owed\n/u, `${status}: the one command, unprefixed:\n${refused.stderr}`);
    assert.doesNotMatch(refused.stderr, /FORGE_SESSION_ID=<an id of its own> forge advance/u,
      "an id the caller set is its own already");
    assert.equal(updates(), before, "and nothing was taken");
  }
});

test("where the judge's id is inherited, the command it is sent to opens with an id of its own", async () => {
  heldBy(BUILDER, "developed");
  const refused = await inherited(["claim", "ISS-1798"]);
  assert.equal(refused.status, 1, `${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /\n {2}FORGE_SESSION_ID=<an id of its own> forge advance ISS-1798 --owed\n/u, refused.stderr);
});

test("at the judging rungs the refusal sends the caller to no tree", async () => {
  for (const status of ["developed", "testing"]) {
    heldBy(BUILDER, status);
    for (const call of [asked, inherited]) {
      const refused = await call(["claim", "ISS-1798"]);
      assert.equal(refused.status, 1, refused.stderr);
      assert.doesNotMatch(refused.stderr, /forge brief ISS-1798 --tree/u, `${status}: ${refused.stderr}`);
      assert.doesNotMatch(refused.stderr, /unset it|Unset that variable/u, `${status}: ${refused.stderr}`);
      assert.doesNotMatch(refused.stderr, /make the call from the tree cut for that run/u, `${status}: ${refused.stderr}`);
    }
  }
});

test("at a status a run is dispatched at, the refusal carries none of the judge's route", async () => {
  heldBy(BUILDER, "confirmed");
  const refused = await asked(["claim", "ISS-1798"]);
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stderr, /which names no issue at all/u, "the id sentence it always gave");
  assert.doesNotMatch(refused.stderr, /judge's/u, refused.stderr);
  assert.doesNotMatch(refused.stderr, /forge advance ISS-1798 --owed/u, refused.stderr);
});

/* The policy is read at in_progress for this line alone, so the CLI case is what proves the fetch. */
test("the builder's owed read at in_progress names the capture its judge's verdicts will be read against", async () => {
  heldBy(BUILDER, "in_progress");
  const owed = await ranAsync(FORGE, ["advance", "ISS-1798", "--owed"],
    { ...ENV, FORGE_SESSION_ID: BUILDER, CLAUDE_CODE_SESSION_ID: "" }, AWAY);
  const out = `${owed.stdout}${owed.stderr}`;
  assert.match(out, /Ahead: testing is earned here by an independent judge's verdicts/u, out);
  assert.match(out, /\n {2}forge claim ISS-1798 --pushed --ready\n {2}forge claim ISS-1798 --landed/u, out);
});

/* The refusal spells its two rungs rather than importing the flow's order, which a hook would pay for. */
test("the rungs the judge's route is named at are the flow's own: the one a verdict earns and the one before it", () => {
  const judged = ORDER.indexOf(JUDGED_AT);
  assert.deepEqual(JUDGING_AT, [ORDER[judged - 1], JUDGED_AT]);
});
