/* One bounded model call over data: the data goes in as one user turn, and what comes back is the
   input of the one tool the call is forced through, so a caller reads a shape rather than prose. The
   answer is streamed, since a gateway's edge cuts a request silent past its timeout. It
   is not a review: no prompt of the consult's, no rounds, no log. A caller that needs a model to read
   figures and answer in a schema takes this rather than a second copy of the request. */
import { consume } from "./messages-stream.mjs";
import { clockFor, deadlineOf, ranOut, within } from "./request.mjs";

const ERROR_CHARS = 400;
const DEFAULT_MAX_TOKENS = 16_000;

/** What a call spent, in the provider's own counts; absent counts are nought, never guessed. */
export const spentOf = (usage) => ({
  input: Number(usage?.input_tokens ?? 0) + Number(usage?.cache_read_input_tokens ?? 0)
    + Number(usage?.cache_creation_input_tokens ?? 0),
  output: Number(usage?.output_tokens ?? 0),
});

/** The tool input, what the call spent and how long it took; throws in words on anything else. The
 *  effort is whatever the model id carries: no reasoning parameter is sent, so an id naming its level
 *  is the one channel. `endpoint` is `{ url, key }`; `send` stands in for `fetch` in the suite. */
export const modelCall = async ({ endpoint, model, system, data, tool, maxTokens = DEFAULT_MAX_TOKENS,
  signal = null, send = fetch }) => {
  const deadline = within(deadlineOf());
  const started = Date.now();
  let answer;
  try {
    answer = await send(`${endpoint.url.replace(/\/+$/u, "")}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream", "anthropic-version": "2023-06-01",
        "x-api-key": endpoint.key },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        stream: true,
        messages: [{ role: "user", content: typeof data === "string" ? data : JSON.stringify(data) }],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      }),
      signal: clockFor(deadline, signal),
    });
  } catch (error) {
    throw new Error(`${model} was not reached: ${ranOut(error, deadline)}`);
  }
  if (!answer.ok) {
    const body = await answer.text().catch(() => "");
    throw new Error(`the gateway answered ${answer.status} for ${model}: ${body.slice(0, ERROR_CHARS)}`);
  }
  let held;
  try {
    held = await consume(answer.body, () => {});
  } catch (error) {
    throw new Error(`${model}'s answer broke off: ${ranOut(error, deadline)}`);
  }
  const call = held.calls.find((one) => one.name === tool.name);
  if (!call) throw new Error(`${model} answered without calling \`${tool.name}\`, so there is no answer to read`);
  return { input: call.input, spent: spentOf(held.usage), ms: Date.now() - started };
};
