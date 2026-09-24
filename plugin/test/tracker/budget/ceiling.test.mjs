/* The clock a hook process is killed at, reaching the ladder: a budget the retries can run past is not
   one (ISS-215). A process that names no clock — every CLI verb — keeps the ladder it had. */
import assert from "node:assert/strict";
import test from "node:test";
import { clearInterval, setInterval } from "node:timers";

import { callTool } from "../../../src/tracker/rest.mjs";
import { boundedBy } from "../../../src/wire/request.mjs";

const CLOCK = "a case's clock";
let asks = 0;

/* Every request answers `status` with these headers, and the clock is dropped after, being the process's. */
const answering = async (status, headers, call) => {
  const live = globalThis.fetch;
  asks = 0;
  globalThis.fetch = async () => {
    asks += 1;
    return {
      ok: status < 400,
      status,
      headers: new Map(Object.entries(headers)),
      text: async () => JSON.stringify({ code: "RATE_LIMITED", message: "slow down" }),
    };
  };
  try {
    return await call();
  } finally {
    globalThis.fetch = live;
    boundedBy(null);
  }
};

const read = () => callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true);

test("a rate-limited read whose wait outlasts the clock is not sent again, and its refusal names the clock", async () => {
  boundedBy(() => 1_000, CLOCK);
  const answer = await answering(429, { "retry-after": "30" }, read);
  assert.equal(asks, 1, `sent ${asks} times: the 30s wait was slept into the kill`);
  assert.match(answer.refused, /waiting 30s to send it again would outlast the 1s left of a case's clock, so it was not sent again/u);
});

test("one attempt's deadline is cut to what the clock has left", async () => {
  boundedBy(() => 50, CLOCK);
  const live = globalThis.fetch;
  globalThis.fetch = (url, init) => new Promise((done, no) => {
    init.signal.addEventListener("abort", () => no(init.signal.reason));
  });
  /* A real request holds a socket open while it waits; this stand-in holds nothing, and the timeout's own timer keeps no process alive. */
  const held = setInterval(() => {}, 1_000);
  try {
    const answer = await read();
    assert.match(answer.refused, /ran out after 0\.05s \(a case's clock\)/u,
      "the attempt was cut at the clock, not at the sixty seconds config.json gives one");
  } finally {
    clearInterval(held);
    globalThis.fetch = live;
    boundedBy(null);
  }
});

test("a clock with nothing left sends nothing, and says which clock it was", async () => {
  boundedBy(() => 0, CLOCK);
  const answer = await answering(200, {}, read);
  assert.equal(asks, 0);
  assert.equal(answer.refused, "Nothing was sent: a case's clock had no time left.");
});

test("with no clock named the ladder is the four attempts it was", async () => {
  const answer = await answering(429, { "retry-after": "0.01" }, read);
  assert.equal(asks, 4, `sent ${asks} times where the ladder sends four`);
  assert.match(answer.refused, /slow down/u, "and the last answer is the tracker's own words");
});
