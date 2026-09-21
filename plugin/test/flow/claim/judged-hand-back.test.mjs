/* The judge's own exit, through the verb. A judge whose verdicts come before any landing holds a lease it claimed by hand and stands at no checkpoint, so what proves the hand-back is the next run's claim rather than the field: a lease that lapsed on its own clock and one a run gave back read the same to anyone who only looks at the holder. The case the issue turns on is the one with no checkpoint at all, which is the state the older hand-back refused (ISS-1429). */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("judged-hand-back").path;
/* Away from this checkout, whose git directory names the run this suite is written under: a
   checkout of its own names none, and its project is a record beside the machine's own keys
   rather than a file in the tree. */
const AWAY = projectRoom(tempRoom("judged-hand-back-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "judged-hand-back-uuid";
const BUILDER = "the-run-that-built-the-change";
const JUDGE = "the-run-that-judged-it";
const AFTER = "the-run-that-comes-next";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1429",
  status: "developed",
  title: "a judge that has finished releases the lease in one verb",
  description: "no mark here",
};

const BUILT = {
  state: "qa-owed",
  builder: BUILDER,
  branch: "iss-1429",
  head: "9e24c2af0000000000000000000000000000abcd",
  base: "c4890050000000000000000000000000000dcba",
  files: ["plugin/src/flow/claim.mjs"],
  at: "2026-09-16T12:00:00.000Z",
};

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update" || args.action === "transition") Object.assign(ISSUE, args.data);
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

/* Each case starts from the field it is about, so no case reads through the one before it. */
const stands = (context) => {
  ISSUE.status = "developed";
  ISSUE.sessionContext = context;
  state.comments[UUID] = [];
};

const lease = (holder) => ({
  holder, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(),
  minutes: 45, next: null, history: [{ holder, at: new Date().toISOString(), how: "claim", status: "developed" }],
});

/* The case the issue is for: no checkpoint, so no turn and nothing for the older refusal to read. The lease is the whole of what the judge holds, and the assertion that carries it is the run after getting the issue with no wait and no flag. */
test("a judge standing at no checkpoint hands back, and the run after it claims with no wait and no flag", async () => {
  stands({ lease: lease(JUDGE) });
  const done = await ran(["claim", "ISS-1429", "--judged"], JUDGE);
  assert.equal(done.status, 0, `the hand-back should have gone through:\n${done.stdout}${done.stderr}`);
  assert.match(done.stdout, /no landing checkpoint, so no turn was moved and none was written/u,
    "saying what it did rather than refusing for the state it did not find");
  assert.match(done.stderr, /ISS-1429 is free again/u, "and the lease went back with the turn");
  assert.equal(ISSUE.sessionContext.landing, undefined, "an absent checkpoint stays absent");
  assert.equal(ISSUE.sessionContext.lease.holder, "", "so nothing holds the issue");
  assert.deepEqual(ISSUE.sessionContext.lease.history.map((one) => one.how), ["claim"],
    "and the release is not a reclaim, so it adds no row of its own");

  const next = await ran(["claim", "ISS-1429"], AFTER);
  assert.equal(next.status, 0, `the run after it should have claimed:\n${next.stdout}${next.stderr}`);
  assert.doesNotMatch(next.stderr, /--unheld/u, "with no flag asserting a run died on it");
  assert.doesNotMatch(next.stderr, /--stopped/u, "and none asserting a run was stopped");
});

/* The state that always worked keeps working, and gains the give-back: the checkpoint still moves, so the landing reads a judgement rather than an empty field where one was owed. */
test("a hand-back at qa-owed moves the checkpoint to judged and gives the lease back too", async () => {
  stands({ lease: lease(JUDGE), landing: { ...BUILT } });
  const done = await ran(["claim", "ISS-1429", "--judged"], JUDGE);
  assert.equal(done.status, 0, `the hand-back should have gone through:\n${done.stdout}${done.stderr}`);
  assert.equal(ISSUE.sessionContext.landing.state, "judged", "the turn moved to the state the table names");
  assert.equal(ISSUE.sessionContext.landing.judge, JUDGE, "under the judge that answered for it");
  assert.match(done.stderr, /ISS-1429 is free again/u, "and the lease went back");
  assert.equal(ISSUE.sessionContext.lease.holder, "", "so nothing holds the issue");
});

/* A release is a write, and a write on another run's issue is that run's. */
test("a hand-back by a run that is not the holder is refused naming the holder", async () => {
  stands({ lease: lease(JUDGE) });
  const refused = await ran(["claim", "ISS-1429", "--judged"], AFTER);
  assert.equal(refused.status, 1, `it should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, new RegExp(`held by another run: session ${JUDGE}`, "u"),
    "naming the run whose turn it would have ended");
  assert.equal(ISSUE.sessionContext.lease.holder, JUDGE, "and nothing was given back");
});

/* The other side of the same guard: a run holding nothing has no turn to end, and asking for one would free whatever run does hold the issue. */
test("a hand-back on an issue no run holds is refused naming the claim that takes it", async () => {
  stands({ lease: { holder: "", next: null, history: [] } });
  const refused = await ran(["claim", "ISS-1429", "--judged"], JUDGE);
  assert.equal(refused.status, 1, `it should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /forge claim ISS-1429 --unheld/u, "naming the claim that takes an issue nobody is on");
  assert.doesNotMatch(refused.stderr, /is free again/u, "and nothing was released");
});

/* The two facts a judge needs before it types the verb, on the flag's own line and not in prose below it: this help is within bytes of the cap the suite holds every verb to, so what carries them has to be the line that is there anyway. */
test("forge claim -h says --judged takes a checkpoint or none, and gives the lease back", async () => {
  const help = await ran(["claim", "-h"], JUDGE);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--judged +the QA turn handed back, from `qa-owed` or from none, and the lease with it/u,
    "the flag's own line carries the state it takes, the absence of one, and the lease");
});

/* The one arm that queues the give-back having written nothing before it: the settling write skips the check every other write of this process has already spent, so before ISS-1715 the hook was what delivered here, and the hook now stands down for this shape. */
test("a hand-back with no checkpoint delivers the comments it owes, and hands back anyway", async () => {
  stands({ lease: lease(JUDGE) });
  state.comments[UUID] = [{
    documentId: "c-unread",
    createdAt: "2026-09-17T09:00:00.000Z",
    body: "a person answered after the verdicts went up",
  }];
  const done = await ran(["claim", "ISS-1429", "--judged"], JUDGE);
  assert.equal(done.status, 0, `the hand-back should have gone through:\n${done.stdout}${done.stderr}`);
  assert.ok(done.stderr.includes("a person answered after the verdicts went up"),
    `the comment itself, ahead of the hand-back's own answer:\n${done.stderr}`);
  assert.match(done.stdout, /no landing checkpoint, so no turn was moved and none was written/u,
    "and the write it was owed for went through in the same call");
});
