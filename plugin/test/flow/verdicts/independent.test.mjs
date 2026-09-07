/* Where a project asks for a second judge, what earns `tested` is a set of verdicts somebody other
   than the builder wrote against what the deployment reported running. Two fence values decide
   whether the rule is worth anything: a verdict carrying no judge must count for nothing rather
   than pass unnoticed, and the identity has to be cited off the evidence rather than off the
   commit — under route after-merge the deployment identity is the merged head, so a commit read
   would let an ordinary builder verdict satisfy this by accident (ISS-673). */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-independent").path;
const { render } = await import("../../../src/flow/record.mjs");
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");
const { judgeProblem, voidedBy } = await import("../../../src/flow/qa/verdicts.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const MOVED = "3cd76450000000000000000000000000000000ef";
const AT = "2026-09-07T12:00:00.000Z";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const CHECKPOINT = {
  state: "judged",
  builder: BUILDER,
  branch: "iss-673-8",
  head: MERGED,
  base: "6e4ecb10000000000000000000000000000000ff",
  candidate: DEPLOYED,
  deployment: DEPLOYED,
  files: ["plugin/src/flow/earned.mjs"],
  at: AT,
};
const INDEPENDENT = releaseFrom({
  baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: true, qa: "independent" },
});
const BUILDER_JUDGES = releaseFrom({
  baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: true, qa: "builder" },
});

