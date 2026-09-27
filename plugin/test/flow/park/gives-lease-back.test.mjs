/* A park sets the issue down, so the run that wrote it has ended its turn there, and the lease it
   held goes back as the call ends. Before this the lease stood for its whole duration, and the run
   dispatched to the parked issue next held an id minted for that same issue, which the claim reads as
   a run at work: refused, with `--stopped` and `--unheld` refused alike, until the clock ran out. Every
   run below carries the one pid a dispatching session hands all its agents, because that is where it
   was met, and a pid that matches proves nothing about which run is alive (ISS-2679). */
import assert from "node:assert/strict";
import test from "node:test";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("gives-lease-back").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("gives-lease-back-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "gives-lease-back-uuid";
const PARKER = "iss-2679-1418bd58";
const NEXT = "iss-2679-6fe2fa74";
/* Alive for as long as the suite runs, so no reading of it can call the holder gone. */
const PID = String(process.pid);

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-2679",
  title: "a park gives its lease back",
  description: "no mark here",
};

let clock = 0;
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (state.refuse?.[args.action]) return { refused: state.refuse[args.action] };
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") Object.assign(ISSUE, args.data);
      if (args.action === "transition") ISSUE.status = args.data.status;
      return { ...ISSUE };
    },
    forge_comments: (args) => {
      const held = state.comments[UUID];
      if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
      clock += 1;
      const one = { documentId: `comment-${clock}`, authorId: "agent", authorDeviceId: "a-device",
        createdAt: `2026-09-27T04:${String(clock).padStart(2, "0")}:00.000Z`, body: args.data.body };
      held.push(one);
      return one;
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
test.after(() => tracker.close());

const ran = (argv, who) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: who, CLAUDE_PID: PID });

/* Each case starts from a live lease of the parking run's own, claimed a minute ago for an hour. */
const heldBy = (holder) => {
  ISSUE.status = "confirmed";
  state.comments[UUID] = [];
  const at = new Date(Date.now() - 60_000).toISOString();
  ISSUE.sessionContext = {
    lease: { holder, agent: "a-test-agent", pid: PID, renewedAt: at, minutes: 60,
      next: null, history: [{ holder, at, how: "claim", status: "confirmed", next: null }] },
  };
};

const WHY = "blocked on the change the other issue is landing";
const parkedByAdvance = (extra = []) =>
  ran(["advance", "ISS-2679", "--park", "blocked", "--why", WHY, ...extra], PARKER);
const lease = () => ISSUE.sessionContext.lease;

test("a park through advance gives the parking run's lease back as the call ends", async () => {
  heldBy(PARKER);
  const parked = await parkedByAdvance();
  assert.equal(parked.status, 0, `the park should have gone through:\n${parked.stdout}${parked.stderr}`);
  assert.equal(ISSUE.status, "on_hold", "the park moved the status");
  assert.equal(lease().holder, "", "and nothing holds the issue afterwards");
  assert.ok(lease().released, "the field records that the lease was given back rather than lost");
  assert.match(parked.stderr, /ISS-2679 is free again: the turn this run held is over, and the lease it was held under went back with it/u,
    "and the parking call says so to its caller");
});

test("a park record through record gives the parking run's lease back as the call ends", async () => {
  heldBy(PARKER);
  const parked = await ran(["record", "park", "ISS-2679", "--kind", "blocked", "--why", WHY], PARKER);
  assert.equal(parked.status, 0, `the park record should have gone up:\n${parked.stdout}${parked.stderr}`);
  assert.ok(state.comments[UUID].some((one) => /forge-record: park/u.test(one.body)), "the record is on the page");
  assert.equal(lease().holder, "", "and nothing holds the issue afterwards");
  assert.ok(lease().released, "the field records that the lease was given back");
  assert.match(parked.stderr, /ISS-2679 is free again: the turn this run held is over/u);
});

