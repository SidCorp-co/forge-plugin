/* Where a project asks for a second judge, the rung's judging half wants a set of verdicts somebody other
   than the builder wrote against what the deployment reported running. Two fence values decide
   whether the rule is worth anything: a verdict carrying no judge must count for nothing rather
   than pass unnoticed, and the identity has to be cited off the evidence rather than off the
   commit — under route after-merge the deployment identity is the merged head, so a commit read
   would let an ordinary builder verdict satisfy this by accident (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-independent").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { deployedOwed, judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");
const { JUDGE_FROM } = await import("../../../src/flow/machine.mjs");
const { judgeAsk, judgeProblem, judgedAt } = await import("../../../src/flow/qa/verdicts.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const WAVE = "the-dispatching-session";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
/* Both routes, because whether the change reached a deployment is a fact the reader holds and the
   refusal does not: one of these is runnable whichever way that went (ISS-1993). */
const REBUILT_ROUTES = "forge claim ISS-8 --rebuilt c8c3550 "
  + "--deployment <the sha the deployment reports serving>\n"
  + "forge claim ISS-8 --rebuilt c8c3550 --undeployed";
const MOVED = "3cd76450000000000000000000000000000000ef";
const AT = "2026-09-07T12:00:00.000Z";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const SCREENING = "Screen change: yes.\nSchema coupling: no.\nUser-facing outcome: no.";
const LOOKED = "rendered.png";
const NO_LOGIN = "the project holds no test credential, so no login reaches this screen";
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
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "independent" },
});
const BUILDER_JUDGES = releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "builder" },
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
  judgedOwed(
    viewFrom("the-uuid", issueOf(issue), [mark(), comment(render("verdict", verdicts))], null, release),
    "ISS-8",
  );
const owed = (...args) => items(...args).map((one) => one.what);

test("a verdict carrying the builder's own id earns nothing where the project asks for a second judge", () => {
  const said = owed([verdictOf(1, { judge: BUILDER }), verdictOf(2, { judge: BUILDER })]);
  assert.deepEqual(said, [
    "the verdict on criteria 1, 2 carries the builder's own id `the-builder-session`",
  ], "one item per missing thing, naming every criterion it disqualified");
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

test("every standing verdict judged by the QA session and citing the deployment earns the rung", () => {
  assert.deepEqual(owed([verdictOf(1), verdictOf(2)]), []);
});

/* The configuration no case that shipped with the role used: a screen change declared on a project
   asking for a second judge. The screen check wants an attachment on every verdict that is not
   `skipped`, the judge check the identity on every one, and the role renders no page (ISS-706). */
const screening = (verdicts, attachments = []) =>
  owed(verdicts, { issue: { plan: SCREENING, attachments } });
const skip = (number, over = {}) => verdictOf(number, { verdict: "skipped", why: NO_LOGIN, ...over });

test("a skip citing the deployment identity earns the rung where no route reaches the rendered state", () => {
  assert.deepEqual(screening([skip(1), skip(2)]), [],
    "the one route a judge with no capture tool has, and the check it has to clear is the judge's own");
});

test("a pass citing the deployment identity and an attachment this issue carries earns it as well", () => {
  const cited = { evidence: [DEPLOYED, LOOKED] };
  assert.deepEqual(screening([verdictOf(1, cited), verdictOf(2, cited)], [{ name: LOOKED }]), [],
    "the other route: a render taken where no login is needed, cited beside the identity");
});

/* The fence: a skip is excused the attachment and no verdict is excused the citation. */
test("a skip citing nothing earns nothing, the judge check reading the identity off the evidence", () => {
  const said = screening([skip(1, { evidence: [] }), skip(2)]);
  assert.deepEqual(said, [`the verdict on criterion 1 cites nothing at ${DEPLOYED.slice(0, 7)}, `
    + "which is what the deployment reported running"]);
});

test("a pass citing the deployment and no attachment is refused, this changing nothing about that", () => {
  const said = screening([verdictOf(1), verdictOf(2)]);
  assert.equal(said.length, 1, `one item for the set of verdicts, not one each: ${said}`);
  assert.match(said[0], /cites no attachment this issue carries/u,
    "a screen change nobody looked at earns no rung, whoever judged it");
});

/* The half kept as regression coverage rather than as a criterion: a project that asks for no
   second judge is where it always was, and a judge-less verdict there is no shortfall. */
test("where the project asks for no second judge, the builder's own verdicts earn the rung", () => {
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
    { issue: { sessionContext: { landing: { ...CHECKPOINT, builder: BUILDER } } } }).length, 1);
});

