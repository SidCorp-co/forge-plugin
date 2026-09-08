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
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");
const { judgeAsk, judgeProblem, judgedAt } = await import("../../../src/flow/qa/verdicts.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const LANDER = "the-lander-session";
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

/* What a void gives up, named to whoever judges again. Asked the other way round — which verdicts are
   stale against the identity held now — it named none of them at the one moment the list is wanted
   (ISS-673). That inverse had no caller once this one took the void's, and is `judgeProblem` per
   verdict where it is spent, so it is gone rather than kept for a reader that never arrived. */
test("the numbers a void names are the verdicts that judged the identity being given up", () => {
  const view = viewFrom("the-uuid", issueOf(), [mark(), comment(render("verdict", [verdictOf(1), verdictOf(2)]))],
    null, INDEPENDENT);
  assert.deepEqual(judgedAt(CHECKPOINT, view.verdicts, INDEPENDENT), [1, 2],
    "both cite the deployment this checkpoint holds, so a void takes both");
  const elsewhere = viewFrom("the-uuid", issueOf(),
    [mark(), comment(render("verdict", [verdictOf(3, { evidence: [MOVED] })]))], null, INDEPENDENT);
  assert.deepEqual(judgedAt(CHECKPOINT, elsewhere.verdicts, INDEPENDENT), [],
    "a verdict citing some third head judged nothing this void gives up, and was void before it");
  const builders = viewFrom("the-uuid", issueOf(),
    [mark(), comment(render("verdict", [verdictOf(1, { judge: BUILDER })]))], null, INDEPENDENT);
  assert.deepEqual(judgedAt(CHECKPOINT, builders.verdicts, INDEPENDENT), [],
    "and a verdict that was never a QA verdict is not lost with it: it never stood");
});

/* The fence value a redeployed candidate turns on: a successor builder's id differs from the
   checkpoint's, so a reading that skipped the project's `qa` line would report a builder's own
   verdicts lost on a project that asked for no judge at all. */
test("a project that asked for no judge has nothing for a void to name", () => {
  const successor = { judge: "the-successor-session", evidence: [MOVED] };
  const view = viewFrom("the-uuid", issueOf(),
    [mark(), comment(render("verdict", [verdictOf(1, successor)]))], null, BUILDER_JUDGES);
  const moved = { ...CHECKPOINT, deployment: MOVED, candidate: MOVED };
  assert.deepEqual(judgedAt(moved, view.verdicts, INDEPENDENT), [1],
    "the verdict is one an independent-judge project would count, so the guard is what decides below");
  assert.deepEqual(judgedAt(moved, view.verdicts, BUILDER_JUDGES), [],
    "and on a project with no QA at all a resumed builder's verdicts are not a judgement to lose");
  assert.deepEqual(judgedAt(moved, view.verdicts, null), [],
    "nor on one whose config did not answer, which is read as having decided nothing");
});

test("the problem a verdict has is one reading, so a caller outside the check reads the same answer", () => {
  assert.equal(judgeProblem(verdictOf(1), CHECKPOINT), null);
  assert.match(judgeProblem(verdictOf(1, { judge: BUILDER }), CHECKPOINT), /the builder's own id/u);
  assert.match(judgeAsk("ISS-8", 1, { deployment: DEPLOYED }), /--commit <sha> /u,
    "a checkpoint the shape does not hold whole still prints a typeable command, not an empty flag");
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
/* A write's first send is held to deliver the comments the session has not read, and the same
   command sent again lands: what a test asserts is the second, the hold being another rule's. */
const twice = async (who, ...argv) => {
  const first = await who(...argv);
  return first.status === 0 ? first : who(...argv);
};

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

/* The third move of the handoff these criteria name — builder readies, lander takes, QA takes,
   lander takes back — which no session could make while the QA turn was refused to everybody. The
   two cases above reach the judge's lease by letting the lander's lapse; this one takes it. */
test("at qa-owed the judging run takes a live lander lease, and the builder is refused its own work", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: LANDER, renewedAt: at() };
  const first = await qa("claim", "ISS-8", "--take");
  const taken = first.status === 0 ? first : await qa("claim", "ISS-8", "--take");
  assert.equal(taken.status, 0, `${taken.stdout}\n${taken.stderr}`);
  assert.equal(judging.sessionContext.lease.holder, QA,
    "the turn the state hands the judge is taken while the lander's lease is still live");
  const refused = await builder("claim", "ISS-8", "--take");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /no run may judge its own work/u,
    "and the one session qa-owed cannot mean is the one that built the change");
});

/* The fourth move, and the one the state had no writer for: `qa-owed` was where a landing went to
   die, its only successor unreachable and the taker at it holding no command to discharge the turn.
   The state written, the judge named, and the lander's way back in are one reading. */
test("the judging run hands the turn back, and the lander takes the lease it left live", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: QA, renewedAt: at() };
  const back = await twice(qa, "claim", "ISS-8", "--judged");
  assert.equal(back.status, 0, `${back.stdout}\n${back.stderr}`);
  assert.equal(judging.sessionContext.landing.state, "judged", back.stdout);
  assert.equal(judging.sessionContext.landing.judge, QA, "the checkpoint names who judged it");
  assert.match(back.stdout, /landing `judged`/u, back.stdout);
  const lander = asks(LANDER);
  const took = await twice(lander, "claim", "ISS-8", "--take");
  assert.equal(took.status, 0, `${took.stdout}\n${took.stderr}`);
  assert.equal(judging.sessionContext.lease.holder, LANDER,
    "the judge's own live lease is taken back from, as the builder's is at the handoff before it");
  const again = await qa("claim", "ISS-8", "--judged");
  assert.equal(again.status, 1, again.stdout);
  assert.match(`${again.stdout}\n${again.stderr}`, /reads `judged`/u,
    "and the hand-back is refused a second time, naming the state it read");
});

