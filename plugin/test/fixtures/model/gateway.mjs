/* A stand-in for the second model's gateway, for a case that spawns the CLI: it answers each Messages
   request with the one tool call the case scripts for that tool, streamed the way the gateway frames
   it, and keeps every request it was sent. A tool the case scripted nothing for is answered 500, which
   is the failure a case about a refused question wants. */
import { createServer } from "node:http";

const framed = (events) => events.map((one) => `event: ${one.type}\ndata: ${JSON.stringify(one)}\n\n`).join("");

/* One tool_use block and the frames around it, as `wire/messages-stream.mjs` reads them. */
const streamed = (name, input) => framed([
  { type: "message_start", message: { usage: { input_tokens: 10 } } },
  { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t0", name } },
  { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 5 } },
]);

/** `answers` maps a tool's name to the input its call carries; the url goes in `codex.url`. */
export const fakeGateway = async (answers = {}) => {
  const sent = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      sent.push(parsed);
      const name = parsed.tool_choice?.name ?? parsed.tools?.[0]?.name;
      if (!Object.hasOwn(answers, name)) {
        response.writeHead(500, { "content-type": "text/plain" });
        return response.end(`no answer scripted for ${name}`);
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      return response.end(streamed(name, answers[name]));
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    sent,
    close: () => new Promise((done) => server.close(done)),
  };
};
