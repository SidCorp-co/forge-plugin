/* The budget the tracker states on every answer, reaching the transport rather than the module that
   holds it: a sweep discovered one per-minute window 108 times because nothing here read it
   (ISS-1849). What is asserted here is the half `plugin/test/wire/budget.test.mjs` cannot — that the
   reservation is taken before the send, against the clock the same answers place, and inside the one
   allowance the caller declared for the attempt. */
import assert from "node:assert/strict";
import test from "node:test";

import { patience } from "../../patience.mjs";
import { callTool } from "../../../src/tracker/rest.mjs";

let asks = 0;

const budgeted = (held) => new Map(Object.entries({
  "x-ratelimit-scope": "write",
  "x-ratelimit-limit": "1",
  "x-ratelimit-remaining": "0",
  ...held,
}).map(([name, value]) => [name, String(value)]));

const stderrOf = async (call) => {
  const held = console.error;
  const lines = [];
  console.error = (...said) => lines.push(said.join(" "));
  try {
    await call();
  } finally {
    console.error = held;
  }
  return lines.join("\n");
};

/* The shared clock is a module's and outlives one case, so a case that moves it an hour puts every
   case after it an hour out: both readings are dropped either side of the call. */
const reading = async (headers, call) => {
  const { forgetBudget } = await import("../../../src/wire/budget.mjs");
  const { forgetClock } = await import("../../../src/wire/shared-clock.mjs");
  const live = globalThis.fetch;
  forgetBudget();
  forgetClock();
  asks = 0;
  globalThis.fetch = async () => {
    asks += 1;
    return { ok: true, status: 200, headers, text: async () => "{}" };
  };
  try {
    return await call();
  } finally {
    globalThis.fetch = live;
    forgetBudget();
    forgetClock();
  }
};

const oneRead = () => callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true);

test("a call the stated budget has no room for waits for the reset the tracker named before it is sent", async () => {
  const reset = Math.ceil(Date.now() / 1000) + 1;
  const headers = budgeted({ "x-ratelimit-reset": reset });
  const waited = await reading(headers, async () => {
    await oneRead();
    const began = Date.now();
    const said = await stderrOf(oneRead);
    return { spent: Date.now() - began, said };
  });
  assert.equal(asks, 2, "both calls reached the tracker, the second after the wait rather than instead of it");
  assert.ok(waited.spent >= 1_500, `the second call waited ${waited.spent}ms for the window the first one read`);
  assert.ok(waited.spent <= patience(6_000), `and no longer than the reset it was told: ${waited.spent}ms`);
  assert.match(waited.said, /Forge paced itself: the write budget of 1 is spent for this window/u, waited.said);
  assert.match(waited.said, /waiting \ds for the reset the tracker named, rather than sending calls it would refuse\./u,
    waited.said);
});

test("a tracker stating no budget is sent what it is sent today, and a refusal it did not predict says which", async () => {
  const bare = await reading(new Map(), async () => {
    const began = Date.now();
    await oneRead();
    await oneRead();
    return Date.now() - began;
  });
  assert.equal(asks, 2, "two calls, neither paced");
  assert.ok(bare <= patience(2_000), `and nothing waited on a budget nobody stated: ${bare}ms`);

  const { forgetBudget, sawBudget, unpredictedIn } = await import("../../../src/wire/budget.mjs");
  forgetBudget();
  assert.equal(unpredictedIn("forge_issues.get"), "having read no budget from this tracker to pace against");
  sawBudget("forge_issues.get", budgeted({ "x-ratelimit-reset": Math.ceil(Date.now() / 1000) + 3600 }));
  assert.equal(unpredictedIn("forge_issues.get"),
    "on the write budget, which the reading it was paced against did not predict");
  forgetBudget();
});

/* The reset is an instant in the tracker's frame, so a device an hour out of step with it would read
   every window as either long over or an hour away. The clock the answers already place is the one. */
test("the reset is read against the tracker's own clock rather than this device's", async () => {
  const ahead = 3_600_000;
  const headers = budgeted({
    date: new Date(Date.now() + ahead).toUTCString(),
    "x-ratelimit-reset": Math.ceil((Date.now() + ahead) / 1000) + 1,
  });
  const spent = await reading(headers, async () => {
    await oneRead();
    const began = Date.now();
    await stderrOf(oneRead);
    return Date.now() - began;
  });
  assert.equal(asks, 2, "both calls reached the tracker");
  assert.ok(spent >= 1_500, `the wait is the two seconds the tracker's own frame says, not none: ${spent}ms`);
  assert.ok(spent <= patience(8_000), `and not the hour this device's clock would make of it: ${spent}ms`);
});

test("a caller with a deadline of its own is not held past it by a window it never budgeted for", async () => {
  const headers = budgeted({ "x-ratelimit-reset": Math.ceil(Date.now() / 1000) + 30 });
  const spent = await reading(headers, async () => {
    await callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true, { waits: 2 });
    const began = Date.now();
    await callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true, { waits: 2 });
    return Date.now() - began;
  });
  assert.equal(asks, 2, "the second call went rather than waiting half a minute for a window");
  assert.ok(spent <= patience(1_500), `and it went at once: ${spent}ms`);
});

/* The allowance a caller declares is for the attempt, not for each half of it: a wait inside it that
   hands the send a fresh deadline doubles what the caller asked to be bounded by. */
test("a wait taken inside a caller's allowance does not hand the send a fresh one", async () => {
  const { forgetBudget } = await import("../../../src/wire/budget.mjs");
  const { forgetClock } = await import("../../../src/wire/shared-clock.mjs");
  const live = globalThis.fetch;
  const headers = budgeted({ "x-ratelimit-reset": Math.ceil(Date.now() / 1000) + 1 });
  forgetBudget();
  forgetClock();
  let stalled = 0;
  globalThis.fetch = (url, init) => {
    stalled += 1;
    return stalled === 1
      ? Promise.resolve({ ok: true, status: 200, headers, text: async () => "{}" })
      : new Promise((done, no) => {
        /* A timer this loop holds: `AbortSignal.timeout` does not keep one alive, so a stall with
           nothing else pending ends the case before the deadline it is about ever fires. */
        const never = setTimeout(done, 30_000);
        init.signal.addEventListener("abort", () => {
          clearTimeout(never);
          no(init.signal.reason);
        });
      });
  };
  try {
    await callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true, { waits: 3 });
    const began = Date.now();
    await stderrOf(() =>
      callTool("forge_issues", { action: "get", documentId: "u-1", fields: [] }, true, { waits: 3, once: true }));
    const spent = Date.now() - began;
    assert.ok(spent >= 1_800, `the wait for the window was taken: ${spent}ms`);
    assert.ok(spent < patience(4_200), `and the three seconds asked for bound the pace and the send together: ${spent}ms`);
  } finally {
    globalThis.fetch = live;
    forgetBudget();
    forgetClock();
  }
});
