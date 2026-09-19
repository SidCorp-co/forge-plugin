/* A sweep of this backlog took 120 refusals inside nine minutes, 108 of them announcing the same
   per-minute window: one budget, discovered once per refusal (ISS-1849). What is asserted here is
   the reading that replaces those discoveries and the arithmetic under it — which answers may lower
   what is left and which may not, what happens at a reset nobody has read past, and why a window
   this process spent by itself never accuses a sibling. Nothing here reaches a tracker: a reading is
   four headers and an instant this case names. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  forgetBudget, pacedBy, reserveIn, sawBudget, unpredictedIn,
} from "../../src/wire/budget.mjs";

const KEY = "forge_memory.search";

const headers = (held) => new Headers(Object.fromEntries(
  Object.entries(held).map(([name, value]) => [name, String(value)])));

/* The order every real call takes: the reservation, the send, then the answer's own reading. A case
   that answers without reserving is one whose call this process never made. */
const call = (at, reading) => {
  const held = reserveIn(KEY, at);
  if (!held) sawBudget(KEY, stated(reading));
  return held;
};

const stated = ({ scope = "write", limit = 60, remaining = 59, resetAt }) => headers({
  "x-ratelimit-scope": scope,
  "x-ratelimit-limit": limit,
  "x-ratelimit-remaining": remaining,
  "x-ratelimit-reset": resetAt / 1000,
});

test("a call goes until the tracker has stated a budget, and then waits for the reset that budget names", () => {
  forgetBudget();
  assert.equal(pacedBy(KEY), null);
  assert.equal(reserveIn(KEY, 0), null, "a tracker that states no budget is one nothing can pace against");
  sawBudget(KEY, stated({ limit: 3, remaining: 2, resetAt: 130_000 }));
  assert.equal(pacedBy(KEY), "the write budget of 3 a window");
  assert.equal(reserveIn(KEY, 100_000), null, "two were left");
  assert.equal(reserveIn(KEY, 100_000), null, "and then one");
  const held = reserveIn(KEY, 100_000);
  assert.equal(held.seconds, 31, "to the reset the server named, a second past it so the wake is outside the window closing");
  assert.match(held.said, /the write budget of 3 is spent for this window; waiting 31s for the reset the tracker named/u);
  assert.equal(reserveIn(KEY, 100_000).said, null, "and one window is announced once, not once per call waiting on it");
});

/* The header is written before the answers of calls still out are counted, so the lagging one says
   more is left than is: taking it would admit a call a reservation has already spent. */
test("an answer saying more is left than this process has spent hands no token back", () => {
  forgetBudget();
  sawBudget(KEY, stated({ remaining: 2, resetAt: 200_000 }));
  assert.equal(reserveIn(KEY, 100_000), null);
  assert.equal(reserveIn(KEY, 100_000), null);
  sawBudget(KEY, stated({ remaining: 2, resetAt: 200_000 }));
  assert.ok(reserveIn(KEY, 100_000), "the window is still spent, and the stale reading did not unspend it");
});

test("an answer from a window already past may not unspend the window standing, and a later one opens the next", () => {
  forgetBudget();
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 300_000 }));
  sawBudget(KEY, stated({ limit: 10, remaining: 9, resetAt: 240_000 }));
  assert.ok(reserveIn(KEY, 250_000), "an answer about a window that has ended says nothing about this one");
  assert.equal(pacedBy(KEY), "the write budget of 60 a window", "not even how large that window is");
  sawBudget(KEY, stated({ remaining: 59, resetAt: 360_000 }));
  assert.equal(reserveIn(KEY, 310_000), null, "and a reset later than the one held is a window taken whole");
});

/* No duration is derived anywhere: one answer gives the time left in its window and not the
   window's width, and two resets a process saw with a quiet stretch between them are no better. */
test("past the stated reset the call goes rather than a window being computed to roll into", () => {
  forgetBudget();
  sawBudget(KEY, stated({ remaining: 0, resetAt: 710_000 }));
  assert.ok(reserveIn(KEY, 700_000), "inside the window it waits");
  assert.doesNotMatch(pacedBy(KEY), /\d+\s*s\b/u, "and nothing says how wide the window is");
  assert.equal(reserveIn(KEY, 711_000), null, "past the reset nothing is known of the next window, so the call goes");
  assert.equal(reserveIn(KEY, 712_000), null, "and keeps going: no width was invented to roll one over with");
});

test("a window this process spent by itself accuses nobody, and one it did not says at least how much", () => {
  forgetBudget();
  call(460_000, { limit: 60, remaining: 59, resetAt: 500_000 });
  for (let one = 0; one < 59; one += 1) reserveIn(KEY, 460_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 500_000 }));
  assert.equal(reserveIn(KEY, 460_000).said.includes("by something else"), false,
    "60 spent against 59 reserved and the call that opened the window is the sixtieth");

  forgetBudget();
  call(460_000, { limit: 60, remaining: 59, resetAt: 500_000 });
  for (let one = 0; one < 30; one += 1) reserveIn(KEY, 460_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 500_000 }));
  assert.match(reserveIn(KEY, 460_000).said, /at least 29 of it by something else on this credential/u);
});

