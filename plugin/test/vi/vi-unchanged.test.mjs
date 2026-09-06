/* The verb is proved through the wrapper a caller actually spawns, because the thing under test is
   the number that reaches a shell, not a function's return. The gateway is a local server that
   answers with whatever it was asked (ISS-84), so no live call is spent on a code. */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ranAsync, tempRoom } from "../fixtures.mjs";
import { TRANSLATE_UNCHANGED } from "../../src/tools/vi-exit.mjs";

const BUNDLED = fileURLToPath(new URL("../../bin/vi-natural", import.meta.url));
const LAYER = new URL("../../src/tools/vi.mjs", import.meta.url);
const SOURCE = "git fetch origin";

/** A gateway answering every string with `reply` of it, and a room whose config points at it. */
const gatewayOn = async (t, reply) => {
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
  const room = tempRoom("vi-unchanged-");
  mkdirSync(join(room, "vi-natural"));
  const gateway = { base_url: `http://127.0.0.1:${server.address().port}/v1`, api_key: "k", model: "m" };
  writeFileSync(join(room, "vi-natural", "config.json"), JSON.stringify(gateway));
  return room;
};

const ran = (room, argv) => ranAsync(BUNDLED, argv, { ...process.env, XDG_CONFIG_HOME: room }, room);
const translate = (room, text) => ran(room, ["translate", "--kind", "prose", "--no-glossary", text]);

test("a string handed back as it was sent leaves by its own code, named once on stderr", async (t) => {
  const room = await gatewayOn(t, (text) => text);
  const run = await translate(room, SOURCE);
  assert.equal(run.status, TRANSLATE_UNCHANGED, `the code a caller reads:\n${run.stderr}`);
  assert.equal(run.stdout, `${SOURCE}\n`, "stdout still carries it and nothing else, which is the right answer");
  const named = run.stderr.split("\n").filter((line) => line.includes(SOURCE));
  assert.equal(named.length, 1, `one line names the string that came back:\n${run.stderr}`);
});

test("a string the gateway translated leaves by zero, with nothing said about it", async (t) => {
  const room = await gatewayOn(t, (text) => `translated: ${text}`);
  const run = await translate(room, SOURCE);
  assert.equal(run.status, 0, `nothing is owed for a string that changed:\n${run.stderr}`);
  assert.equal(run.stdout, `translated: ${SOURCE}\n`);
  assert.ok(!run.stderr.includes("unchanged"), `and nothing is said of it:\n${run.stderr}`);
});

test("the usage text lists the code, so a caller learns it without reading the source", async () => {
  const run = await ranAsync(BUNDLED, ["-h"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`· ${TRANSLATE_UNCHANGED} translate only:`, "u"));
});

test("i18n and doc leave by the codes they always have, where every string came back as it went in", async (t) => {
  const room = await gatewayOn(t, (text) => text);
  writeFileSync(join(room, "en.json"), JSON.stringify({ save: "Save" }));
  writeFileSync(join(room, "readme.md"), "One paragraph of prose, waiting to be translated.\n");
  const locale = await ran(room, ["i18n", "en.json", "--no-glossary"]);
  assert.equal(locale.status, 0, `a locale file gained no code from translate's:\n${locale.stderr}`);
  const document = await ran(room, ["doc", "readme.md", "--no-glossary"]);
  assert.equal(document.status, 0, `nor did a document:\n${document.stderr}`);
});

test("a title handed back as it was sent is still posted by the layer forge writes titles through", async (t) => {
  const room = await gatewayOn(t, (text) => text);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "any", translate: "vi" }));
  const call = `import("${LAYER.href}")`
    + `.then((m) => console.log(JSON.stringify(m.translated({ title: ${JSON.stringify(SOURCE)} }))))`;
  const run = await ranAsync(process.execPath, ["-e", call], { ...process.env, XDG_CONFIG_HOME: room }, room);
  assert.equal(run.status, 0, `the write is not refused on a title with nothing to translate:\n${run.stderr}`);
  assert.deepEqual(JSON.parse(run.stdout), { title: SOURCE }, "and the title stands as it was written");
});
