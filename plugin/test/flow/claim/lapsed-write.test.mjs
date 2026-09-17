/* The three rungs a payload write meets on another run's lease, watched through the CLI on the very
   call the round was measured on: a wave closing an issue its runner had left behind. A lapse older
   than the duration the holder named is one a bare `forge claim` grants with no flag, so the write
   makes that claim itself; a younger one and a live one are refused exactly as they were, or the
   change could not be told from deleting the freshness guard (ISS-1660). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, standsInNoTree, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("lapsed-write").path;
standsInNoTree("lapsed-write");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "lapsed-write-uuid";
const OURS = "the-run-tidying-up";
const THEIRS = "iss-1660-66b685d3";
const LEFT = "Phase 7: post the note";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1660",
  status: "awaiting_release",
  title: "a write refused only by an expired lease",
  description: "no mark here",
  complexity: "s",
};

/* Each case starts from the lease it is about and from the status the round was charged at, so no
   case reads through the one before it. */
let displaced = null;
const heldBy = (holder, since, minutes) => {
  ISSUE.status = "awaiting_release";
  displaced = { renewedAt: ago(since), minutes };
  ISSUE.sessionContext = {
    lease: {
      holder, agent: "a-test-agent", pid: "4242", renewedAt: displaced.renewedAt, minutes, next: LEFT,
      history: [{ holder, at: displaced.renewedAt, how: "claim", status: "in_progress", next: null }],
    },
  };
};

/* The stamp the CLI writes, cut to the minute the record keeps expiries at, derived from the very lease the case put on the issue rather than from a tolerance around a second reading of the clock. */
const ranOutOf = () =>
  new Date(Date.parse(displaced.renewedAt) + displaced.minutes * 60_000).toISOString().slice(0, 16);

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      if (args.action === "transition") ISSUE.status = args.data.status;
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[UUID] ?? [], returned: 0, hasMore: false };
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv, who = OURS) => ranAsync(FORGE, argv, { ...tracker.env, FORGE_SESSION_ID: who });
/* Read off the tracker after the call rather than out of its output: what a later reader has is the
   field, and the terminal the write printed to is gone by then. */
const onTheRecord = () => ISSUE.sessionContext.lease;

test("a write meeting a lease the record proves dead reclaims it and lands, in one call", async () => {
  /* 121 minutes of a 60-minute lease: 61 past expiry, which outlasts the duration the holder named,
     so nothing about that run is left for a caller to establish. */
  heldBy(THEIRS, 121, 60);
  const moved = await ran(["advance", "ISS-1660"]);
  assert.equal(moved.status, 0, `one call should have closed it:\n${moved.stdout}${moved.stderr}`);
  assert.match(moved.stdout, /ISS-1660 {2}awaiting_release -> closed/u, "the write the caller asked for landed");
  assert.equal(ISSUE.status, "closed", "and the status moved on the tracker, not only in the output");
  assert.doesNotMatch(moved.stderr, /Reclaim it first/u, "with nothing sending the caller back for a claim");

  assert.match(moved.stderr, new RegExp(`session ${THEIRS}`, "u"), "the notice names the run it displaced");
  assert.match(moved.stderr, /ran out 6[01] minute\(s\) ago/u, "and how long ago that lease ran out");
  assert.match(moved.stderr, new RegExp(`The step that run left named: ${LEFT}`, "u"),
    "and the line the run that is gone left behind");

  const row = onTheRecord().history.at(-1);
  assert.equal(row.how, "reclaim",
    "the history keeps the word a typed reclaim writes, so the crash park still counts this pickup");
  assert.equal(row.status, "awaiting_release", "at the status the issue stood at when it was taken");
  assert.equal(row.from, THEIRS, "and names the run it went over, which no earlier row has to survive for");
  assert.equal(row.ranOut, ranOutOf(),
    "and when that lease ran out, off its own renew time and duration, which nothing else on the record holds");
  assert.equal(onTheRecord().holder, "",
    "and the lease the write took for itself went back once the write had landed");
});

test("a lease lapsed inside the threshold refuses the write, and the claim it names asks for --stopped", async () => {
  /* 90 minutes of a 60-minute lease: 30 past expiry, less than the duration, so a run inside a gate
     and a run that died leave this same record and the caller is the only one who can tell. */
  heldBy(THEIRS, 90, 60);
  const refused = await ran(["advance", "ISS-1660"]);
  assert.equal(refused.status, 1, `a lapse this fresh should refuse:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /the lease on ISS-1660 is another run's and has expired/u,
    "in the words it used before this change");
  assert.match(refused.stderr, /Reclaim it first:\n {2}forge claim ISS-1660/u, "naming the claim");
  assert.equal(ISSUE.status, "awaiting_release", "and nothing moved");

  const claim = await ran(["claim", "ISS-1660"]);
  assert.equal(claim.status, 1, `and that claim is itself refused:\n${claim.stdout}${claim.stderr}`);
  assert.match(claim.stderr, /ran out 30 minute\(s\) ago/u);
  assert.match(claim.stderr, /forge claim ISS-1660 --stopped/u,
    "which is the one fact the tracker cannot read and the caller can assert");
});

test("another run's live lease refuses the write as it always did", async () => {
  heldBy(THEIRS, 11, 60);
  const refused = await ran(["advance", "ISS-1660"]);
  assert.equal(refused.status, 1, `a live lease is that run's:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /ISS-1660 is held by another run/u);
  assert.doesNotMatch(refused.stderr, /reclaimed it/u, "and nothing was taken");
  assert.equal(ISSUE.status, "awaiting_release");
});