/* Every doubtful call is counted against this process rather than against a sibling, so a run alone
   on the credential is never told it has company. */
test("a call reserved before a reset and charged after it accuses nobody", () => {
  forgetBudget();
  call(590_000, { limit: 60, remaining: 59, resetAt: 600_000 });
  reserveIn(KEY, 590_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 59, resetAt: 660_000 }));
  for (let one = 0; one < 59; one += 1) reserveIn(KEY, 610_000);
  assert.equal(reserveIn(KEY, 610_000).said.includes("by something else"), false,
    "the call that spanned the reset is subtracted from the new window as well as from the old");
});

test("a refusal names the budget it was paced against, or says there was none to pace against", () => {
  forgetBudget();
  sawBudget(KEY, headers({ "x-ratelimit-limit": 60 }));
  assert.equal(pacedBy(KEY), null, "three of the four headers missing is no reading");
  assert.equal(reserveIn(KEY, 0), null);
  assert.equal(unpredictedIn(KEY), "having read no budget from this tracker to pace against");
  sawBudget(KEY, stated({ resetAt: 900_000 }));
  assert.equal(unpredictedIn(KEY),
    "on the write budget, which the reading it was paced against did not predict");
});

test("one route's budget is not another's, the scope being the server's own word for the bucket", () => {
  forgetBudget();
  sawBudget("forge_issues.get", stated({ scope: "read", limit: 3600, remaining: 3599, resetAt: 800_000 }));
  sawBudget(KEY, stated({ scope: "write", limit: 60, remaining: 0, resetAt: 800_000 }));
  assert.equal(pacedBy("forge_issues.get"), "the read budget of 3600 a window");
  assert.equal(reserveIn("forge_issues.get", 700_000), null, "the read bucket has room");
  assert.ok(reserveIn(KEY, 700_000), "and the write bucket, spent, does not lend it any");
});

/* Twelve workers send before any of them has been answered, so none of those sends was ever taken
   against a scope nothing had named yet: counted nowhere, they read afterwards as somebody else's. */
test("the calls a route made before its bucket was named are still counted as this process's", () => {
  forgetBudget();
  for (let one = 0; one < 12; one += 1) assert.equal(reserveIn(KEY, 100_000), null, "nothing stated, nothing paced");
  for (let one = 0; one < 12; one += 1) {
    sawBudget(KEY, stated({ limit: 60, remaining: 59 - one, resetAt: 200_000 }));
  }
  for (let one = 0; one < 48; one += 1) reserveIn(KEY, 100_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 200_000 }));
  assert.equal(reserveIn(KEY, 100_000).said.includes("by something else"), false,
    "the window is spent and every call in it was this process's own");
});

/* A caller inside somebody else's clock declared how long it may take, and a reset a minute out is
   longer than that: the call goes and meets whatever it would have met before any of this. */
test("a wait longer than the caller's own deadline is not taken on its behalf", () => {
  forgetBudget();
  call(100_000, { limit: 60, remaining: 0, resetAt: 160_000 });
  assert.ok(reserveIn(KEY, 100_000, 90_000), "inside its own clock it waits");
  assert.equal(reserveIn(KEY, 100_000, 5_000), null, "past it the call goes rather than the caller waiting");
});

test("an answer missing one of the four numbers states no budget, rather than a window already spent", () => {
  for (const missing of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
    forgetBudget();
    const held = new Headers({
      "x-ratelimit-scope": "write",
      "x-ratelimit-limit": "60",
      "x-ratelimit-remaining": "59",
      "x-ratelimit-reset": "200",
    });
    held.delete(missing);
    sawBudget(KEY, held);
    assert.equal(pacedBy(KEY), null, `${missing} absent is a reading short of one, not a zero`);
    assert.equal(reserveIn(KEY, 100_000), null, `and nothing is paced against it: ${missing}`);
  }
});

/* The same bucket, a second route: its calls before anything named its scope are as much this
   process's as the first route's were, and the window they landed in is the one already open. */
test("a second route joining a bucket already read brings the calls it made with it", () => {
  const OTHER = "forge_comments.create";
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  for (let one = 0; one < 5; one += 1) assert.equal(reserveIn(OTHER, 100_000), null);
  sawBudget(OTHER, stated({ limit: 60, remaining: 54, resetAt: 200_000 }));
  for (let one = 0; one < 54; one += 1) reserveIn(KEY, 100_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 200_000 }));
  assert.equal(reserveIn(KEY, 100_000).said.includes("by something else"), false,
    "one, then five, then fifty-four: the window is spent and every call in it was this process's");
});
