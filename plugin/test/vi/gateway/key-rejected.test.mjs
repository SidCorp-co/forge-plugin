/* A key the gateway refuses is refused for every string after it, so a 401 ends the run on the
   request that met it and is said once, as the credential, never once per block (ISS-2428). Driven
   through the wrapper a caller spawns, against a local gateway, so no live call is spent. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { Client } from "../../../vi-natural/gateway/client.mjs";
import { translateItems } from "../../../vi-natural/gateway/engine.mjs";

const BUNDLED = fileURLToPath(new URL("../../../bin/vi-natural", import.meta.url));
const KEY = "sm_95aSECRETVALUE10cd";
const PRINTED = "sm_95a…10cd";
const REFUSED = JSON.stringify({ error: { message: `Invalid API key: ${KEY}`, type: "authentication_error" } });
const TWICE = `key ${KEY} rejected; ${KEY} is not valid`;

const streamed = (answer) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(answer) } }] })}\n\ndata: [DONE]\n\n`;

/** A gateway whose nth request is answered by `script(n)` — `{ status, body }` — and a room whose own
 *  file holds the key, so that file is the source a refusal has to name. */
const gatewayOn = async (t, script) => {
  const requests = [];
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      const { status, body } = script(requests.length);
      requests.push(`${request.method} ${request.url}`);
      response.writeHead(status, { "Content-Type": status === 200 ? "text/event-stream" : "application/json" });
      response.end(body);
    });
  });
  await new Promise((listening) => server.listen(0, "127.0.0.1", listening));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const room = tempRoom("vi-key-rejected-");
  mkdirSync(join(room, "vi-natural"));
  const file = join(room, "vi-natural", "config.json");
  writeFileSync(file, JSON.stringify({ base_url: `http://127.0.0.1:${server.address().port}/v1`, api_key: KEY, model: "m" }));
  return { room, file, requests };
};

const ran = (room, argv) => {
  const env = { ...process.env, HOME: room, XDG_CONFIG_HOME: room };
  // The key under test is the room's own file's; a borrowed machine store would answer first.
  delete env.FORGE_BORROW_FROM;
  return ranAsync(BUNDLED, [...argv, "--no-glossary"], env, room);
};

const refusing = () => ({ status: 401, body: REFUSED });

/** Each verb that reaches the gateway, with the file it reads written into the room first. */
const VERBS = {
  doc: (room) => {
    writeFileSync(join(room, "en.md"), "# Title\n\nOne paragraph.\n\nTwo paragraph.\n\nThree paragraph.\n");
    return ["doc", join(room, "en.md"), "-o", join(room, "vi.md")];
  },
  translate: () => ["translate", "Save the file"],
  i18n: (room) => {
    writeFileSync(join(room, "en.json"), JSON.stringify({ a: "Save", b: "Open", c: "Close" }));
    return ["i18n", join(room, "en.json"), "-o", join(room, "vi.json")];
  },
  review: (room) => {
    writeFileSync(join(room, "vi.json"), JSON.stringify({ a: "Lưu", b: "Mở" }));
    return ["review", join(room, "vi.json")];
  },
};

test("a 401 on the first request of doc, translate, i18n or review, or on a doc's per-string retry, is the last request that run sends", async (t) => {
  for (const [verb, argv] of Object.entries(VERBS)) {
    const { room, requests } = await gatewayOn(t, refusing);
    const run = await ran(room, argv(room));
    assert.equal(run.status, 1, `${verb} fails:\n${run.stderr}`);
    assert.deepEqual(requests, ["POST /v1/chat/completions"], `${verb} asks once and stops`);
  }
  // The batch answers with nothing usable, so every block is asked for again alone, and the first
  // of those asks is refused.
  const { room, requests } = await gatewayOn(t, (n) => (n === 0 ? { status: 200, body: streamed({}) } : refusing()));
  const run = await ran(room, VERBS.doc(room));
  assert.equal(run.status, 1, run.stderr);
  assert.equal(requests.length, 2, "the batch, then the one retry the 401 answered, and no other");
});

