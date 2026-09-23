import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds a working token. */
const sandbox = tempRoom("forge-codex-rounds-");
process.env.XDG_CONFIG_HOME = sandbox;

const { reviewed } = await import("../../src/codex/codex-rounds.mjs");
const { scopeFor } = await import("../../src/codex/codex-tools.mjs");

const REPO = join(sandbox, "repo");
mkdirSync(REPO, { recursive: true });
writeFileSync(join(REPO, ".git"), "gitdir: elsewhere\n");

/* The whole point of the ladder: a reply that says it could not check is not the review, it is the
   review the budget cut short. It is carried on to the ceiling, and the caller sees nothing until it
   answers — "retried before it is shown" and a stream to stdout cannot both hold. */
test("an unfinished review is carried on to the ceiling before a word of it is shown", async () => {
  const budgets = [];
  const stub = async (values, model, messages, held) => {
    budgets.push(held.tools?.length ?? 0);
    const first = budgets.length === 1;
    const text = first ? "I could not verify the caller." : "CODEX: 0 findings";
    held.onDelta?.(text);
    return { text, calls: [], usage: { input_tokens: 10 }, stop: "end_turn", thought: 1 };
  };
  const shown = [];
  const held = await reviewed({}, "m", "go", scopeFor(REPO), (text) => shown.push(text), stub, { budget: 2, ceiling: 3 });
  assert.equal(held.attempt, 2, "the first attempt did not finish reading");
  assert.equal(held.budget, 3, "the second ran at the ceiling");
  assert.equal(held.retriedFrom, 2);
  assert.equal(held.text, "CODEX: 0 findings");
  assert.deepEqual(shown, ["CODEX: 0 findings"], "nothing of the unfinished attempt reached the caller");
  assert.equal(held.usage.input_tokens, 20, "both attempts were billed, so both are on the row");
});

test("a review that finished is shown as it stands and costs no second attempt", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { text: "CODEX: 0 findings", calls: [], usage: { input_tokens: 10 }, stop: "end_turn", thought: 0 };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  assert.equal(held.attempt, 1);
  assert.equal(calls, 1, "one call, because the first reply answered");
  assert.equal(held.streamed, false, "buffered, so the verb prints it");
});

/* A CANNOT TELL is what the verify grammar asks for on a risk the reviewer cannot decide. Retrying
   there buys the same answer at twice the price, so the ladder must not fire on it. */
test("a CANNOT TELL ruling is an answer, not an unfinished review", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { text: "1. **CANNOT TELL** — the diff does not decide it.", calls: [], usage: {}, stop: "end_turn", thought: 0 };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  assert.equal(calls, 1);
  assert.equal(held.attempt, 1);
});

/* At the ceiling there is nothing left to carry on into, so the reply streams as it always did. */
test("with no retry left the reply streams instead of being held back", async () => {
  const shown = [];
  const stub = async (values, model, messages, held) => {
    held.onDelta?.("I could not check the caller.");
    return { text: "I could not check the caller.", calls: [], usage: {}, stop: "end_turn", thought: 0 };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), (text) => shown.push(text), stub, { budget: 3, ceiling: 3 });
  assert.equal(held.attempt, 1);
  assert.deepEqual(shown, ["I could not check the caller."]);
  assert.equal(held.streamed, true);
});

/* Spending every call reading and never answering is the case a bigger budget most obviously fixes,
   so it is carried on rather than raised at the caller. */
