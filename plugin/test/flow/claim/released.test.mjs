/* A lease covers a write and not a run, end to end and through the CLI, which is where the give-back is spent: `renew` runs before every payload write and cannot know one landed, so what proves the release is a verb that returned. A field that looks free and a field that is free read identically from the outside, which is why every case here asserts the next run's claim and not the field (ISS-1617). */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("released").path;
/* Away from this checkout, whose git directory names the run this suite is written under: a
   checkout of its own names none, and its project is a record beside the machine's own keys
   rather than a file in the tree. */
const AWAY = projectRoom(tempRoom("released-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "released-uuid";
const BUILDER = "the-run-that-carried-it-to-developed";
const JUDGE = "the-run-that-claims-from-developed";
const LEFT = "Phase 5: read the criteria back and judge each one";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1617",
  status: "approved",
  title: "a lease that covers a write",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "m",
};

/* Whether the far end honours the move it is sent: turned off, the transition answers with the status the issue already held, which is the verb refusing after its own renewal has landed. */
let moves = true;

const stands = (context, status = "approved") => {
  ISSUE.sessionContext = context;
  ISSUE.status = status;
  moves = true;
};

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      if (args.action === "transition" && moves) ISSUE.status = args.data.status;
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

const ran = (argv, who) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: who });
const setTo = (status, who) =>
  ran(["advance", "ISS-1617", "--set", status, "--why", "the fixture moves it without earning it"], who);

/* The case the issue asks for. The assertion that carries it is the second run getting the issue with no wait and no flag in its hand. */
test("an advance to developed leaves nothing holding the issue, and another run claims it with no wait and no flag", async () => {
  stands({});
  const started = await setTo("in_progress", BUILDER);
  assert.equal(started.status, 0, `the first move should have gone through:\n${started.stdout}${started.stderr}`);
  assert.match(started.stderr, /carried no lease/u, "taking the lease as it writes");
  assert.match(started.stderr, /ISS-1617 is free again/u, "and giving it back once the write has landed");
  assert.equal(ISSUE.sessionContext.lease.holder, "", "so the field names no holder");

  /* The write that earns the next status takes the lease on a field the release left, at a status an empty field is refused at. */
  const developed = await setTo("developed", BUILDER);
  assert.equal(developed.status, 0, `and so should the second:\n${developed.stdout}${developed.stderr}`);
  assert.equal(ISSUE.status, "developed", "the issue is where the next run claims from");
  assert.equal(ISSUE.sessionContext.lease.holder, "", "and nothing holds it");

  const judge = await ran(["claim", "ISS-1617"], JUDGE);
  assert.equal(judge.status, 0, `the next run should have claimed it:\n${judge.stdout}${judge.stderr}`);
  assert.match(judge.stdout, new RegExp(`ISS-1617  claim: session ${JUDGE}`, "u"),
    "as an ordinary first claim, which is what a released issue is owed");
  assert.match(judge.stdout, new RegExp(`ISS-1617  claim: session ${JUDGE} \\(id from asked; `, "u"),
    "and says the id was the one the run was handed");
  assert.doesNotMatch(judge.stderr, /--unheld/u, "with no flag asserting a run died on it");
  assert.doesNotMatch(judge.stderr, /--stopped/u, "and none asserting a run was stopped");
  assert.doesNotMatch(judge.stdout + judge.stderr, /Wait for it/u, "and no clock to wait out");
});