test("a 401 is reported once, naming the key's fingerprint, where it was read from and the command that replaces it", async (t) => {
  const { room, file } = await gatewayOn(t, refusing);
  const run = await ran(room, VERBS.doc(room));
  const lines = run.stderr.split("\n").filter((line) => line.startsWith("vi-natural:"));
  assert.equal(lines.length, 1, `one error line, not one per block:\n${run.stderr}`);
  assert.ok(!/block \d+:/u.test(run.stderr), `no block is reported:\n${run.stderr}`);
  const [line] = lines;
  assert.ok(line.includes(`rejected the API key ${PRINTED} with 401`), line);
  assert.ok(line.includes(`read from ${file}`), `the file the key came from:\n${line}`);
  assert.ok(line.endsWith("forge doctor --vi-key <key>"), `the command that replaces it:\n${line}`);
});

test("a doc run stopped by a rejected key leaves its output path as it found it", async (t) => {
  const { room } = await gatewayOn(t, refusing);
  const argv = VERBS.doc(room);
  await ran(room, argv);
  assert.equal(existsSync(join(room, "vi.md")), false, "no all-English file where none was");

  writeFileSync(join(room, "vi.md"), "earlier translation\n");
  await ran(room, argv);
  assert.equal(readFileSync(join(room, "vi.md"), "utf8"), "earlier translation\n", "and an earlier one untouched");
});

test("doctor fails on a 401 listing models and sends no translation request", async (t) => {
  const { room, requests } = await gatewayOn(t, refusing);
  const run = await ran(room, ["doctor"]);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(requests, ["GET /v1/models"], "the round trip is never attempted");
  assert.ok(!run.stdout.includes("round trip"), run.stdout);
  assert.match(run.stderr, /rejected the API key .* with 401 listing models/u);
});

const CONFIG = { baseUrl: "https://gateway.example/v1", apiKey: KEY, model: "m", effort: null, from: () => "the test's own file" };

const answering = (t, reply) => {
  const held = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(url);
    return reply(calls.length - 1, JSON.parse(init.body ?? "null"));
  };
  t.after(() => {
    globalThis.fetch = held;
  });
  return calls;
};

const failing = (status, body) => ({ ok: false, status, text: async () => body, json: async () => JSON.parse(body) });

const streamOf = (text) => ({
  ok: true,
  body: {
    getReader: () => {
      const queue = [text];
      return {
        read: async () => (queue.length ? { done: false, value: new TextEncoder().encode(queue.shift()) } : { done: true }),
        cancel: async () => {},
      };
    },
  },
});

test("a key a gateway echoes back is printed as its fingerprint wherever the error came from", async (t) => {
  const cases = {
    "a refused completion": [() => failing(401, TWICE), (client) => client.chat("s", "u")],
    "another failing completion": [() => failing(400, TWICE), (client) => client.chat("s", "u")],
    "a refused model listing": [() => failing(401, TWICE), (client) => client.models()],
    "another failing model listing": [() => failing(500, TWICE), (client) => client.models()],
    "a streamed error event": [() => streamOf(`data: ${JSON.stringify({ error: { message: TWICE } })}\n`), (client) => client.chat("s", "u")],
  };
  for (const [where, [reply, call]] of Object.entries(cases)) {
    answering(t, reply);
    const error = await call(new Client(CONFIG, { retries: 1 })).then(() => null, (thrown) => thrown);
    assert.ok(error, `${where} fails`);
    assert.ok(!error.message.includes(KEY), `${where} prints no key:\n${error.message}`);
    assert.ok(error.message.includes(TWICE.split(KEY).join(PRINTED)), `${where} prints the fingerprint at both places:\n${error.message}`);
  }
});

test("a batch failing on any status but 401 is still asked for again one string at a time", async (t) => {
  const items = [["a", "Save"], ["b", "Open"]];
  for (const status of [403, 404, 500, 524]) {
    const calls = answering(t, (n, body) => {
      if (n === 0) return failing(status, "no");
      const sent = JSON.parse(body.messages.at(-1).content.split("\n\n").at(-1));
      const answer = Object.fromEntries(Object.keys(sent).map((key) => [key, `vi ${key}`]));
      return streamOf(streamed(answer));
    });
    const { results, problems } = await translateItems(new Client(CONFIG, { retries: 1 }), items);
    assert.equal(calls.length, 3, `${status}: the batch, then one per string`);
    assert.deepEqual([...results], [["a", "vi a"], ["b", "vi b"]], `${status}: what came back is kept`);
    assert.deepEqual(problems, []);
  }
});
