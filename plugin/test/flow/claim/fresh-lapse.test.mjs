/* A lease is renewed by a write to the issue and by nothing else, so a run inside a gate and a run
   that has died leave one record: the reclaim that took ISS-1216 off a live run was correct on every
   fact the record held. While the lapse is younger than the duration the holder named, the reclaim
   is therefore refused and the taker says it has established the run stopped (ISS-1224). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, standsInNoTree, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("fresh-lapse").path;
standsInNoTree("fresh-lapse");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "lapsing-uuid";
const OURS = "the-reclaiming-run";
const THEIRS = "the-run-that-may-be-working";
const LEFT = "Phase 5: the gate, then the verdicts";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1224",
  status: "in_progress",
  title: "a run working and not writing",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "m",
};

/* Each case starts from the lease it is about, so no case reads through the one before it. */
const heldBy = (holder, since, minutes, line = LEFT) => {
  ISSUE.sessionContext = {
    lease: { holder, agent: "a-test-agent", pid: "4242", renewedAt: ago(since), minutes, next: line, history: [] },
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

const claim = (argv, who = OURS) => ranAsync(FORGE, ["claim", "ISS-1224", ...argv], { ...tracker.env, FORGE_SESSION_ID: who });
const wrote = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update")
  .map((one) => one.args.data?.sessionContext?.lease);

test("a reclaim of a lease that has only just lapsed is refused, and the flag is what takes it", async () => {
  /* Ninety minutes of a sixty-minute lease: thirty past expiry, which is less than the sixty the
     holder named, so the record cannot yet tell a run in a gate from one that stopped. */
  heldBy(THEIRS, 90, 60);
  const before = state.calls.length;
  const refused = await claim([]);
  assert.equal(refused.status, 1, `the reclaim should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, new RegExp(`session ${THEIRS}`, "u"), "the refusal names the holder");
  assert.match(refused.stderr, /ran out 30 minute\(s\) ago/u, "and how long ago the lease ran out");
  assert.match(refused.stderr, /forge claim ISS-1224 --stopped/u, "and the one command that clears it");
  assert.match(refused.stderr, new RegExp(`The step it left named: ${LEFT}`, "u"), "and the line the holder left");
  assert.match(refused.stderr, /renewed only by a write the CLI makes to the issue/u,
    "and what a lapse of that age does not prove, which is the whole of why it is refused");
  assert.deepEqual(state.calls.slice(before).filter((one) => one.args?.action === "update"), [],
    "and the field is left holding exactly what the refusal read");

  const taken = await claim(["--stopped"]);
  assert.equal(taken.status, 0, `--stopped should have taken it:\n${taken.stdout}${taken.stderr}`);
  assert.match(taken.stdout, new RegExp(`ISS-1224  reclaim: session ${OURS}`, "u"), "as an ordinary reclaim");
  assert.equal(wrote().at(-1)?.history.at(-1)?.how, "reclaim",
    "appending the reclaim to the claim history exactly as one needing no flag does");
});

test("a lease lapsed by its own duration or more is anybody's again, with no flag at all", async () => {
  heldBy(THEIRS, 120, 60);
  const run = await claim([]);
  assert.equal(run.status, 0, `a lapse of a whole duration needs no flag:\n${run.stdout}${run.stderr}`);
  assert.match(run.stdout, new RegExp(`reclaim: session ${OURS}`, "u"));
  assert.doesNotMatch(run.stderr, /--stopped/u, "and nothing asks for one");
});

test("a holder retaking its own lapsed lease is not refused and needs no flag", async () => {
  heldBy(OURS, 90, 60);
  const run = await claim([]);
  assert.equal(run.status, 0, `the holder's own lapsed lease is its own:\n${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stderr, /--stopped/u, "a reclaim is a handoff and this is none");
});

test("a claim that names no minutes takes the default, and the holder's own claim keeps what it named", async () => {
  heldBy(THEIRS, 120, 45);
  await claim([]);
  assert.equal(wrote().at(-1)?.minutes, 60, "a lease that is not this run's falls back to the default");
  await claim([]);
  assert.equal(wrote().at(-1)?.minutes, 60, "and this run's own claim keeps the duration that lease carried");
  heldBy(OURS, 10, 180);
  await claim([]);
  assert.equal(wrote().at(-1)?.minutes, 180, "including one it asked for, which no default overwrites");
});
