import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds a working token. */
const sandbox = mkdtempSync(join(tmpdir(), "forge-codex-rounds-"));
process.env.XDG_CONFIG_HOME = sandbox;

const { reviewed } = await import("../../src/codex/codex-rounds.mjs");
const { scopeFor } = await import("../../src/codex/codex-tools.mjs");

const REPO = join(sandbox, "repo");
mkdirSync(REPO, { recursive: true });
writeFileSync(join(REPO, ".git"), "gitdir: elsewhere\n");

/* The whole point of the ladder: a reply that says it could not check is not the review, it is the
   review the budget cut short. It gets one more attempt at the ceiling, and the caller sees nothing
   until then — "retried before it is shown" and a stream to stdout cannot both hold. */
test("an unfinished review is retried at the ceiling before a word of it is shown", async () => {
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

/* At the ceiling there is nothing left to retry with, so the reply streams as it always did. */
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
   so it is retried rather than raised at the caller. */
test("an attempt that read for every call and never answered is retried, not raised", async () => {
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
