/* A local gateway for proving `vi-natural` through the wrapper a caller spawns, so no live call is
   spent on a code or a refusal. */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

/** A gateway answering every string with `reply` of it, and a room whose config points at it. */
export const gatewayOn = async (t, reply, prefix = "vi-gateway-") => {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      // The payload is the last blank-line-separated part: pretty-printed JSON holds no blank line,
      // and the task before it does hold braces of its own.
      const sent = JSON.parse(JSON.parse(body).messages.at(-1).content.split("\n\n").at(-1));
      // A verb that sends key context sends `{ k, s }` per string where translate sends the string.
      const stringOf = (value) => (typeof value === "string" ? value : value.s);
      const answer = Object.fromEntries(Object.entries(sent).map(([key, held]) => [key, reply(stringOf(held))]));
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(answer) } }] })}\n\ndata: [DONE]\n\n`);
    });
  });
  await new Promise((listening) => server.listen(0, "127.0.0.1", listening));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const room = tempRoom(prefix);
  mkdirSync(join(room, "vi-natural"));
  const gateway = { base_url: `http://127.0.0.1:${server.address().port}/v1`, api_key: "k", model: "m" };
  writeFileSync(join(room, "vi-natural", "config.json"), JSON.stringify(gateway));
  return room;
};