/* The independence `--take` refuses one move earlier, asked again of the move that writes the
   judgement down: reaching `--judged` needs no take, so a builder holding its own lease signed
   itself onto the checkpoint as judge, and before-merge reads that state alone to push (ISS-673). */
test("the builder is refused the hand-back, on the reading the take before it is refused on", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = {
    ...judging.sessionContext.lease, holder: BUILDER, renewedAt: new Date().toISOString(),
  };
  const refused = await twice(builder, "claim", "ISS-8", "--judged");
  assert.equal(refused.status, 1, `${refused.stdout}\n${refused.stderr}`);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /no run may judge its own work/u,
    "the same sentence the take is refused with, because it is the same rule read once");
  assert.equal(judging.sessionContext.landing.state, "qa-owed", "and the turn is still owed to a judge");
  assert.ok(!judging.sessionContext.landing.judge, "with nobody named as having taken it");
});

/* The hole the take-back cuts in the live-lease guard, closed by the take that used it: a lander
   inheriting the judge's id, or the judge landing under its own lease, would otherwise be takeable
   by any third run for the rest of the landing. */
test("the take at judged spends the judge's name, so the lease the taker holds is nobody else's", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: QA, renewedAt: at() };
  assert.equal((await twice(qa, "claim", "ISS-8", "--judged")).status, 0);
  assert.equal(judging.sessionContext.landing.judge, QA);
  const lander = asks(LANDER);
  assert.equal((await twice(lander, "claim", "ISS-8", "--take")).status, 0);
  assert.equal(judging.sessionContext.landing.judge, "",
    "the name licensed one hand-back, and the take that used it blanked the field `landingOf` drops");
  /* Real time and not the fixture's clock: the CLI reads liveness against `Date.now()`, and a stamp
     from the counter above is already lapsed there — which is any run's, proving nothing. */
  judging.sessionContext.lease = {
    ...judging.sessionContext.lease, holder: QA, renewedAt: new Date().toISOString(),
  };
  const asking = asks("a-third-lander");
  await asking("claim", "ISS-8", "--take");
  const third = await asking("claim", "ISS-8", "--take");
  assert.equal(third.status, 1, third.stdout);
  assert.match(`${third.stdout}\n${third.stderr}`, /is already on it/u,
    "so a judge that went on to land holds a lander's live lease, which no third run may take");
});

/* The same hole, entered by the judge itself: J hands back and then lands its own change, which the
   state permits because J is not the builder. Its take is licensed by the lease it already holds, so
   the marker has to go there too — left set, the lander lease J now holds would be any run's. */
test("the judge that lands its own hand-back spends the marker too, before any state moves", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "qa-owed" };
  judging.sessionContext.lease = { ...judging.sessionContext.lease, holder: QA, renewedAt: at() };
  assert.equal((await twice(qa, "claim", "ISS-8", "--judged")).status, 0);
  judging.sessionContext.lease = {
    ...judging.sessionContext.lease, holder: QA, renewedAt: new Date().toISOString(),
  };
  assert.equal((await twice(qa, "claim", "ISS-8", "--take")).status, 0, "the judge takes the lander's turn");
  assert.equal(judging.sessionContext.landing.judge, "",
    "and its own take spent the marker, the lease it holds now being an ordinary lander's");
  assert.equal(judging.sessionContext.landing.state, "judged", "with no state moved yet");
  const third = asks("a-fourth-lander");
  await third("claim", "ISS-8", "--take");
  const refused = await third("claim", "ISS-8", "--take");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /is already on it/u,
    "so the interval between the judge's take and the next transition is not a window either");
});

test("the hand-back is refused where no QA turn is owed, and refused beside a turn's own flag", async () => {
  judging.sessionContext.landing = { ...CHECKPOINT, state: "reconciled" };
  const early = await qa("claim", "ISS-8", "--judged");
  assert.equal(early.status, 1, early.stdout);
  assert.match(`${early.stdout}\n${early.stderr}`, /reads `reconciled`/u, early.stdout);
  const both = await qa("claim", "ISS-8", "--judged", "--take");
  assert.equal(both.status, 1, both.stdout);
  assert.match(`${both.stdout}\n${both.stderr}`, /--take and --judged/u,
    "each flag is a different turn's move, so two of them name no turn at all");
});