let clock = 0;
const at = () => `2026-09-07T13:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });
const mark = () => comment(`mark_merged target=base — merged to master at ${MERGED}`);
const verdictOf = (number, over = {}) =>
  ({ criterion: `${number} — text`, verdict: "pass", commit: MERGED, evidence: [DEPLOYED], judge: QA, ...over });

const issueOf = (over = {}) => ({
  acceptanceCriteria: CRITERIA,
  plan: PLAN,
  mergedAt: AT,
  attachments: [],
  sessionContext: { landing: CHECKPOINT },
  ...over,
});
const items = (verdicts, { release = INDEPENDENT, issue = {} } = {}) =>
  CHECKS.tested(
    viewFrom("the-uuid", issueOf(issue), [mark(), comment(render("verdict", verdicts))], null, release),
    "ISS-8",
  );
const owed = (...args) => items(...args).map((one) => one.what);

test("a verdict carrying the builder's own id earns nothing where the project asks for a second judge", () => {
  const said = owed([verdictOf(1, { judge: BUILDER }), verdictOf(2, { judge: BUILDER })]);
  assert.deepEqual(said, [
    "the verdict on criterion 1 carries the builder's own id `the-builder-session`",
    "the verdict on criterion 2 carries the builder's own id `the-builder-session`",
  ], "one item per verdict, each naming the id that disqualified it");
});

/* The bug a green suite hides: `judge` is `newer`, so a verdict without one is a whole payload by
   every other reading, and a rule that only compared ids would let it through. */
test("a verdict with no judge at all counts for nothing rather than passing unnoticed", () => {
  const one = verdictOf(1);
  delete one.judge;
  assert.deepEqual(owed([one, verdictOf(2)]),
    ["the verdict on criterion 1 carries no judge, so nothing on it says which session wrote it"]);
});

/* The other fence: the merged head is on every verdict already, so citing the deployment identity
   has to be a citation and not a coincidence. */
test("a verdict citing the merged head and not what was deployed has cited nothing", () => {
  assert.deepEqual(owed([verdictOf(1, { evidence: [MERGED] }), verdictOf(2)]),
    [`the verdict on criterion 1 cites nothing at ${DEPLOYED.slice(0, 7)}, which is what the deployment `
      + "reported running"]);
  assert.deepEqual(owed([verdictOf(1, { evidence: [MERGED, DEPLOYED.slice(0, 7)] }), verdictOf(2)]), [],
    "and a seven-digit citation of the same identity is the same citation");
});

test("an attachment named after the deployment is not a citation of it", () => {
  const named = `${DEPLOYED}-notes.txt`;
  assert.deepEqual(
    owed([verdictOf(1, { evidence: [named] }), verdictOf(2)], { issue: { attachments: [{ name: named }] } }),
    [`the verdict on criterion 1 cites nothing at ${DEPLOYED.slice(0, 7)}, which is what the deployment `
      + "reported running"],
    "a forty-digit name is held evidence and would otherwise decide the comparison's width, passing on its own prefix",
  );
});

test("every standing verdict judged by the QA session and citing the deployment earns tested", () => {
  assert.deepEqual(owed([verdictOf(1), verdictOf(2)]), []);
});

/* The half kept as regression coverage rather than as a criterion: a project that asks for no
   second judge is where it always was, and a judge-less verdict there is no shortfall. */
test("where the project asks for no second judge, the builder's own verdicts earn tested", () => {
  const one = verdictOf(1, { judge: BUILDER, evidence: [MERGED] });
  const two = verdictOf(2);
  delete two.judge;
  assert.deepEqual(owed([one, two], { release: BUILDER_JUDGES }), []);
  assert.deepEqual(owed([one, two], { release: null }), [], "and an unread policy asks for nothing");
});

/* A shared session id resolves to one string for two runs, so the builder and the QA run compare
   equal and the check refuses — which is the answer, not a miss. */
test("a QA run inheriting the builder's id is refused, because nothing tells the two apart", () => {
  assert.deepEqual(owed([verdictOf(1, { judge: BUILDER }), verdictOf(2, { judge: BUILDER })],
    { issue: { sessionContext: { landing: { ...CHECKPOINT, builder: BUILDER } } } }).length, 2);
});

test("no checkpoint means nothing names the builder or the deployment, and the check says so", () => {
  const said = owed([verdictOf(1), verdictOf(2)], { issue: { sessionContext: null } });
  assert.deepEqual(said, [
    "the verdict on criterion 1 has no landing checkpoint naming a builder and a deployment identity to judge it against",
    "the verdict on criterion 2 has no landing checkpoint naming a builder and a deployment identity to judge it against",
  ]);
  const half = owed([verdictOf(1), verdictOf(2)],
    { issue: { sessionContext: { landing: { ...CHECKPOINT, deployment: undefined } } } });
  assert.equal(half.length, 2, "a checkpoint with no deployment identity is no checkpoint for this reading");
  const asked = items([verdictOf(1), verdictOf(2)], { issue: { sessionContext: null } });
  assert.deepEqual([...new Set(asked.map((one) => one.command))], ["forge resume ISS-8"],
    "and the ask is not another verdict, which cannot produce the checkpoint that is missing");
});

/* The same reading inverted, which is what a promotion spends: the identity is what moves when the
   base or the batch does, so every verdict still citing the old one is void. */
test("verdicts citing an identity the checkpoint no longer holds are named void", () => {
  const view = viewFrom("the-uuid", issueOf(), [mark(), comment(render("verdict", [verdictOf(1), verdictOf(2)]))],
    null, INDEPENDENT);
  assert.deepEqual(voidedBy(CHECKPOINT, view.verdicts, INDEPENDENT), [], "nothing moved, so nothing is void");
  assert.deepEqual(
    voidedBy({ ...CHECKPOINT, deployment: MOVED, candidate: MOVED }, view.verdicts, INDEPENDENT), [1, 2],
    "the candidate was redeployed, so both QA verdicts are void",
  );
  const builders = viewFrom("the-uuid", issueOf(),
    [mark(), comment(render("verdict", [verdictOf(1, { judge: BUILDER })]))], null, INDEPENDENT);
  assert.deepEqual(voidedBy({ ...CHECKPOINT, deployment: MOVED }, builders.verdicts, INDEPENDENT), [],
    "and a verdict that was never a QA verdict is not void: it never stood");
});

/* The promotion's own fence value: a successor builder's id differs from the checkpoint's, and its
   verdicts cite no deployment because nobody asked them to — void by every reading but the one. */
test("a project that asked for no judge has no void verdicts to name", () => {
  const view = viewFrom("the-uuid", issueOf(),
    [mark(), comment(render("verdict", [verdictOf(1, { judge: "the-successor-session" })]))],
    null, BUILDER_JUDGES);
  assert.deepEqual(voidedBy({ ...CHECKPOINT, deployment: MOVED, candidate: MOVED }, view.verdicts, BUILDER_JUDGES),
    [], "or a resumed builder's verdicts would refuse a promotion on a project with no QA at all");
  assert.deepEqual(voidedBy({ ...CHECKPOINT, deployment: MOVED }, view.verdicts, null), [],
    "and a project whose config did not answer is judged as one that decided nothing");
});

test("the problem a verdict has is one reading, so a caller outside the check reads the same answer", () => {
  assert.equal(judgeProblem(verdictOf(1), CHECKPOINT), null);
  assert.match(judgeProblem(verdictOf(1, { judge: BUILDER }), CHECKPOINT), /the builder's own id/u);
});

/* Spawned from here: what a project's `qa` line changes is what `forge advance` does, and only the
   verb reads the policy off the tracker. Two sessions write on one issue, each under its own lease,
   and the judge on each verdict is the one the CLI resolved rather than one a fixture supplied. */
const judging = {
  documentId: "judging-uuid",
  issueId: "ISS-8",
  status: "developed",
  title: "the change two sessions judged",
  description: "no mark here",
  plan: PLAN,
  acceptanceCriteria: CRITERIA,
  mergedAt: AT,
  attachments: [],
  sessionContext: { landing: CHECKPOINT },
};
const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: true, qa: "independent" } },
  issues: [judging],
  comments: { "judging-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return judging;
  if (args.action === "update" || args.action === "transition") return Object.assign(judging, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const held = state.comments[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  }
  const held = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${held.length}`;
  held.push({ documentId: id, createdAt: at(), body: args.data?.body });
  return { documentId: id };
};
const tracker = await fakeTracker(state);
after(() => tracker.close());