test("no checkpoint means nothing names the builder, and the check says so", () => {
  const said = owed([verdictOf(1), verdictOf(2)], { issue: { sessionContext: null } });
  assert.deepEqual(said, [
    "the verdict on criteria 1, 2 has no landing checkpoint naming a builder, and nothing on it says "
      + "a builder could not be recovered: a record nobody made reads here exactly like one nobody can make",
  ], "the builder is what this rung reads for, a deployment identity being the verification's one rung up");
  const asked = items([verdictOf(1), verdictOf(2)], { issue: { sessionContext: null } });
  assert.deepEqual(asked.map((one) => one.command), [REBUILT_ROUTES],
    "and the ask is not another verdict, nor a command that reports where the landing is and writes "
      + "no checkpoint, but the write that puts one there");
});

/* The checkpoint every ordinary landing leaves: `readyCheckpoint`'s own keys and no deployment among
   them. Demanding one here closed the ladder above `developed` for every project that asked for a
   judge, the one route that writes the field refusing where a checkpoint already stands (ISS-1788). */
const ORDINARY = { state: "ready", builder: BUILDER, branch: "iss-1788-4", head: MERGED,
  base: CHECKPOINT.base, files: CHECKPOINT.files, at: AT };
const landed = (verdicts, over = {}) =>
  owed(verdicts, { issue: { sessionContext: { landing: { ...ORDINARY, ...over } } } });

test("an ordinary landing carries no deployment identity, and its judge's verdicts earn the rung", () => {
  assert.deepEqual(landed([verdictOf(1, { evidence: [MERGED] }), verdictOf(2, { evidence: [MERGED] })]), [],
    "the commit each verdict already carries is what this rung reads, and the deployment identity "
      + "is asked for at awaiting_release off the verification");
});

/* The fence the issue's own third Rule binds: the half removed was the deployment's, never the
   builder's, so a builder coming back to judge its own change is refused with nothing to compare. */
test("the builder's own verdict earns nothing on a checkpoint that names no deployment identity", () => {
  assert.deepEqual(landed([verdictOf(1, { judge: BUILDER }), verdictOf(2, { judge: BUILDER })]),
    ["the verdict on criteria 1, 2 carries the builder's own id `the-builder-session`"]);
  const bare = verdictOf(1);
  delete bare.judge;
  assert.match(landed([bare, verdictOf(2)])[0], /carries no judge/u,
    "and a verdict saying nothing about who wrote it is refused as it always was");
  assert.match(landed([verdictOf(1, { judge: WAVE, [JUDGE_FROM]: "inherited" }), verdictOf(2)])[0],
    /which the record says the run inherited/u, "as is one whose id names the wave that dispatched it");
});

/* The route out of the one refusal a judge on such a checkpoint can still meet is a write and never
   a command that reports where the landing is and leaves the reader where it found them (ISS-1788). */
test("a judge refused on a checkpoint holding no identity is handed the verdict write", () => {
  const asked = items([verdictOf(1, { judge: BUILDER }), verdictOf(2, { judge: BUILDER })],
    { issue: { sessionContext: { landing: ORDINARY } } });
  assert.equal(asked.length, 1, `one item: ${asked.map((one) => one.what)}`);
  assert.equal(asked[0].command,
    "forge record verdict ISS-8 --criterion 1 --verdict pass --criterion 2 --verdict pass "
      + `--commit ${MERGED.slice(0, 7)} --evidence <what you exercised>`,
    "the verdict write, with what there is to cite named where no identity stands in for it");
  assert.doesNotMatch(asked[0].command, /forge resume/u);
});

/* The reconstruction's identity is not stranded by the removal: where a checkpoint holds one, the
   citation ISS-2045 paid for is still spent, which is the case `citesDeployment` was built for. */
test("an identity the checkpoint does hold is still cited, and a verdict citing some other head is refused", () => {
  assert.deepEqual(landed([verdictOf(1, { evidence: [DEPLOYED] }), verdictOf(2, { evidence: [DEPLOYED] })],
    { deployment: DEPLOYED }), []);
  assert.deepEqual(landed([verdictOf(1, { evidence: [MOVED] }), verdictOf(2, { evidence: [DEPLOYED] })],
    { deployment: DEPLOYED }),
  [`the verdict on criterion 1 cites nothing at ${DEPLOYED.slice(0, 7)}, which is what the deployment `
    + "reported running"]);
});

/* The rung the demand moved to, read under the configuration that has no automatic deploy: the
   stricter cross-check `deployOwed` makes is that declaration's, and what every project owes
   whatever it declared is the verification record itself — which is the whole no-deployment route,
   its `--where` naming the branch on a project with no running host (ISS-1788). */
