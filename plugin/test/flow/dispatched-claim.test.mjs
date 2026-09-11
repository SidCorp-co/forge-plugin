/* The tree a dispatched run is given is cut for one issue, and the id in it names which — so the
   record identifies that run without a flag, and a dispatcher's lease over a finished triage write
   is not a wait it owes (ISS-1091). Each case below is one of the four conditions that refuse, or
   the take they leave. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, standsInNoTree, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("dispatched-claim").path;
standsInNoTree("dispatched-claim");

const { runFor } = await import("../../src/resolve/session/run-id.mjs");
const { mintRunId } = await import("../../../tools/run/workspace/run-id.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const UUID = "dispatched-uuid";
const RUNNER = "iss-1091-90f5a52f";
const DISPATCHER = "bc3ef73b-0e08-4e9d-869e-b2168403c7c0";
const LEFT = "triage only — nothing was worked under this lease";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1091",
  status: "confirmed",
  title: "a runner cannot claim the issue it was dispatched to work",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "s",
};

/* Each case starts from the whole session field it is about, so no case reads through the one
   before it and a landing left by one does not decide the next. */
const heldBy = (holder, { since = 1, minutes = 60, status = "confirmed", landing = null, history = [] } = {}) => {
  ISSUE.status = status;
  ISSUE.sessionContext = {
    lease: { holder, agent: "a-test-agent", pid: "4242", renewedAt: ago(since), minutes, next: LEFT, history },
    ...(landing ? { landing } : {}),
  };
};

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

const claim = (argv = [], who = RUNNER) =>
  ranAsync(FORGE, ["claim", "ISS-1091", ...argv], { ...tracker.env, FORGE_SESSION_ID: who });
const wrote = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update")
  .map((one) => one.args.data?.sessionContext?.lease);

test("a run dispatched to the issue takes a live lease its dispatcher is only holding", async () => {
  heldBy(DISPATCHER);
  const took = await claim();
  assert.equal(took.status, 0, `the dispatched run should have been given it:\n${took.stdout}${took.stderr}`);
  assert.match(took.stdout, new RegExp(`ISS-1091 {2}handed: session ${RUNNER}`, "u"),
    "under a word of its own, because a dispatch is not a dead run's lease reclaimed");
  assert.match(took.stdout, /was live and session bc3ef73b/u, "saying what it took and from whom");
  assert.match(took.stdout, new RegExp(`Next, left by the run before: ${LEFT}`, "u"));
  assert.equal(wrote().at(-1)?.history.at(-1)?.how, "handed");
});

test("a claim handed to the run the issue was dispatched to brings the crash park no closer", async () => {
  const handed = (at) => ({ holder: RUNNER, at, how: "handed", status: "confirmed", next: null });
  heldBy(DISPATCHER, { history: [handed("2026-09-11T01:00:00.000Z"), handed("2026-09-11T02:00:00.000Z")] });
  const third = await claim();
  assert.equal(third.status, 0, `a third handoff is not a third crash:\n${third.stdout}${third.stderr}`);
  assert.doesNotMatch(third.stdout, /parks the issue as crashed|kept crashing/u,
    "the count reads reclaims, and a run that never held the issue did not die at this status");
});

/* The wave case the lease exists for: two runners with trees of their own, both cut for this issue,
   and the second may not take the first's live lease however its own id reads. */
test("a live lease is refused where its holder is another run dispatched to the same issue", async () => {
  heldBy("iss-1091-cccccccc");
  const refused = await claim();
  assert.equal(refused.status, 1, `the wave case must still refuse:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /already with a run it was handed to/u);
  assert.match(refused.stderr, new RegExp(`The step it left named: ${LEFT}`, "u"),
    "and the refusal carries the holder's own line, which is what a caller decides on");
});

test("a live lease is refused where the claiming run's id names no issue, and names the way to one", async () => {
  heldBy(DISPATCHER);
  const refused = await claim([], "a-whole-wave-of-runs");
  assert.equal(refused.status, 1, `an id naming no issue proves no dispatch:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /names no run dispatched to ISS-1091/u);
  assert.match(refused.stderr, /forge-run-id beside that tree's git directory/u,
    "and the route out is the tree that was cut for it, not the claim that just failed");
});

test("a live lease is refused past the statuses a run is dispatched at", async () => {
  heldBy(DISPATCHER, { status: "in_progress" });
  const refused = await claim();
  assert.equal(refused.status, 1, `a lease at in_progress is a run at work:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /past the statuses a run is dispatched at/u);
});

/* The landing's turns are `--take`'s alone: an issue-bound id is affinity and would otherwise walk a
   builder straight past the checkpoint that handed its turn to somebody else. */
test("a live lease is refused while a landing checkpoint names a turn", async () => {
  heldBy("a-landing-session", { landing: { state: "candidate", builder: RUNNER, branch: "iss-1091", head: "a".repeat(40), base: "b".repeat(40), files: ["one.mjs"], at: ago(30) } });
  const refused = await claim();
  assert.equal(refused.status, 1, `the checkpoint governs here:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /names the lander's turn/u);
  assert.match(refused.stderr, /forge resume ISS-1091/u);
});

test("the holder's own claim on its own live lease renews it, whatever the status or the checkpoint says", async () => {
  heldBy(DISPATCHER, { status: "in_progress", landing: { state: "candidate", builder: "x", branch: "b", head: "a".repeat(40), base: "b".repeat(40), files: [], at: ago(30) } });
  const again = await claim([], DISPATCHER);
  assert.equal(again.status, 0, `a holder is never a second run:\n${again.stdout}${again.stderr}`);
  assert.match(again.stdout, /ISS-1091 {2}renewed:/u);
});

test("a fresh lapse is reclaimed with no flag by the run the issue was dispatched to", async () => {
  heldBy(DISPATCHER, { since: 90, minutes: 60 });
  const took = await claim();
  assert.equal(took.status, 0, `--stopped asks a dispatched run to establish what the dispatch said:\n${took.stdout}${took.stderr}`);
  assert.match(took.stdout, /ISS-1091 {2}reclaim:/u, "as a reclaim, the lease having genuinely run out");
  assert.doesNotMatch(took.stderr, /--stopped/u);
});

/* The two halves of the id are written by different trees of this repository, and nothing else ties
   them: the mint that makes one and the reader that spends it are asserted against each other here. */
test("an id the workspace mints for an issue is read back by the CLI as naming that issue", () => {
  const room = tempRoom("dispatched-mint-");
  mkdirSync(join(room, ".git"));
  const minted = mintRunId(room, "ISS-1091");
  assert.equal(runFor(minted), "iss-1091", `the mint made ${minted}, which the lease cannot place`);
  assert.equal(runFor("bc3ef73b-0e08-4e9d-869e-b2168403c7c0"), null, "and an opaque id names no issue");
  assert.equal(runFor("iss-1091"), null, "nor does a bare key, which no tree ever minted");
});