test("the run dispatched to the issue after the park claims it at once, with no flag", async () => {
  heldBy(PARKER);
  const parked = await parkedByAdvance();
  assert.equal(parked.status, 0, `${parked.stdout}${parked.stderr}`);
  const claimed = await ran(["claim", "ISS-2679"], NEXT);
  assert.equal(claimed.status, 0, `the re-dispatched run should have claimed:\n${claimed.stdout}${claimed.stderr}`);
  assert.equal(lease().holder, NEXT, "the lease is the new run's");
  assert.equal(lease().pid, PID, "under the same pid the parked lease named");
  assert.equal(lease().history.at(-1).how, "claim", "an ordinary claim, neither a reclaim nor a handoff");
});

test("a live lease of another run dispatched to the same issue, with no park under it, still refuses the claim", async () => {
  heldBy(PARKER);
  const refused = await ran(["claim", "ISS-2679"], NEXT);
  assert.equal(refused.status, 1, `a run still working keeps the issue:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /already with a run it was handed to/u);
  assert.equal(lease().holder, PARKER, "and nothing was written over it");
});

test("a park whose move the tracker refuses leaves the parking run's lease standing", async () => {
  heldBy(PARKER);
  state.refuse = { transition: "TRANSITION_REASON_REQUIRED: a transition to `on_hold` must carry a reason" };
  const parked = await parkedByAdvance();
  delete state.refuse;
  assert.equal(parked.status, 1, `the park should have been refused:\n${parked.stdout}${parked.stderr}`);
  assert.equal(lease().holder, PARKER, "the run still owes the park, so the issue stays its own");
  assert.doesNotMatch(parked.stderr, /is free again/u);
});

test("a rehearsed park gives nothing back", async () => {
  heldBy(PARKER);
  const rehearsed = await parkedByAdvance(["--owed"]);
  assert.equal(rehearsed.status, 0, `${rehearsed.stdout}${rehearsed.stderr}`);
  assert.match(rehearsed.stdout, /Rehearsed, and nothing was written/u);
  assert.equal(lease().holder, PARKER, "the lease is where it was");
  assert.doesNotMatch(rehearsed.stderr, /is free again/u);
});

/* The third route a park is written by: the triage that rules the expectation outside the
   specification parks the issue from a plain advance, and that advance ends the turn as a typed park
   does. */
test("the park a triage routes a plain advance into gives the lease back too", async () => {
  heldBy(PARKER);
  Object.assign(ISSUE, {
    status: "developed",
    mergedAt: "2026-09-27T03:00:00.000Z",
    reopenCount: 0,
    plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
    acceptanceCriteria: "1. The list comes back in the order the criterion names.",
    attachments: [{ name: "shot.png" }],
    complexity: "m",
    relations: { blockedBy: [{ kind: "blocks", otherDisplayId: "ISS-197", otherStatus: "open", validUntil: null, expired: false }] },
  });
  const steps = [
    ["advance", "ISS-2679", "--reopen", "--why", "criterion 1 is not what the running change does"],
    ["record", "finding", "ISS-2679", "--criterion", "1", "--expected", "the order criterion 1 names",
      "--seen", "the order it was filed in", "--evidence", "shot.png"],
    ["record", "triage", "ISS-2679", "--outcome", "not-in-spec", "--would-have-caught", "a clause for the order"],
  ];
  for (const argv of steps) {
    const step = await ran(argv, PARKER);
    assert.equal(step.status, 0, `${argv.slice(0, 2).join(" ")}:\n${step.stdout}${step.stderr}`);
  }
  assert.equal(lease().holder, PARKER, "every step before the park kept the issue");
  const parked = await ran(["advance", "ISS-2679"], PARKER);
  assert.equal(parked.status, 0, `the routed park should have gone through:\n${parked.stdout}${parked.stderr}`);
  assert.equal(ISSUE.status, "on_hold", "the triage's route parked it");
  assert.equal(lease().holder, "", "and nothing holds the issue afterwards");
  assert.match(parked.stderr, /ISS-2679 is free again: the turn this run held is over/u);
});
