/* The retry table is what decides a second attempt. A status outside it has to cost one request:
   an invalid key does not become valid by being asked again, and every retry sleeps. */
import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "../../vi-natural/gateway/client.mjs";

const CONFIG = { baseUrl: "https://gateway.example/v1", apiKey: "k", model: "m", effort: null };

const answering = (t, status, body) => {
  const held = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async () => {
    calls.push(status);
    return { ok: false, status, text: async () => body };
  };
  t.after(() => {
    globalThis.fetch = held;
  });
  return calls;
};

test("a status in no retry table costs one request", async (t) => {
  const calls = answering(t, 401, "invalid api key");
  await assert.rejects(new Client(CONFIG).chat("system", "user"), /gateway returned 401/u);
  assert.deepEqual(calls, [401], "asked once, not three times over three seconds");
});

/* Cloudflare's own, in no OpenAI error table: a 524 once aborted a run instead of retrying. */
test("a status in it is retried to the limit", async (t) => {
  const calls = answering(t, 524, "origin timed out");
  const client = new Client(CONFIG, { retries: 2 });
  await assert.rejects(client.chat("system", "user"), /gateway returned 524/u);
  assert.deepEqual(calls, [524, 524]);
});
