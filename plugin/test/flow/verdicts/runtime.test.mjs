/* A verdict naming the runtime it was exercised at stands while the landing checkpoint names that
   runtime as serving, and once the checkpoint names another the rungs say which criterion stopped
   standing and why, whoever judges: an issue dropping back with no reason named is the defect worn
   the other way round (ISS-2279). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-runtime").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, judgedOwed, viewFrom } = await import("../../../src/flow/earned.mjs");
const { RUNTIME_ASK, judgeAsk, judgedAt } = await import("../../../src/flow/qa/verdicts.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");
const { deploymentOnto } = await import("../../../src/flow/record/judged/carried.mjs");

const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const REPLACED = "5a1f0e3b00000000000000000000000000000fed";
const AT = "2026-10-03T12:00:00.000Z";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const CHECKPOINT = {
  state: "judged", builder: BUILDER, branch: "iss-2279", head: MERGED,
  base: "6e4ecb10000000000000000000000000000000ff", candidate: DEPLOYED, deployment: DEPLOYED,
  files: ["plugin/src/flow/earned.mjs"], at: AT,
};
const INDEPENDENT = releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "independent" },
});
const BUILDER_JUDGES = releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa: "builder" },
});

let clock = 0;
const at = () => `2026-10-03T13:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ documentId: `c-${clock + 1}`, createdAt: at(), authorId: "agent", body });
const mark = () => comment(`mark_merged target=base — merged to master at ${MERGED}`);
/* Evidence that is no sha, so whether a verdict counts is decided by its runtime and nothing else. */
const verdictOf = (number, over = {}) => ({ criterion: `${number} — text`, verdict: "pass", commit: MERGED,
  runtime: DEPLOYED, evidence: ["https://ci.example.test/9"], judge: QA, ...over });
const SUPERSEDED = new RegExp(`^the verdict on criteri(on|a) [\\d, ]+ was judged at the runtime ${DEPLOYED.slice(0, 7)}, `
  + `and the landing checkpoint names ${REPLACED.slice(0, 7)} as what the deployment serves, so it is superseded`, "u");

const viewOf = (verdicts, { release = INDEPENDENT, serving = DEPLOYED, extra = [] } = {}) => viewFrom("the-uuid", {
  acceptanceCriteria: CRITERIA, plan: PLAN, mergedAt: AT, attachments: [],
  sessionContext: { landing: { ...CHECKPOINT, deployment: serving } },
}, [mark(), comment(render("verdict", verdicts)), ...extra], null, release);
const said = (items) => items.map((one) => one.what);

test("under a second judge, a verdict at the runtime the checkpoint names counts at testing with no sha in its evidence", () => {
  assert.deepEqual(said(judgedOwed(viewOf([verdictOf(1), verdictOf(2)]), "ISS-8")), []);
});

test("--owed at testing names a superseded verdict with its criterion, the runtime it was judged at and what is serving", () => {
  const items = judgedOwed(viewOf([verdictOf(1), verdictOf(2)], { serving: REPLACED }), "ISS-8");
  assert.equal(items.length, 1, said(items).join("\n"));
  assert.match(items[0].what, SUPERSEDED, items[0].what);
  assert.match(items[0].what, /^the verdict on criteria 1, 2 /u, "both criteria named, in one line");
  assert.ok(items[0].command.includes(`--runtime ${RUNTIME_ASK}`), `and the ask is a judgement at what serves: ${items[0].command}`);
});

test("awaiting_release and closed refuse a superseded verdict by criterion and reason, whoever judges", () => {
  for (const release of [INDEPENDENT, BUILDER_JUDGES]) {
    for (const rung of ["awaiting_release", "closed"]) {
      const items = CHECKS[rung](viewOf([verdictOf(1), verdictOf(2, { runtime: undefined })], { release, serving: REPLACED }), "ISS-8");
      const named = said(items).filter((one) => /superseded/u.test(one));
      assert.equal(named.length, 1, `${rung} under ${release.qa ?? "builder"}: ${said(items).join("\n")}`);
      assert.match(named[0], /^the verdict on criterion 1 was judged at the runtime/u,
        `the one criterion judged at a runtime, and not the one naming only a commit: ${named[0]}`);
    }
  }
});

test("the landing keeps no superseded verdict among the judgements it counts", () => {
  const verdicts = new Map([[1, { record: { fields: verdictOf(1) } }], [2, { record: { fields: verdictOf(2, { runtime: REPLACED }) } }]]);
  assert.deepEqual(judgedAt(CHECKPOINT, verdicts, INDEPENDENT), [1]);
});