const asks = (holder) => (...argv) => ranAsync(FORGE, argv, { ...tracker.env, FORGE_SESSION_ID: holder });
const builder = asks(BUILDER);
const qa = asks(QA);
/* The lease is the only thing between two sessions here: a lapsed one is the next run's to reclaim,
   which is what the handoff at `qa-owed` does once a session can prove it is the QA run. */
const lapse = () => {
  judging.sessionContext.lease.renewedAt = "2026-09-07T09:00:00.000Z";
};

state.comments["judging-uuid"].push({
  documentId: "the-mark",
  createdAt: at(),
  body: `mark_merged target=base — merged to master at ${MERGED}`,
});
before(async () => {
  await builder("claim", "ISS-8");
  const claimed = await builder("claim", "ISS-8");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("advance to tested is refused while the standing verdicts are the builder's own", async () => {
  const wrote = await builder("record", "verdict", "ISS-8", "--commit", MERGED, "--evidence", DEPLOYED,
    "--verdict", "pass", "--criterion", "1", "--criterion", "2");
  assert.equal(wrote.status, 0, wrote.stderr);
  const run = await builder("advance", "ISS-8");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(judging.status, "developed", "and nothing moved");
  const said = `${run.stdout}\n${run.stderr}`;
  assert.match(said, /criterion 1 carries the builder's own id/u, said);
  assert.match(said, /criterion 2 carries the builder's own id/u, said);
  assert.match(said, /forge record verdict ISS-8 --criterion 1 [^\n]*--evidence 9e24c2a/u,
    "and the item carries the write that answers it, citing the identity to judge against");
});

test("once the QA session has judged every criterion against the deployment, advance earns tested", async () => {
  lapse();
  /* The builder's own verdicts are comments this QA session has not been shown, so its first write
     is held to deliver them and the second is the one that takes the lapsed lease. */
  const held = await qa("claim", "ISS-8");
  assert.match(held.stderr, /has not been shown/u, "the page the builder judged is what the QA run reads first");
  const taken = await qa("claim", "ISS-8");
  assert.equal(taken.status, 0, taken.stderr);
  const wrote = await qa("record", "verdict", "ISS-8", "--commit", MERGED, "--evidence", DEPLOYED,
    "--verdict", "pass", "--criterion", "1", "--criterion", "2");
  assert.equal(wrote.status, 0, wrote.stderr);
  assert.equal(wrote.stdout.match(new RegExp(`^judge: ${QA}$`, "gmu")).length, 2, wrote.stdout);
  const run = await qa("advance", "ISS-8");
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.equal(judging.status, "tested", "the record earned it, so the verb moved it");
});
