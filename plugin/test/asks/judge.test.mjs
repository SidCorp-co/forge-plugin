/* What the judge is told, and what of its answer is believed: only an offered option, followed from
   a precedent it was shown, with the close precedents agreeing, for every question of the call. */
import assert from "node:assert/strict";
import test from "node:test";

import { JUDGE_ROLE, judge, judgeInput, readVerdicts } from "../../src/asks/judge.mjs";
import { ownerRow } from "../../src/asks/layer.mjs";

const OPTIONS = [{ label: "File (Recommended)", description: "on this device" }, { label: "Page" }];
const QUESTION = { question: "Where should the weekly report go? [reversible: move it back]", header: "Delivery", options: OPTIONS };
const PRECEDENT = { ...ownerRow({ id: "p1", at: "2026-09-24T08:00:00.000Z", question: { question: "Where should each day's report go?",
  options: OPTIONS }, answer: "Page" }), score: 0.6 };

const said = (entry) => [{ name: "decide", input: { questions: [{ question: QUESTION.question, ...entry }] } }];
const decided = { verdict: "decide", option: "Page", precedent: "p1", precedentsAgree: true, reason: "the owner chose a page" };

test("the judge is told that close precedents disagreeing with each other is an owner answer", () => {
  assert.match(JUDGE_ROLE, /Where the close precedents disagree with each other, the answer is `owner`/u);
  assert.match(JUDGE_ROLE, /Where no precedent is close enough, the answer is `owner`/u);
  assert.match(JUDGE_ROLE, /Where the precedents disagree with the session's recommendation, the precedents win/u);
});

test("the judge is sent each question with its options, its recommendation, its reversal, the goals and its precedents", () => {
  const input = judgeInput([QUESTION], [[PRECEDENT]], { goals: [{ id: "G-11", text: "less of a session" }] });
  assert.deepEqual(input.goals, [{ id: "G-11", text: "less of a session" }]);
  const [one] = input.questions;
  assert.equal(one.reversal, "move it back");
  assert.deepEqual(one.options, [{ label: "File (Recommended)", description: "on this device", recommended: true },
    { label: "Page", description: null, recommended: false }]);
  assert.deepEqual(one.precedents[0], { id: "p1", kind: "owner answer", date: "2026-09-24T08:00:00.000Z",
    question: "Where should each day's report go?", options: ["File (Recommended)", "Page"], recommended: "File (Recommended)",
    answer: "Page", wroteOwnAnswer: false, matchedRecommendation: false, notes: null, closeness: 0.6 });
  assert.deepEqual(judgeInput([QUESTION], [[]], { goals: [], why: "no brief" }).goals, { none: "no brief" });
});

test("a decision is believed only as an offered option, followed from a shown precedent", () => {
  assert.deepEqual(readVerdicts(said(decided), [QUESTION], [[PRECEDENT]]).decisions.map((one) => [one.option, one.precedent.id]),
    [["Page", "p1"]]);
  assert.match(readVerdicts([], [QUESTION], [[PRECEDENT]]).owner, /made no `decide` call/u);
  assert.match(readVerdicts(said({ ...decided, verdict: "owner" }), [QUESTION], [[PRECEDENT]]).owner, /sent .* to the owner/u);
  assert.match(readVerdicts(said({ ...decided, option: "Elsewhere" }), [QUESTION], [[PRECEDENT]]).owner, /does not offer/u);
  assert.match(readVerdicts(said({ ...decided, precedent: "p9" }), [QUESTION], [[PRECEDENT]]).owner, /not among the precedents/u);
});

test("an option its own precedent does not bear out, or a recorded decision followed, leaves the question with the owner", () => {
  assert.match(readVerdicts(said({ ...decided, option: "File (Recommended)" }), [QUESTION], [[PRECEDENT]]).owner,
    /answered `Page`, not `File \(Recommended\)`/u);
  const recorded = { id: "d1", kind: "decision", issue: "ISS-4", readings: ["Page | a | b"], score: 0.5 };
  assert.match(readVerdicts(said({ ...decided, precedent: "d1" }), [QUESTION], [[PRECEDENT, recorded]]).owner, /answered `no option`/u);
});

test("an option picked while the close precedents are reported not to agree leaves the question with the owner", () => {
  assert.match(readVerdicts(said({ ...decided, precedentsAgree: false }), [QUESTION], [[PRECEDENT]]).owner, /do not agree/u);
  assert.match(readVerdicts(said({ ...decided, precedentsAgree: undefined }), [QUESTION], [[PRECEDENT]]).owner, /do not agree/u);
});

test("a call is decided whole or not at all", () => {
  const other = { ...QUESTION, question: "And the monthly one? [reversible: move it back]" };
  const calls = [{ name: "decide", input: { questions: [{ question: QUESTION.question, ...decided }] } }];
  assert.match(readVerdicts(calls, [QUESTION, other], [[PRECEDENT], [PRECEDENT]]).owner, /said nothing about "And the monthly one/u);
});

test("a judge that throws, or runs out of time, is an owner answer", async () => {
  const thrown = await judge({ values: {}, model: "m", questions: [QUESTION], shortlists: [[PRECEDENT]], goals: null,
    ask: async () => { throw new Error("The operation was aborted due to timeout"); } });
  assert.match(thrown.owner, /could not be asked: The operation was aborted due to timeout/u);
});

test("a connection that never opened is tried once more, and a second failure is the owner's", async () => {
  const refused = () => Object.assign(new Error("fetch failed"), { cause: { code: "ETIMEDOUT" } });
  let asked = 0;
  const flaky = async () => {
    asked += 1;
    if (asked === 1) throw refused();
    return { calls: said(decided) };
  };
  const held = await judge({ values: {}, model: "m", questions: [QUESTION], shortlists: [[PRECEDENT]], goals: null, ask: flaky });
  assert.equal(held.decisions[0].option, "Page");
  asked = 0;
  const down = await judge({ values: {}, model: "m", questions: [QUESTION], shortlists: [[PRECEDENT]], goals: null,
    ask: async () => { asked += 1; throw refused(); } });
  assert.equal(asked, 2, "twice and no more");
  assert.match(down.owner, /could not be asked: fetch failed/u);
});