const MANUAL = releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false, qa: "independent" },
});

test("the rung above still owes the verification where the project declares no automatic deploy", () => {
  const view = viewFrom("the-uuid", issueOf({ releaseNotes: { section: "Added" } }),
    [mark(), comment(render("verdict", [verdictOf(1), verdictOf(2)]))], null, MANUAL);
  const said = deployedOwed(view, "ISS-8").map((one) => one.what);
  assert.deepEqual(said, ["no verification: where the change now runs, at which commit, and the evidence"],
    "the deployment reading is the deploying actor's at this rung, and no configuration drops it");
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

/* The gap ISS-673 left and this closes: an id a run inherited names the session that dispatched a
   whole wave, so it differs from the builder's and a reading comparing only ids called that a second
   judge. The verdict is honest about who wrote it and still proves nothing about who judged. */
test("a verdict whose judge id was inherited earns nothing, however that id compares with the builder's", () => {
  const said = items([verdictOf(1, { judge: WAVE, [JUDGE_FROM]: "inherited" }), verdictOf(2)]);
  assert.equal(said.length, 1, `one item, for the one verdict that proves no second judge: ${said.map((one) => one.what)}`);
  assert.match(said[0].what, /carries the judge id `the-dispatching-session`/u, said[0].what);
  assert.match(said[0].what, /names a wave and not a run/u, "in the words the lease already keeps");
  assert.match(said[0].what, /FORGE_SESSION_ID/u, "naming what to set, or the role re-runs it unchanged");
  assert.match(said[0].command, /^FORGE_SESSION_ID=\S+ forge record verdict ISS-8 /u,
    "and the write that answers it is granted an id, which is the whole of what the item asks for");
  assert.deepEqual(owed([verdictOf(1, { judge: WAVE }), verdictOf(2)]), [],
    "while the same id with no source beside it is judged by the rule it was written under");
});

test("a void names no verdict whose judge id was inherited, that verdict never having stood", () => {
  const held = [verdictOf(1, { judge: WAVE, [JUDGE_FROM]: "inherited" }), verdictOf(2)];
  const view = viewFrom("the-uuid", issueOf(), [mark(), comment(render("verdict", held))], null, INDEPENDENT);
  assert.deepEqual(judgedAt(CHECKPOINT, view.verdicts, INDEPENDENT), [2],
    "the one a run of its own judged is what the void gives up, and the other was void before it");
});

test("the problem a verdict has is one reading, so a caller outside the check reads the same answer", () => {
  assert.equal(judgeProblem(verdictOf(1), CHECKPOINT), null);
  assert.match(judgeProblem(verdictOf(1, { judge: BUILDER }), CHECKPOINT), /the builder's own id/u);
  assert.match(judgeAsk("ISS-8", 1, { deployment: DEPLOYED }), /--commit <sha> /u,
    "a checkpoint the shape does not hold whole still prints a typeable command, not an empty flag");
});

/* The window the capture is taken in closes at the merge, so an issue whose run died inside it
   holds a builder nobody can write down rather than one nobody did. The gate could not tell the two
   apart and refused both, which left six issues on forge-dev live and unjudgeable (ISS-2045). */
const REBUILT = {
  state: "done",
  head: MERGED,
  deployment: DEPLOYED,
  files: [],
  handWritten: {
    by: "the-rebuilding-session",
    at: AT,
    why: "written after the landing",
    builder: "four holders appear across this issue's history and none of them is the builder",
    lost: ["base", "files"],
  },
};
/* The judging claim is in the history too, and it is not a candidate for having built the change:
   every run that asks this question claimed the issue to ask it. */
const heldBy = (...holders) => ({
  landing: REBUILT,
  lease: { holder: QA, history: [...holders.map((holder) => ({ holder, status: "in_progress" })),
    { holder: QA, status: "developed" }] },
});

test("a checkpoint declaring its builder unrecoverable earns the verdict the deployment half alone", () => {
  assert.deepEqual(owed([verdictOf(1), verdictOf(2)], { issue: { sessionContext: heldBy("one", "two") } }), [],
    "the deployment half stands and the builder half is answered by the declaration");
  const bare = { ...REBUILT };
  delete bare.handWritten;
  assert.equal(owed([verdictOf(1), verdictOf(2)], { issue: { sessionContext: { landing: bare } } }).length, 1,
    "while the same checkpoint with nothing said about the builder is refused exactly as before");
});

test("a builder the claim history answers for on its own is refused rather than declared unknown", () => {
  const said = owed([verdictOf(1), verdictOf(2)], { issue: { sessionContext: heldBy("the-only-run") } });
  assert.equal(said.length, 1, "one line, the item being the checkpoint's and not the verdict's");
  assert.match(said[0], /exactly one run that held it while the change was being built, `the-only-run`/u);
});

/* The only reading of an unrecoverable builder the record settles certainly. A judge that merely
   appears in the history settles nothing — every judging run claims the issue before it writes, so
   a rule refusing that would refuse every verdict this change exists to let stand. */
/* A judge that only ever claimed to judge is apart from the builder by the record's own reading, and
   that is every judging run — so what this refuses is the run that built the change and came back to
   judge it, which an unrecoverable builder would otherwise hide. */
test("a judge the claim history names as a run that held the build is no judge apart from it", () => {
  const said = owed([verdictOf(1, { judge: "one" }), verdictOf(2, { judge: "one" })],
    { issue: { sessionContext: heldBy("one", "two", "three") } });
  assert.deepEqual(said, ["the verdict on criteria 1, 2 carries the judge id `one`, which the claim history "
    + "on this issue names as a run that held it while the change was being built: the checkpoint's builder "
    + "is unrecoverable, so nothing here shows this judge apart from whoever built the change"]);
  assert.deepEqual(owed([verdictOf(1), verdictOf(2)], { issue: { sessionContext: heldBy("one", "two") } }), [],
    "while a judge whose every claim came after the build is apart from every one of them");
});

/* One sentence naming two things told a reader whose deployment half stood that it did not: the
   measured case on forge-dev satisfied the deployment and was refused for both (ISS-2045). The
   builder is the half that remains, and a missing deployment is now no shortfall at all (ISS-1788). */
test("a verdict is told about the builder, and a checkpoint short of a deployment is told nothing", () => {
  const noDeploy = owed([verdictOf(1, { evidence: [MERGED] }), verdictOf(2, { evidence: [MERGED] })],
    { issue: { sessionContext: { landing: { ...CHECKPOINT, deployment: undefined } } } });
  assert.deepEqual(noDeploy, [], "the builder stands on this one and the deployment is not this rung's");
  const noBuilder = owed([verdictOf(1), verdictOf(2)],
    { issue: { sessionContext: { landing: { ...CHECKPOINT, builder: undefined } } } });
  assert.match(noBuilder[0], /^the verdict on criteria 1, 2 has no landing checkpoint naming a builder,/u);
  assert.doesNotMatch(noBuilder[0], /deployment identity/u, "and the deployment stands on this one");
});

test("the landing's reading of which criteria were judged refuses what the entry check refuses", () => {
  const view = viewFrom("the-uuid", issueOf({ sessionContext: heldBy("one", "two") }),
    [mark(), comment(render("verdict", [verdictOf(1, { judge: "one" }), verdictOf(2)]))], null, INDEPENDENT);
  assert.deepEqual(judgedAt(REBUILT, view.verdicts, INDEPENDENT, view.holders), [2],
    "criterion 1's judge held the issue while the change was being built, so the landing counts that "
      + "verdict no more than the transition would");
});

/* 37 verdicts, 37 copies of one sentence, and the one fact to act on visible in none of them: the
   item is the checkpoint's and not each verdict's, so it is reported once (ISS-1784). */
test("one refusal names every criterion it refused rather than one refusal for each", () => {
  const four = [1, 2, 3, 4].map((number) => verdictOf(number, { judge: BUILDER }));
  const said = owed(four, { issue: { acceptanceCriteria: "1. One.\n2. Two.\n3. Three.\n4. Four." } });
  assert.equal(said.length, 1, `one line and not four:\n${said.join("\n")}`);
  assert.match(said[0], /^the verdict on criteria 1, 2, 3, 4 /u);
  const mixed = owed([verdictOf(1, { judge: BUILDER }), verdictOf(2, { evidence: [MERGED] })]);
  assert.equal(mixed.length, 2, "while two different items stay two lines, being two things to act on");
});

/* The route printed where no checkpoint stands is the write that puts one there and never a command
   that only reports where the landing is, which a reader could follow and arrive nowhere. */
test("a verdict refused for a checkpoint that is absent names the write that puts one there", () => {
  const asked = items([verdictOf(1), verdictOf(2)], { issue: { sessionContext: null } });
  assert.deepEqual(asked.map((one) => one.command), [REBUILT_ROUTES]);
  const standing = items([verdictOf(1, { judge: BUILDER })]);
  assert.match(standing[0].command, /^forge record verdict ISS-8 /u,
    "while a checkpoint that stands is answered by the verdict it is short of, as before");
});
