/* A lease refused for the whole of its duration by a run nothing was holding: ten filings of one
   cause, every one of them a pid the refusal itself printed and a `ps` that returned no row. The
   clock cannot separate a run in a gate from a run that has died, and the record can, so each case
   below either takes the lease on that proof or leaves it to the clock exactly as before (ISS-919). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, standsInNoTree, tempHome } from "../../fixtures.mjs";
import { placeOf } from "../../../src/flow/lease/holder.mjs";
import { stateOf } from "../../../src/flow/lease.mjs";

process.env.XDG_CONFIG_HOME = tempHome("gone-holder").path;
standsInNoTree("gone-holder");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "gone-holder-uuid";
const OURS = "the-run-dispatched-after-the-crash";
const THEIRS = "the-dispatcher-that-exited";
const LEFT = "Phase 4: the branch is cut, start at the probe";
const HERE = placeOf();

/* An id nothing on this box answers to, found rather than guessed: a number that happened to be in
   use would prove the opposite of what every case below needs it to. */
const goneId = () => {
  for (let id = 4_194_301; id > 4_000_000; id -= 7) {
    try {
      process.kill(id, 0);
    } catch (error) {
      if (error.code === "ESRCH") return String(id);
    }
  }
  throw new Error("no absent process id on this box, which is not a state this suite can run in");
};

const GONE = goneId();
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-919",
  status: "approved",
  title: "a lease held by a run that is not there",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "m",
};

/* Each case starts from the lease it is about, so no case reads through the one before it. The lease
   is inside its own duration throughout: a lapse would reach the reclaim by the clock and prove
   nothing about the probe. */
const heldBy = ({ pid = GONE, place = HERE, history = [] } = {}) => {
  ISSUE.status = "approved";
  ISSUE.sessionContext = {
    lease: {
      holder: THEIRS, agent: "a-test-agent", renewedAt: ago(5), minutes: 60, next: LEFT, history,
      ...(pid === null ? {} : { pid }),
      ...(place === null ? {} : { place }),
    },
  };
};

const reclaimed = (at) => ({ holder: "a-run-before-this-one", at, how: "reclaim", status: "approved", next: null });

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
/* Read off the tracker after the call and not out of its output: the field is what a later run has. */
const onTheRecord = () => ISSUE.sessionContext.lease;

/* The state sits above both clock readings rather than inside either, because what it answers is the
   question a duration cannot: not when the lease ran out but whether anything is still holding it. */
test("the sixth state, which neither clock reading reaches and a run is never told of its own lease", () => {
  const clock = { holder: THEIRS, agent: "a-test-agent", renewedAt: ago(5), minutes: 60, next: null, history: [] };
  const gone = { ...clock, pid: GONE, place: HERE };
  assert.equal(stateOf(gone, OURS), "gone", "inside its duration, where the clock alone says live");
  assert.equal(stateOf({ ...gone, renewedAt: ago(500) }, OURS), "gone", "and past it, where the clock says expired");
  assert.equal(stateOf({ ...clock, pid: String(process.pid), place: HERE }, OURS), "live", "an id that answers");
  assert.equal(stateOf({ ...gone, place: "another-boot another-table" }, OURS), "live", "an id issued elsewhere");
  assert.equal(stateOf({ ...gone, holder: OURS }, OURS), "mine",
    "and a run is never told its own lease is gone, whatever it recorded as its process");
});

test("a claim on a lease whose holder the record proves gone is granted, and prints the id that proved it", async () => {
  heldBy();
  const took = await ran(["claim", "ISS-919"]);
  assert.equal(took.status, 0, `the record proves nobody is on it:\n${took.stdout}${took.stderr}`);
  assert.match(took.stdout, new RegExp(`Process id ${GONE}`, "u"),
    "the very number the refusal used to print, now printed as the proof it always was");
  assert.match(took.stdout, /not running where the lease was taken/u);
  assert.doesNotMatch(took.stderr, /is claimed/u, "and nothing was refused");
  assert.equal(onTheRecord().holder, OURS, "the lease is this run's on the record, not only in the output");
  assert.equal(onTheRecord().place, HERE, "and the claim records where it was taken, as the probe needs");
});