test("an attempt that read for every call and never answered is carried on, not raised", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    const answered = calls > 2;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${calls}`, name: "grep", input: { pattern: "x" } }],
      usage: {},
      stop: answered ? "end_turn" : "tool_use",
      thought: 0,
    };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 4 });
  assert.equal(held.attempt, 2);
  assert.equal(held.text, "CODEX: 0 findings");
});

/* The reading is what the rest of the budget was wanted for: it stays in the conversation, and the
   payload opens it once. Opening a second conversation paid for the first attempt's calls twice. */
test("the attempt carried on opens on the transcript the first one built, not on the payload again", async () => {
  const sent = [];
  let calls = 0;
  const stub = async (values, model, messages) => {
    sent.push(structuredClone(messages));
    calls += 1;
    const answered = calls > 2;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${calls}`, name: "grep", input: { pattern: "needle" } }],
      usage: {}, stop: answered ? "end_turn" : "tool_use", thought: 0,
    };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  assert.equal(held.attempt, 2);
  assert.equal(calls, 3, "two calls of the first attempt and one of the rest, not two and then five");
  const last = sent.at(-1);
  assert.equal(last.filter((one) => one.content === "go").length, 1, "one opening in the whole conversation");
  assert.equal(last[0].content, "go", "and it is still the first turn");
  assert.ok(last.length > sent[0].length, "the resumed call carries the turns the first attempt built");
  const said = JSON.stringify(last);
  assert.match(said, /More tool calls are available after all/u,
    "the closing instruction the first attempt was given is superseded, not left standing");
  const blocks = last.flatMap((one) => (Array.isArray(one.content) ? one.content : []));
  assert.equal(blocks.filter((one) => one.type === "tool_use").length, 2, "both reads the first attempt made");
  assert.equal(blocks.filter((one) => one.type === "tool_result").length, 2, "each already answered, so neither is made again");
});

/* Before this, a retry from 2 to 5 spent seven calls and logged the second attempt's count alone, so
   the field the calls histogram buckets under-reported the ladder by exactly what it cost. */
test("a retried row counts the whole conversation's calls, not the resumption's", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    const answered = calls > 2;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${calls}`, name: "grep", input: { pattern: "x" } }],
      usage: {}, stop: answered ? "end_turn" : "tool_use", thought: 0,
    };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  assert.equal(held.calls, 3, "the two the first attempt spent and the one that answered");
  assert.equal(held.budget, 5);
});

/* A cap the consult has stopped enforcing leaves no refusal behind: the caller is told a tool was not
   run, and on the strength of that the reviewer is never asked about what it wanted to read. */
test("tool calls refused past the cap are served by the attempt carried on, once, and stop being refused", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return calls === 1
      ? { text: "I could not check the caller.", calls: [{ id: "c1", name: "grep", input: { pattern: "x" } }], usage: {}, stop: "tool_use", thought: 0 }
      : { text: "CODEX: 0 findings", calls: [], usage: {}, stop: "end_turn", thought: 0 };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 1, ceiling: 3 });
  assert.equal(held.attempt, 2);
  assert.equal(held.tools.filter((one) => one.name === "grep").length, 1, "run once, on the attempt carried on");
  assert.equal(held.refused.filter((one) => /past the call cap/u.test(one)).length, 0,
    "and no longer refused, the cap that refused it having been raised");
});

/* The three ways an attempt can be cut short leave the conversation in three states, and a resumption
   that answers only one of them either drops a tool_use the transport demands an answer to, or ends on
   an assistant turn the next call cannot follow. */
test("an attempt cut short having asked for no tools is carried on the same way", async () => {
  const sent = [];
  let calls = 0;
  const stub = async (values, model, messages) => {
    sent.push(structuredClone(messages));
    calls += 1;
    return { text: calls === 1 ? "I could not read the caller." : "CODEX: 0 findings", calls: [], usage: {}, stop: "end_turn", thought: 0 };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 4 });
  assert.equal(held.attempt, 2);
  assert.equal(held.calls, 2, "the one it spent and the one that answered");
  assert.match(JSON.stringify(sent.at(-1)), /More tool calls are available after all/u);
  assert.equal(sent.at(-1).at(-2).role, "assistant", "the unfinished answer is in the conversation it answers");
});

/* Both attempts were billed, so both are on the row — and only once, the accounting running inside one
   loop rather than being added up by the caller afterwards. */
test("a carried-on consult bills both attempts once and concatenates what each of them did", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    const answered = calls > 2;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${calls}`, name: "grep", input: { pattern: "x" } }],
      usage: { input_tokens: 10, output_tokens: 2 }, stop: answered ? "end_turn" : "tool_use", thought: 4,
    };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  assert.equal(held.usage.input_tokens, 30, "three calls at ten, counted in one place");
  assert.equal(held.usage.output_tokens, 6);
  assert.equal(held.thought, 12);
  assert.equal(held.tools.length, 2, "both attempts' tool calls, the first attempt's kept");
});

