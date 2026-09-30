/* Where the clock a hook process is killed at went, said by every refusal about that clock, and the
   pacing wait that would leave the call after it no room declined rather than taken (ISS-2385). A
   stand-down that named only the last attempt's bound read "ran out after 0.062s" where a wait for the
   tracker's reset had spent the other eight seconds. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../../fixtures.mjs";
import { patience } from "../../patience.mjs";
import { callTool } from "../../../src/tracker/rest.mjs";
import { forgetBudget } from "../../../src/wire/budget.mjs";
import { forgetClock } from "../../../src/wire/shared-clock.mjs";
import { boundedBy } from "../../../src/wire/request.mjs";

/* This file's own account, never the shell's (ISS-2681). The ladder's first wait is 0.2s so a case
   can watch the waits between attempts hold the clock. */
const HOME = tempHome("budget-clock-spent");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(join(HOME.path, "forge", "config.json"), JSON.stringify({ url: "https://stub.example/mcp", token: "t", retrySeconds: 0.2 }));
process.env.XDG_CONFIG_HOME = HOME.path;

const CLOCK = "a case's clock";

const spentBudget = (reset) => new Map(Object.entries({
  "x-ratelimit-scope": "read",
  "x-ratelimit-limit": "1",
  "x-ratelimit-remaining": "0",
  "x-ratelimit-reset": String(reset),
}));

const answer = (status, headers = new Map()) => ({
  ok: status < 400,
  status,
  headers,
  text: async () => JSON.stringify({ code: status === 429 ? "RATE_LIMITED" : "X", message: "slow down" }),
});

/* A request that never answers until its signal gives up, holding a timer so the loop has something
   to wait on: `AbortSignal.timeout` keeps no process alive. */
const stalled = (init) => new Promise((done, no) => {
  const never = setTimeout(done, 30_000);
  init.signal.addEventListener("abort", () => {
    clearTimeout(never);
    no(init.signal.reason);
  });
});

const stderrOf = async (call) => {
  const held = console.error;
  const lines = [];
  console.error = (...said) => lines.push(said.join(" "));
  try {
    return { value: await call(), said: lines.join("\n") };
  } finally {
    console.error = held;
  }
};

/* Every piece of module state a case moves is dropped either side of it: the budget, the shared
   clock, the process's clock and the fetch. */
const isolated = async (fetcher, call) => {
  const live = globalThis.fetch;
  forgetBudget();
  forgetClock();
  globalThis.fetch = fetcher;
  try {
    return await call();
  } finally {
    globalThis.fetch = live;
    boundedBy(null);
    forgetBudget();
    forgetClock();
  }
};

const read = (held = {}) => callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true, held);

const heldBy = (said, words) => {
  const found = new RegExp(`${words} held (none|(\\d+\\.\\d\\d)s)`, "u").exec(said);
  assert.ok(found, `the account names ${words}:\n${said}`);
  return found[1] === "none" ? 0 : Number(found[2]);
};

