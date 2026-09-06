/* Every agent a session dispatches inherits that session's id, so a wave of runs is one lease holder
   and the refusal the lease exists for cannot fire between two of them (ISS-445). Both directions
   are pinned here: the refusal, which is reachable only once two runs are two ids, and the shared
   case, which is not refused and is told so instead. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("shared-holder").path;

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const SHARED = "the-dispatching-session";

const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [{
    documentId: "wave-uuid",
    issueId: "ISS-445",
    status: "open",
    title: "one wave, one holder",
    description: "no mark here",
  }],
  comments: { "wave-uuid": [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    /* A lease is read back after it is written, so the fixture keeps what a claim put on the issue. */
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update" || args.action === "transition") {
        state.issues[0] = { ...state.issues[0], ...args.data };
      }
      return state.issues[0];
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* The suite's own environment carries whatever dispatched it, so both variables are set by name. */
const asRun = (asked) => {
  const env = { ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", CLAUDE_CODE_SESSION_ID: SHARED };
  if (asked) env.FORGE_SESSION_ID = asked;
  else delete env.FORGE_SESSION_ID;
  return env;
};

const holder = () => state.issues[0].sessionContext?.lease?.holder ?? null;

/* Each case starts from the lease it is about, so no case is read through the one before it. */
const heldBy = (who, history = []) => {
  if (!who) delete state.issues[0].sessionContext;
  else {
    state.issues[0].sessionContext = {
      lease: {
        holder: who,
        agent: "a-test-agent",
        pid: "4242",
        renewedAt: new Date().toISOString(),
        minutes: 30,
        next: null,
        history,
      },
    };
  }
};
const takeLease = async (asked) => {
  /* The read-before-write gate sits inside the lease write and delivers what it has not shown, so a
     claim can meet it once and pass on the re-send. That hold is not this file's subject. */
  for (const again of [1, 2]) {
    const run = await ranAsync(FORGE, ["claim", "ISS-445"], asRun(asked));
    if (run.status === 0 || again === 2) return run;
  }
  return null;
};

test("a run holding its dispatcher's id is told the lease it matched names a wave, not a run", async () => {
  heldBy(null);
  const run = await takeLease(null);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(holder(), SHARED, "the claim went through, under the id the whole wave carries");
  assert.match(run.stdout, /every agent it dispatched carries the same value/u, run.stdout);
  assert.match(run.stdout, /no proof another run is not on this issue/u, "and what that costs");
  assert.match(run.stdout, /FORGE_SESSION_ID/u, "and the one thing that gives a run an id of its own");
});

/* The defect itself, pinned so it stays visible: the second run of a wave writes over the first and
   is refused nothing, because `stateOf` reads the holder it shares as its own. */
test("a second run of the same wave takes the lease unrefused", async () => {
  heldBy(SHARED);
  const run = await takeLease(null);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(holder(), SHARED);
  assert.doesNotMatch(run.stdout, /is claimed/u, "nothing refused it, which is what an id per run fixes");
});

test("two runs given ids of their own refuse each other", async () => {
  heldBy(null);
  const first = await takeLease("run-one");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(holder(), "run-one");
  assert.doesNotMatch(first.stdout, /every agent it dispatched/u, "a run with its own id is told nothing");
  const second = await ranAsync(FORGE, ["claim", "ISS-445"], asRun("run-two"));
  assert.equal(second.status, 1, second.stdout);
  assert.match(second.stderr, /ISS-445 is claimed/u, second.stderr);
  assert.match(second.stderr, /run-one/u, "and the refusal names the run holding it");
  assert.equal(holder(), "run-one", "and nothing of run two's was written");
});

/* Holder equality is half the test: another run's explicitly given id is not this reader's to call
   shared, whatever this reader's own id came from. */
test("the notice is about this reader's own id, and not about another run's", async () => {
  heldBy("run-one");
  const other = await ranAsync(FORGE, ["resume", "ISS-445"], asRun(null));
  assert.equal(other.status, 0, other.stderr);
  assert.doesNotMatch(other.stdout, /every agent it dispatched/u, other.stdout);
  heldBy(SHARED);
  const own = await ranAsync(FORGE, ["resume", "ISS-445"], asRun(null));
  assert.equal(own.status, 0, own.stderr);
  assert.match(own.stdout, /mine: session the-dispatching-session/u, "the state that reads as this run's");
  assert.match(own.stdout, /every agent it dispatched carries the same value/u, "and what it is really matching");
});

/* The notice sits above every route out of the claim: a claim that parks the issue as crashed
   returns before the advisory, and the run would take the lease told nothing about what it matched. */
test("a claim that parks the issue as crashed is still told what it matched on", async () => {
  const reclaims = [1, 2, 3].map((one) => ({ holder: SHARED, at: `2026-09-0${one}T10:00:00.000Z`, how: "reclaim", status: "open" }));
  heldBy(SHARED, reclaims);
  const run = await takeLease(null);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /every agent it dispatched carries the same value/u, run.stdout);
  assert.match(run.stdout, /on_hold/u, "and the park that returns before the advisory still happened");
});