/* A lease a run asked for is a run at work: in ship mode `self` that run carries past `developed` and lands. */
test("a lease the run claimed for itself is not given back by the writes made under it", async () => {
  stands({});
  const claimed = await ran(["claim", "ISS-1617", "--minutes", "45"], BUILDER);
  assert.equal(claimed.status, 0, claimed.stderr);
  const moved = await setTo("in_progress", BUILDER);
  assert.equal(moved.status, 0, moved.stderr);
  assert.equal(ISSUE.sessionContext.lease.holder, BUILDER, "the lease is still the run's");
  assert.equal(ISSUE.sessionContext.lease.minutes, 45, "for the duration it asked for");
  assert.doesNotMatch(moved.stderr, /is free again/u, "and nothing gave it back");

  const other = await ran(["claim", "ISS-1617"], JUDGE);
  assert.equal(other.status, 1, `a second run is refused while that lease is live:\n${other.stdout}`);
  assert.match(other.stderr, /ISS-1617 is claimed/u, "in the words a live lease is refused in");
});

/* A call that did not complete gives nothing back: the status moved and the correction the set owes is still owed, so the run needs the lease to write it. The release is on the action completing, and a landed sub-write is not the action. */
test("a call that took the lease and then did not complete leaves the lease standing", async () => {
  stands({});
  moves = false;
  const refused = await setTo("in_progress", BUILDER);
  assert.equal(refused.status, 1, `the move should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.equal(ISSUE.sessionContext.lease.holder, BUILDER, "and the lease the write took is still held");
  assert.doesNotMatch(refused.stderr, /is free again/u, "nothing having been given back");

  const other = await ran(["claim", "ISS-1617"], JUDGE);
  assert.equal(other.status, 1, `so the issue is not another run's:\n${other.stdout}`);
  assert.match(other.stderr, /ISS-1617 is claimed/u);
});

/* The history is the record of how an issue was picked up and it outlives the lease: read through `leaseOf` it is dropped at the first take on a released field, which is every take there is once a release is the ordinary end of a write (codex F3). */
test("a take on a field a lease was given back in keeps the history and the line it left", async () => {
  stands({
    lease: {
      holder: "",
      released: ago(2),
      next: LEFT,
      history: [{ holder: "a-run-before-this-one", at: ago(30), how: "write", status: "approved" }],
    },
  }, "developed");
  const taken = await ran(["claim", "ISS-1617"], JUDGE);
  assert.equal(taken.status, 0, `the claim should have been granted:\n${taken.stdout}${taken.stderr}`);
  const held = ISSUE.sessionContext.lease;
  assert.equal(held.holder, JUDGE);
  assert.deepEqual(held.history.map((one) => one.holder), ["a-run-before-this-one", JUDGE],
    "the row already on the field stands, and this claim's is added to it");
  assert.equal(held.history.at(-1).how, "claim", "as a first claim and not as the anomaly");
  assert.equal(held.next, LEFT, "the line the release left is carried, no caller having named another");
  assert.equal(held.released, undefined, "and the new lease says nothing about having been given back");
});

/* The form dispatches on its own route and exits on its own line, so a give-back spent after the ordinary one alone misses every word this CLI performs through a verb — `forge develop` among them, which is the very move the case above is about (codex F1 of the plan). */
test("a verb reached through a form gives the lease back on the form's own route out", async () => {
  stands({});
  const parked = await ran(["park", "ISS-1617", "--kind", "paused", "--why", "the fixture parks it"], BUILDER);
  assert.equal(parked.status, 0, `the park should have gone through:\n${parked.stdout}${parked.stderr}`);
  assert.match(parked.stderr, /carried no lease/u, "the form's verb took the lease");
  assert.match(parked.stderr, /ISS-1617 is free again/u, "and the form's own route out gave it back");
  assert.equal(ISSUE.sessionContext.lease.holder, "", "so nothing holds the issue");
});

/* The other side of the same boundary: a field with no lease and no release in it is still the anomaly it was, refused in the same words. */
test("a field emptied by something other than a release is refused exactly as it was", async () => {
  stands({ lease: { next: LEFT, history: [] } }, "developed");
  const refused = await ran(["claim", "ISS-1617"], JUDGE);
  assert.equal(refused.status, 1, `still refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /lease field holds no lease/u, "in the words it always used");
  assert.match(refused.stderr, /forge claim ISS-1617 --unheld/u, "naming the same command");
});
