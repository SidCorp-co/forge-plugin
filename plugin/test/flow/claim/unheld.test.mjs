/* A status past the ones a run is dispatched at was reached by writes a lease covered, so a field
   holding no readable lease is a run that died or a write that erased one — never an issue nobody
   has started. The claim is refused there, and the flag that takes it is not the fresh lapse's:
   that one says a named holder stopped, and here the record names none (ISS-1184). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, standsInNoTree, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("unheld").path;
standsInNoTree("unheld");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "unheld-uuid";
const OURS = "the-run-that-arrived-second";
const THEIRS = "the-run-whose-lease-is-gone";
const LEFT = "Phase 5: the verdicts, then the landing";
const BRANCH = "iss-1184-the-branch-the-first-run-cut";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1184",
  status: "in_progress",
  title: "a lease field with nothing in it",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "m",
};

/* Each case starts from the field it is about, so no case reads through the one before it. */
const fieldHolds = (context, status = "in_progress") => {
  ISSUE.sessionContext = context;
  ISSUE.status = status;
};

const remnant = (next) => ({ lease: { ...(next ? { next } : {}), history: [] } });

const work = (branch) => ({
  worklog: { branch, head: "0f1e2d3c4b5a69788796a5b4c3d2e1f009182736", base: "9182736450a1b2c3d4e5f60718293a4b5c6d7e8f", at: ago(20) },
});

const heldBy = (holder, since, minutes) => ({
  lease: { holder, agent: "a-test-agent", pid: "4242", renewedAt: ago(since), minutes, next: LEFT, history: [] },
});

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

const claim = (argv, who = OURS) => ranAsync(FORGE, ["claim", "ISS-1184", ...argv], { ...tracker.env, FORGE_SESSION_ID: who });
const wrote = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update")
  .map((one) => one.args.data?.sessionContext?.lease);

test("a claim on an issue past the dispatch statuses with no lease at all is refused, and the flag is what takes it", async () => {
  fieldHolds({ ...remnant(LEFT), ...work(BRANCH) });
  const before = state.calls.length;
  const refused = await claim([]);
  assert.equal(refused.status, 1, `the claim should have been refused:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /at `in_progress`/u, "the refusal names the status it read");
  assert.match(refused.stderr, /lease field holds no lease/u, "and says the record holds none where one is expected");
  assert.match(refused.stderr, new RegExp(`The step the last write named: ${LEFT}`, "u"),
    "and the line the emptied field still carries");
  assert.match(refused.stderr, new RegExp(`work: ${BRANCH}`, "u"), "and the branch the worklog still names");
  assert.match(refused.stderr, /cut from 9182736/u, "in the sentences the claim's own opening prints it in");
  assert.match(refused.stderr, /forge claim ISS-1184 --unheld\s*$/u,
    "and the one command that clears it, with no second flag beside it");
  assert.deepEqual(state.calls.slice(before).filter((one) => one.args?.action === "update"), [],
    "and the field is left holding exactly what the refusal read");

  const taken = await claim(["--unheld"]);
  assert.equal(taken.status, 0, `--unheld should have taken it:\n${taken.stdout}${taken.stderr}`);
  assert.match(taken.stdout, new RegExp(`ISS-1184  unheld: session ${OURS}`, "u"), "as a claim of its own kind");
  assert.equal(wrote().at(-1)?.history.at(-1)?.how, "unheld",
    "which is the word the claim history keeps, so a fold can count how often the anomaly was real");
  assert.match(taken.stdout, new RegExp(`Next, left by the run before: ${LEFT}`, "u"),
    "and the line the refusal printed is not lost by the flag that clears it");
});

test("a worklog naming no branch is said to name none rather than printed empty", async () => {
  fieldHolds(remnant(null));
  const refused = await claim([]);
  assert.equal(refused.status, 1, `still refused with nothing to point at:\n${refused.stdout}${refused.stderr}`);
  assert.match(refused.stderr, /the worklog names no branch/u, "and the record's silence is said");
  assert.doesNotMatch(refused.stderr, /The step the last write named/u, "as is a field carrying no line");
});

test("a first claim at each status a run is dispatched at is unchanged, and asks for no flag", async () => {
  for (const status of ["open", "confirmed", "approved", "reopen"]) {
    fieldHolds({}, status);
    const run = await claim([]);
    assert.equal(run.status, 0, `a first claim at ${status} is the ordinary case:\n${run.stdout}${run.stderr}`);
    assert.doesNotMatch(run.stderr, /--unheld/u, `and nothing asks for the flag at ${status}`);
    assert.equal(wrote().at(-1)?.history.at(-1)?.how, "claim",
      `which the history calls a claim at ${status} and not the anomaly`);
  }
});

test("the flag clears this refusal and neither of the other two", async () => {
  fieldHolds(heldBy(THEIRS, 10, 60));
  const live = await claim(["--unheld"]);
  assert.equal(live.status, 1, `a live lease is another run's whatever this flag says:\n${live.stdout}`);
  assert.match(live.stderr, /is claimed/u, "and it is refused as any second run's claim is");

  fieldHolds(heldBy(THEIRS, 90, 60));
  const lapsed = await claim(["--unheld"]);
  assert.equal(lapsed.status, 1, `a lapse this fresh is the other flag's:\n${lapsed.stdout}`);
  assert.match(lapsed.stderr, /forge claim ISS-1184 --stopped/u, "which the refusal names and this flag is not");
});

test("the help says what the flag asserts", async () => {
  const help = await ranAsync(FORGE, ["claim", "-h"], tracker.env);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--unheld\s+.*no run is on/u, "so a caller reads what typing it claims");
});
