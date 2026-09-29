/* What the judge is told, and what of its answer is believed: only an offered option, followed from
   a precedent it was shown, with the close precedents agreeing, for every question of the call. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { JUDGE_ROLE, judge, judgeInput, readVerdicts } from "../../src/asks/judge.mjs";
import { defaultEffort } from "../../src/codex/codex-plan.mjs";
import { ownerRow } from "../../src/asks/layer.mjs";

const OPTIONS = [{ label: "File (Recommended)", description: "on this device" }, { label: "Page" }];
const QUESTION = { question: "Where should the weekly report go? [reversible: move it back]", header: "Delivery", options: OPTIONS };
const PRECEDENT = { ...ownerRow({ id: "p1", at: "2026-09-24T08:00:00.000Z", question: { question: "Where should each day's report go?",
  options: OPTIONS }, answer: "Page" }), score: 0.6 };

const said = (entry) => ({ questions: [{ question: QUESTION.question, ...entry }] });
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
  assert.match(readVerdicts({}, [QUESTION], [[PRECEDENT]]).owner, /said nothing about/u);
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
  assert.match(readVerdicts(said(decided), [QUESTION, other], [[PRECEDENT], [PRECEDENT]]).owner, /said nothing about "And the monthly one/u);
});

const VALUES = { ANTHROPIC_BASE_URL: "http://gateway.test", ANTHROPIC_AUTH_TOKEN: "sk-test" };

/* The gateway's stream carrying one `decide` call, as the bounded model call reads it. */
const streamed = (input) => {
  const events = [{ type: "message_start", message: { usage: {} } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "j1", name: "decide" } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
    { type: "content_block_stop", index: 0 }, { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: {} }];
  return [new TextEncoder().encode(events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join(""))];
};

/* A stand-in for `fetch` that keeps every body it was sent and answers the case's own way. */
const gateway = (answer) => {
  const sent = [];
  const send = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return answer(sent.length);
  };
  return { sent, send };
};

const judged = (send, model = "m") => judge({ values: VALUES, model, questions: [QUESTION], shortlists: [[PRECEDENT]], goals: null, send });

test("the judge is one bounded model call, forced through `decide`, and imports nothing of the consult's own call", async () => {
  const { sent, send } = gateway(() => ({ ok: true, status: 200, body: streamed(said(decided)) }));
  const held = await judged(send);
  assert.deepEqual(held.decisions.map((one) => one.option), ["Page"]);
  const [one] = sent;
  assert.equal(one.url, "http://gateway.test/v1/messages");
  assert.deepEqual(one.body.tool_choice, { type: "tool", name: "decide" });
  assert.equal(one.body.system, JUDGE_ROLE);
  const source = readFileSync(new URL("../../src/asks/judge.mjs", import.meta.url), "utf8");
  assert.match(source, /from "\.\.\/wire\/model-call\.mjs"/u);
  assert.doesNotMatch(source, /codex-api\.mjs/u, "the consult's API module is no route of the judge's");
});

test("the machine's effort goes out as a parameter only where the judge's model id names no rung", async () => {
  const { sent, send } = gateway(() => ({ ok: true, status: 200, body: streamed(said(decided)) }));
  await judged(send, "cx/judge");
  await judged(send, "cx/judge-high");
  assert.equal(sent[0].body.reasoning_effort, defaultEffort(), "an id with no rung carries the effort on the parameter");
  assert.equal("reasoning_effort" in sent[1].body, false, "and one naming its rung carries it on the id alone");
});

test("a judge that throws, or runs out of time, is an owner answer", async () => {
  const thrown = await judged(async () => { throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }); });
  assert.match(thrown.owner, /could not be asked: m was not reached: ran out after/u);
  const refused = await judged(async () => ({ ok: false, status: 500, body: null, text: async () => "down" }));
  assert.match(refused.owner, /could not be asked: the gateway answered 500/u);
  const silent = await judged(async () => ({ ok: true, status: 200, body: [new TextEncoder().encode("")] }));
  assert.match(silent.owner, /could not be asked: .*without calling `decide`/u, "an answer with no `decide` call");
});

test("a connection that never opened is tried once more", async () => {
  const refused = () => Object.assign(new TypeError("fetch failed"), { cause: { code: "ETIMEDOUT" } });
  const { sent, send } = gateway((count) => {
    if (count === 1) throw refused();
    return { ok: true, status: 200, body: streamed(said(decided)) };
  });
  const held = await judged(send);
  assert.equal(sent.length, 2);
  assert.equal(held.decisions[0].option, "Page");
});

test("a second connection that never opened is the owner's", async () => {
  let asked = 0;
  const down = await judged(async () => {
    asked += 1;
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  });
  assert.equal(asked, 2, "twice and no more");
  assert.match(down.owner, /could not be asked: m was not reached: fetch failed/u);
});