test("the judge's ask names --runtime and asks for what was exercised as the evidence", () => {
  const command = judgeAsk("ISS-8", [1, 2], { head: MERGED, deployment: DEPLOYED }, null, null, null, [], null, true);
  assert.ok(command.includes(`--runtime ${RUNTIME_ASK} --evidence <what you exercised>`), command);
  assert.doesNotMatch(command, new RegExp(`--evidence ${DEPLOYED.slice(0, 7)}`, "u"), "and no longer offers the deployment's sha as the evidence");
});

test("every verdict ask --owed prints at a deployment under a second judge carries --runtime, and none where the builder judges", () => {
  const unjudged = viewFrom("the-uuid", {
    acceptanceCriteria: CRITERIA, plan: PLAN, mergedAt: AT, attachments: [], sessionContext: { landing: CHECKPOINT },
  }, [mark()], null, INDEPENDENT);
  const failed = viewOf([verdictOf(1, { verdict: "fail", why: "printed nothing" }), verdictOf(2)]);
  const asks = [...judgedOwed(unjudged, "ISS-8"), ...CHECKS.awaiting_release(failed, "ISS-8")]
    .filter((one) => /forge record verdict/u.test(one.command));
  assert.ok(asks.length >= 2, `a missing verdict and a failed one each hand out a write: ${said(asks)}`);
  for (const one of asks) assert.ok(one.command.includes(`--runtime ${RUNTIME_ASK}`), `${one.what}\n${one.command}`);
  const builderAsks = judgedOwed(viewFrom("the-uuid", {
    acceptanceCriteria: CRITERIA, plan: PLAN, mergedAt: AT, attachments: [], sessionContext: { landing: CHECKPOINT },
  }, [mark()], null, BUILDER_JUDGES), "ISS-8");
  assert.ok(builderAsks.length && builderAsks.every((one) => !one.command.includes("--runtime")),
    builderAsks.map((one) => one.command).join("\n"));
});

test("a superseded verdict where the builder judges is asked for again with no runtime, the write owing none there", () => {
  const items = CHECKS.closed(viewOf([verdictOf(1), verdictOf(2)], { release: BUILDER_JUDGES, serving: REPLACED }), "ISS-8")
    .filter((one) => /superseded/u.test(one.what));
  assert.equal(items.length, 1, said(items).join("\n"));
  assert.doesNotMatch(items[0].command, /--runtime/u, items[0].command);
});

test("a verdict naming a runtime is stamped with no second reading of the deployment off its evidence", () => {
  const got = { verdict: "pass", commit: MERGED, runtime: REPLACED, evidence: [MERGED] };
  const said = [];
  deploymentOnto(got, CHECKPOINT, (line) => said.push(line));
  assert.equal(got["carries-deployment"], undefined, "the runtime is the identity testing reads, alone");
  assert.deepEqual(said, [], "and git is not asked whether its evidence carries the deployment");
});

test("a verification or a finding written after a runtime verdict leaves its standing as it was", () => {
  const verification = comment(render("verification", [{ where: "the deployed app", commit: REPLACED, evidence: ["https://ci.example.test/10"] }]));
  const finding = comment(render("finding", [{ expected: "the list", seen: "an empty page", evidence: ["https://ci.example.test/11"], criterion: "1" }]));
  const standing = CHECKS.closed(viewOf([verdictOf(1), verdictOf(2)], { extra: [verification, finding] }), "ISS-8");
  assert.deepEqual(said(standing).filter((one) => /superseded/u.test(one)), [], said(standing).join("\n"));
  const moved = CHECKS.closed(viewOf([verdictOf(1), verdictOf(2)], { serving: REPLACED, extra: [verification, finding] }), "ISS-8");
  assert.equal(said(moved).filter((one) => /superseded/u.test(one)).length, 1, said(moved).join("\n"));
});

test("the qa judging reference sends a judge to --runtime, whole, and to a skip where it read none", () => {
  for (const variant of ["default", "screen"]) {
    const text = readFileSync(new URL(`../../../guides/skills/qa/${variant}/references/judging.md`, import.meta.url), "utf8");
    assert.match(text, /name it on each verdict's `--runtime`, whole/u, variant);
    assert.match(text, /write that criterion `skipped`, its `--why` saying what you lacked/u, variant);
  }
});
