/* A run killed mid-judgement keeps what it wrote only if the next reader can see how far it got. On
   ISS-478 the builder's 53 inherited passes read exactly like a judge's, so a restarted judge could
   not tell a finished set from an untouched one. The brief marks a verdict the entry check to
   `testing` would refuse, and says how much of the set counts and where a judge resumes (ISS-1497). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("resume-coverage").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { briefOf } = await import("../../../src/flow/brief.mjs");
const { criteriaLines } = await import("../../../src/flow/resume.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const BUILDER = "the-builder-session";
const QA = "the-qa-session";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const CRITERIA = "1. The first outcome.\n2. The second outcome.\n3. The third outcome.";
const CHECKPOINT = {
  state: "judged", builder: BUILDER, branch: "iss-8", head: MERGED,
  base: "6e4ecb10000000000000000000000000000000ff", candidate: DEPLOYED, deployment: DEPLOYED,
  files: ["plugin/src/flow/brief.mjs"], at: "2026-09-07T12:00:00.000Z",
};
const release = (qa) => releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true, qa },
});
const INDEPENDENT = release("independent");
const BUILDER_JUDGES = release("builder");

let clock = 0;
const at = () => `2026-09-07T13:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const verdict = (number, judge, over = {}) => ({
  createdAt: at(), authorId: "agent",
  body: render("verdict", [{ criterion: `${number} — text`, verdict: "pass", commit: MERGED,
    evidence: [DEPLOYED], judge, ...over }]),
});

const briefFrom = (comments, policy) => briefOf(viewFrom("the-uuid", {
  status: "developed", acceptanceCriteria: CRITERIA, plan: "Screen change: no.\nSchema coupling: no.",
  mergedAt: "2026-09-07T12:00:00.000Z", attachments: [], sessionContext: { landing: CHECKPOINT },
}, comments, null, policy), "ISS-8");

const row = (lines, number) => lines.find((one) => one.includes(` ${number}. `));
const coverageLine = (lines) => lines.find((one) => / criteria carry a verdict that counts/u.test(one)) ?? null;

/* The ISS-478 shape: every criterion carries the builder's verdict, one has since been judged
   again by an independent judge, and the first criterion is where a restarted judge starts. */
const partlyJudged = () => briefFrom(
  [verdict(1, BUILDER), verdict(2, BUILDER), verdict(3, BUILDER), verdict(2, QA)], INDEPENDENT);

test("under an independent judgement a verdict the entry check refuses is marked on its own row", () => {
  const lines = criteriaLines(partlyJudged());
  assert.match(row(lines, 1), /1\. The first outcome\.\s+← counts for nothing here$/u,
    "criterion 4: the builder's pass reads like a judge's");
  assert.match(row(lines, 3), /← counts for nothing here$/u, "criterion 4: and on every row it stands on");
  assert.doesNotMatch(row(lines, 2), /counts for nothing/u, "criterion 4: the judge's own pass is marked as one that does not count");
});

test("a partial set says how much of it counts and names the first criterion a judge resumes at", () => {
  const lines = criteriaLines(partlyJudged());
  assert.equal(coverageLine(lines),
    "1 of 3 criteria carry a verdict that counts; a judge resumes at criterion 1, the first carrying "
      + "none that does. Why each marked one counts for nothing: forge advance ISS-8 --owed",
    "criterion 5: a refused verdict is read as none, so the resume is at the first builder's pass");
  const plain = criteriaLines(briefFrom([verdict(1, BUILDER), verdict(2, BUILDER)], BUILDER_JUDGES));
  assert.equal(coverageLine(plain),
    "2 of 3 criteria carry a verdict that counts; a judge resumes at criterion 3, the first carrying none that does.",
    "criterion 5: where the builder is the judge, the set is partial on the criteria carrying no verdict at all");
  assert.ok(plain.every((one) => !one.includes("counts for nothing")),
    "criterion 4: and nothing is marked where no second judge was asked for");
});

test("no coverage line is printed where nothing is judged yet or every verdict counts", () => {
  assert.equal(coverageLine(criteriaLines(briefFrom([], INDEPENDENT))), null,
    "criterion 6: a set nobody has touched has no remainder to point at");
  const whole = briefFrom([verdict(1, QA), verdict(2, QA), verdict(3, QA)], INDEPENDENT);
  assert.equal(coverageLine(criteriaLines(whole)), null, "criterion 6: a finished judgement reads as one");
  assert.equal(whole.coverage, null, "criterion 8: and the JSON carries no coverage either");
});

test("the JSON carries the flag on each criterion and the coverage the line is printed from", () => {
  const held = JSON.parse(JSON.stringify(partlyJudged()));
  assert.deepEqual(held.criteria.map((one) => one.counts), [false, undefined, false],
    "criterion 7: the flag is on the criteria array the screen is printed from");
  assert.deepEqual(held.coverage, { counted: 1, of: 3, next: 1 },
    "criterion 8: the count that counts, the count of criteria and where a judge resumes");
});
