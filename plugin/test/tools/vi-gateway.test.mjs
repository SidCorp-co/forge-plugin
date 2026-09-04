/* The retry table is what decides a second attempt. A status outside it has to cost one request:
   an invalid key does not become valid by being asked again, and every retry sleeps. */
import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "../../vi-natural/gateway/client.mjs";
import { translateItems } from "../../vi-natural/gateway/engine.mjs";

const CONFIG = { baseUrl: "https://gateway.example/v1", apiKey: "k", model: "m", effort: null };
/* One key whose translation drops a placeholder, one that invents one, one that is clean. */
const SOURCES = { a: "Save {count} items", b: "Open {name}", c: "Delete" };

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

/* The gate no golden reaches: tools/diff-python.mjs holds `placeholders.diff` against its recorded
   answers, so the accounting stays right while nothing says it is consulted. Delete the `rejected`
   call in engine.mjs and every golden is still green (AC-13-2-1, AC-19-5-1). */
test("a key reaches the results only where its translation carries the source's placeholders and no others", async () => {
  const asked = [];
  const answers = {
    "Save {count} items": "Luu items",
    "Open {name}": "Mo {name} {extra}",
    Delete: "Xoa",
  };
  const client = {
    chat: async (system, user) => {
      asked.push(user);
      const wanted = Object.keys(answers).filter((source) => user.includes(source));
      return JSON.stringify(Object.fromEntries(
        wanted.map((source) => [Object.entries(SOURCES).find(([, one]) => one === source)[0], answers[source]]),
      ));
    },
  };
  const { results, problems } = await translateItems(client, Object.entries(SOURCES));

  assert.deepEqual([...results], [["c", "Xoa"]], "the two that break the accounting are left out");
  assert.deepEqual(problems.map((one) => one.key).sort(), ["a", "b"]);
  assert.match(problems.find((one) => one.key === "a").reason, /missing \{count\}/u, "and each says what it lost");
  assert.match(problems.find((one) => one.key === "b").reason, /invented \{extra\}/u);
  assert.equal(asked.length, 3, "the batch, then one second chance per rejected key");
});