/* The transcript is what the resumption needs and what nothing else may have: a row carrying it would
   put every file the reviewer read into the consult log, which masks a payload and not a message list. */
test("the state a resumption reads is on no copy of the result and in no serialization of it", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    const answered = calls > 2;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${calls}`, name: "grep", input: { pattern: "x" } }],
      usage: {}, stop: answered ? "end_turn" : "tool_use", thought: 0,
    };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  assert.equal(Object.keys(held).includes("carried"), false, "a spread of the result drops it");
  assert.equal(JSON.stringify(held).includes("carried"), false, "and nothing serializing the result carries it");
});

/* Carrying on is not a second chance without end: the ceiling is still where a consult that will not
   answer fails, and it fails at the caller rather than logging as a review. */
test("an attempt that reads through the ceiling too still fails", async () => {
  const stub = async () => ({
    text: "", calls: [{ id: "c", name: "grep", input: { pattern: "x" } }], usage: {}, stop: "tool_use", thought: 0,
  });
  await assert.rejects(
    () => reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 3 }),
    /spent all 3 call\(s\) reading and never answered/u,
  );
});

/* A reviewer never told how many calls it had left spent its last one on a read and answered nothing
   (ISS-326). The count rides each tool result, where the model reads it, and counts the calls after
   the one reading it, so the result the last call reads is the one that says so. */
test("each tool result ends on the calls left, and the one the last call reads says it is the last", async () => {
  const sent = [];
  const stub = async (values, model, messages) => {
    sent.push(structuredClone(messages));
    const answered = sent.length === 3;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${sent.length}`, name: "list_dir", input: {} }],
      usage: {}, stop: answered ? "end_turn" : "tool_use", thought: 0,
    };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 3, ceiling: 3 });
  assert.equal(held.calls, 3);
  const results = sent.at(-1).flatMap((one) => (Array.isArray(one.content) ? one.content : []))
    .filter((one) => one.type === "tool_result");
  assert.equal(results.length, 2);
  assert.match(results[0].content, /\n\ncalls left: 1 after this one$/u, "read by the second of three calls");
  assert.match(results[1].content, /\n\nlast call — answer now$/u, "read by the third");
  assert.equal(held.refused.length, 0);
});

test("a refused tool call ends on the count for the model and reaches the operator without it", async () => {
  let calls = 0;
  const sent = [];
  const stub = async (values, model, messages) => {
    calls += 1;
    sent.push(structuredClone(messages));
    return calls === 1
      ? { text: "", calls: [{ id: "c1", name: "read_file", input: {} }], usage: {}, stop: "tool_use", thought: 0 }
      : { text: "CODEX: 0 findings", calls: [], usage: {}, stop: "end_turn", thought: 0 };
  };
  const held = await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 4, ceiling: 4 });
  const result = sent.at(-1).flatMap((one) => (Array.isArray(one.content) ? one.content : []))
    .find((one) => one.type === "tool_result");
  assert.equal(result.is_error, true);
  assert.match(result.content, /\n\ncalls left: 2 after this one$/u);
  assert.equal(held.refused.length, 1);
  assert.equal(held.refused[0].includes("calls left"), false, "the operator's list is the tool's own answer");
});

test("an attempt carried on counts what is left against the ceiling it was raised to", async () => {
  const sent = [];
  const stub = async (values, model, messages) => {
    sent.push(structuredClone(messages));
    const answered = sent.length > 2;
    return {
      text: answered ? "CODEX: 0 findings" : "",
      calls: answered ? [] : [{ id: `c${sent.length}`, name: "list_dir", input: {} }],
      usage: {}, stop: answered ? "end_turn" : "tool_use", thought: 0,
    };
  };
  await reviewed({}, "m", "go", scopeFor(REPO), () => {}, stub, { budget: 2, ceiling: 5 });
  const results = sent.at(-1).flatMap((one) => (Array.isArray(one.content) ? one.content : []))
    .filter((one) => one.type === "tool_result");
  assert.match(results[0].content, /last call — answer now$/u, "true when the first attempt, of two calls, served it");
  assert.match(results[1].content, /calls left: 2 after this one$/u, "served by the attempt carried on to five");
});