test("the take goes into the claim history as the reclaim it is", async () => {
  heldBy();
  const took = await ran(["claim", "ISS-919"]);
  assert.equal(took.status, 0, took.stderr);
  const row = onTheRecord().history.at(-1);
  assert.equal(row.how, "reclaim", "the word a lapse's reclaim writes, so what counts crashes counts this");
  assert.equal(row.status, "approved", "at the status the issue stood at");
  assert.match(took.stdout, /Reclaim 1 of approved/u, "and the count is read back to the caller");
});

test("the park that answers a status where runs keep dying counts this take among them", async () => {
  heldBy({ history: [reclaimed(ago(300)), reclaimed(ago(200))] });
  const took = await ran(["claim", "ISS-919"]);
  assert.equal(took.status, 0, took.stderr);
  assert.match(took.stdout, /kept crashing at approved/u,
    "the third reclaim of one status is a person's, whichever of the three proved its holder gone");
  assert.equal(ISSUE.status, "on_hold", "and the issue is parked on the tracker");
});

test("a payload write meeting that same lease takes it rather than being refused", async () => {
  heldBy();
  const wrote = await ran(["record", "correction", "ISS-919", "--moved", "the probe", "--why", "the holder is gone"]);
  assert.equal(wrote.status, 0, `one call should have written it:\n${wrote.stdout}${wrote.stderr}`);
  assert.doesNotMatch(wrote.stderr, /is held by another run/u, "with nothing sending the caller back for a claim");
  assert.match(wrote.stderr, new RegExp(`Process id ${GONE}`, "u"), "and the notice names what it took the lease on");
  assert.match(wrote.stderr, /whose holder the record proves gone/u,
    "rather than the sentence a lapse gets, this lease being inside its own duration");
  assert.equal(onTheRecord().history.at(-1).how, "reclaim", "and the history keeps it as a reclaim");
});

/* The other side of the same rule, and the half that keeps it safe: a reclaim taken on a doubt is the
   failure ISS-1224 was filed for, a live run's issue taken while it worked. Each of these passes
   before this change as well as after it, which is what they are here to keep true. */
test("nothing is proven where the place, the id or the probe leaves any doubt", async () => {
  for (const [why, lease] of [
    ["a lease recording nowhere in particular", { place: null }],
    ["a lease recording somewhere else", { place: "another-boot another-table" }],
    ["an id that answers here", { pid: String(process.pid) }],
    ["no id at all", { pid: null }],
    ["an id that is not a number", { pid: "unknown" }],
    ["an id this call may not signal", { pid: "1" }],
  ]) {
    heldBy(lease);
    const refused = await ran(["claim", "ISS-919"]);
    assert.equal(refused.status, 1, `${why}: the clock decides and the lease is live:\n${refused.stdout}${refused.stderr}`);
    assert.match(refused.stderr, /ISS-919 is claimed/u, why);
    assert.match(refused.stderr, /A live lease is that run's/u, why);
    assert.equal(onTheRecord().holder, THEIRS, `${why}: and nothing of this run's was written`);
  }
});

/* The dispatcher that exited is the one holder whose going is not a crash of this issue's: the record
   already calls that take a handoff, and charging it as a reclaim would walk the issue toward a park
   for a person that nothing died to earn. */
test("a run the issue was dispatched to takes a gone dispatcher's lease as the handoff the record calls it", async () => {
  heldBy({ history: [reclaimed(ago(300)), reclaimed(ago(200))] });
  const took = await ran(["claim", "ISS-919"], "iss-919-3ec73d70");
  assert.equal(took.status, 0, `the dispatched run's own take:\n${took.stdout}${took.stderr}`);
  assert.equal(onTheRecord().history.at(-1).how, "handed", "under the word a dispatch writes and not a reclaim's");
  assert.doesNotMatch(took.stdout, /Reclaim \d+ of approved/u, "so nothing is counted toward the park");
  assert.equal(ISSUE.status, "approved", "and the issue is not parked for a person");
  assert.match(took.stdout, new RegExp(`Process id ${GONE}`, "u"),
    "while the caller is still told what became of the run it took the lease from");
});
