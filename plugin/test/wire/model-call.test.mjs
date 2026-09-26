/* One bounded model call, over a stand-in for `fetch`: what it sends, what it reads back, and the
   three ways it answers in words rather than with a shape. */
import assert from "node:assert/strict";
import test from "node:test";

import { modelCall, spentOf } from "../../src/wire/model-call.mjs";

const TOOL = { name: "answer", description: "the answer", input_schema: { type: "object", properties: { sum: { type: "number" } } } };
const ENDPOINT = { url: "http://gateway.test/", key: "sk-test" };

/* A Messages stream carrying the given content blocks and usage, framed as the gateway frames it. */
const streamOf = ({ content = [], usage = {} }) => {
  const events = [{ type: "message_start", message: { usage: { input_tokens: usage.input_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens } } }];
  content.forEach((block, index) => {
    if (block.type === "tool_use") {
      events.push({ type: "content_block_start", index, content_block: { type: "tool_use", id: `t${index}`, name: block.name } },
        { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
        { type: "content_block_stop", index });
    } else events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text ?? "" } });
  });
  events.push({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: usage.output_tokens } });
  const text = events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");
  return [new TextEncoder().encode(text)];
};

const replying = (status, body) => {
  const sent = [];
  const send = async (url, init) => {
    sent.push({ url, init, body: JSON.parse(init.body) });
    return { ok: status < 400, status, text: async () => String(body), body: status < 400 ? streamOf(body) : null };
  };
  return { sent, send };
};

test("the call forces its one tool, carries the data as the user turn and no reasoning parameter, and reads back the tool's input", async () => {
  const { sent, send } = replying(200, { content: [{ type: "thinking", thinking: "…" },
    { type: "tool_use", name: "answer", input: { sum: 42 } }], usage: { input_tokens: 20, cache_read_input_tokens: 5, output_tokens: 7 } });
  const answer = await modelCall({ endpoint: ENDPOINT, model: "cx/model-max", system: "Sum them.", data: { a: 2, b: 40 }, tool: TOOL, send });
  assert.deepEqual(answer.input, { sum: 42 });
  assert.deepEqual(answer.spent, { input: 25, output: 7 });
  const [one] = sent;
  assert.equal(one.url, "http://gateway.test/v1/messages");
  assert.equal(one.init.headers["x-api-key"], "sk-test");
  assert.deepEqual(one.body.tool_choice, { type: "tool", name: "answer" });
  assert.deepEqual(one.body.messages, [{ role: "user", content: '{"a":2,"b":40}' }]);
  assert.equal(one.body.model, "cx/model-max");
  assert.equal(one.body.stream, true, "streamed, so a slow model's silence does not trip the gateway's edge");
  for (const key of ["reasoning_effort", "thinking", "reasoning"]) assert.ok(!(key in one.body), `the effort rides the id, not ${key}`);
});

test("a refused request, an answer with no call of the tool, a stream that errs and a gateway not reached are each said in words", async () => {
  await assert.rejects(modelCall({ endpoint: ENDPOINT, model: "cx/x", system: "", data: {}, tool: TOOL, send: replying(404, "model not supported").send }),
    /the gateway answered 404 for cx\/x: model not supported/u);
  await assert.rejects(modelCall({ endpoint: ENDPOINT, model: "cx/x", system: "", data: {}, tool: TOOL,
    send: replying(200, { content: [{ type: "text", text: "hello" }] }).send }), /cx\/x answered without calling `answer`/u);
  await assert.rejects(modelCall({ endpoint: ENDPOINT, model: "cx/x", system: "", data: {}, tool: TOOL,
    send: async () => { throw new Error("connect ECONNREFUSED"); } }), /cx\/x was not reached: connect ECONNREFUSED/u);
  const erring = [new TextEncoder().encode(`data: ${JSON.stringify({ type: "error", error: { type: "overloaded_error" } })}\n\n`)];
  await assert.rejects(modelCall({ endpoint: ENDPOINT, model: "cx/x", system: "", data: {}, tool: TOOL,
    send: async () => ({ ok: true, status: 200, body: erring }) }), /cx\/x's answer broke off: gateway streamed an error: .*overloaded_error/u);
});

test("what a call spent counts every input the provider bills and nought for what it did not say", () => {
  assert.deepEqual(spentOf(undefined), { input: 0, output: 0 });
  assert.deepEqual(spentOf({ input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 }), { input: 6, output: 4 });
});