test("a call a pacing wait left short stands down naming the wait, the calls and the retries it spent the clock on", async () => {
  let asks = 0;
  const reset = Math.ceil(Date.now() / 1000) + 1;
  const { value } = await isolated((url, init) => {
    asks += 1;
    return asks === 1 ? Promise.resolve(answer(200, spentBudget(reset))) : stalled(init);
  }, async () => {
    boundedBy((() => {
      const until = performance.now() + 3_000;
      return () => until - performance.now();
    })(), CLOCK);
    await read();
    return stderrOf(read);
  });
  assert.match(value.refused, /ran out after \d+(\.\d+)?s \(a case's clock\)/u, value.refused);
  assert.match(value.refused, /so it was not sent again\. Of a case's clock, /u, value.refused);
  const pacing = heldBy(value.refused, "pacing for the reset the tracker named");
  assert.ok(pacing >= 0.9, `the wait for the reset is what held most of the clock: ${pacing}s\n${value.refused}`);
  assert.equal(heldBy(value.refused, "waits between attempts"), 0, "no wait between attempts was slept");
  const calls = heldBy(value.refused, "calls in flight");
  assert.ok(calls > 0 && calls < 3, `and the stalled call held the rest: ${calls}s\n${value.refused}`);
});

test("waits between attempts are named for the clock they held", async () => {
  const { value } = await isolated(async () => answer(503), async () => {
    boundedBy((() => {
      const until = performance.now() + 700;
      return () => until - performance.now();
    })(), CLOCK);
    return stderrOf(read);
  });
  assert.match(value.refused, /answered 503, and waiting 0\.8s to send it again would outlast the/u, value.refused);
  const retries = heldBy(value.refused, "waits between attempts");
  assert.ok(retries >= 0.55, `the 0.2s and 0.4s the ladder slept are what held the clock: ${retries}s\n${value.refused}`);
  assert.equal(heldBy(value.refused, "pacing for the reset the tracker named"), 0);
});

test("an attempt that ran out on a single try carries the account after its own words", async () => {
  const value = await isolated((url, init) => stalled(init), async () => {
    boundedBy(() => 50, CLOCK);
    return read({ once: true });
  });
  assert.match(value.refused,
    /^Forge did not answer GET \S+: ran out after 0\.05s \(a case's clock\)\. Of a case's clock, pacing for the reset the tracker named held none, waits between attempts held none and calls in flight held \d\.\d\ds\.$/u,
    value.refused);
});

test("a transport error under the process's clock reads as its own words, with no account after them", async () => {
  const value = await isolated(async () => {
    throw new Error("ECONNRESET");
  }, async () => {
    boundedBy(() => 5_000, CLOCK);
    return read({ once: true });
  });
  assert.match(value.refused, /^Forge did not answer GET \S+: ECONNRESET$/u, value.refused);
  assert.doesNotMatch(value.refused, / held /u, value.refused);
});

test("a process that names no clock writes its refusals without the account", async () => {
  const value = await isolated((url, init) => stalled(init), async () => read({ once: true, waits: 0.05 }));
  assert.match(value.refused, /ran out after 0\.05s \(the caller's own deadline\)$/u, value.refused);
  assert.doesNotMatch(value.refused, / held /u);
});

test("an attempt that ran out on its caller's own deadline under a clock with room left carries no account", async () => {
  const value = await isolated((url, init) => stalled(init), async () => {
    boundedBy(() => 5_000, CLOCK);
    return read({ once: true, waits: 0.05 });
  });
  assert.match(value.refused, /ran out after 0\.05s \(the caller's own deadline\)$/u, value.refused);
  assert.doesNotMatch(value.refused, / held /u, value.refused);
});

test("time spent by overlapping spans of one kind is counted once", async () => {
  const { clockSpentSaid, spending } = await import("../../../src/wire/request.mjs");
  const live = performance.now;
  let at = 0;
  performance.now = () => at;
  try {
    boundedBy(() => 1_000, CLOCK);
    const first = spending("call");
    at = 50;
    const second = spending("call");
    at = 100;
    first();
    first();
    at = 150;
    second();
    assert.equal(clockSpentSaid(),
      "Of a case's clock, pacing for the reset the tracker named held none, waits between attempts held none and calls in flight held 0.15s.");
  } finally {
    performance.now = live;
    boundedBy(null);
  }
});

/* The reset is a whole second in the tracker's frame, so the wait at the second call is between one
   and two seconds past the margin; the caller's two seconds hold that wait only where the call after
   it has been answered faster than every call before it. */
const pacedUnder = (firstTakes, waits) => {
  let asks = 0;
  return isolated(async () => {
    asks += 1;
    if (asks === 1) {
      await new Promise((done) => setTimeout(done, firstTakes));
      return answer(200, spentBudget(Math.ceil(Date.now() / 1000) + 1));
    }
    return answer(asks === 2 ? 429 : 200, new Map([["retry-after", "0.01"]]));
  }, async () => {
    await read({ waits });
    const began = Date.now();
    const { said } = await stderrOf(() => read({ waits }));
    return { spent: Date.now() - began, said };
  });
};

test("a pacing wait that would leave the call less room than its slowest answer is declined, and the refusal says why", async () => {
  const { spent, said } = await pacedUnder(1_200, 2);
  assert.ok(spent < patience(900), `the call went at once rather than waiting for the reset: ${spent}ms\n${said}`);
  assert.doesNotMatch(said, /Forge paced itself/u, said);
  assert.match(said,
    /rate-limited this call on the read budget, whose reset the tracker named \ds off, further than this call's clock could wait/u,
    said);
});

test("a pacing wait that leaves the call room for its slowest answer is still taken", async () => {
  const { spent, said } = await pacedUnder(0, 3.5);
  assert.ok(spent >= 900, `the wait for the reset was taken: ${spent}ms\n${said}`);
  assert.match(said, /Forge paced itself/u, said);
});
