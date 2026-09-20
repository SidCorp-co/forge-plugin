/* A sweep of this backlog took 120 refusals inside nine minutes, 108 of them announcing the same
   per-minute window: one budget, discovered once per refusal (ISS-1849). What is asserted here is
   the reading that replaces those discoveries and the arithmetic under it — which answers may lower
   what is left and which may not, what happens at a reset nobody has read past, and why a window
   this process spent by itself never accuses a sibling. Nothing here reaches a tracker: a reading is
   four headers and an instant this case names. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  forgetBudget, pacedBy, reserveIn, sawBudget, settled, unpredictedIn,
} from "../../src/wire/budget.mjs";

const KEY = "forge_memory.search";

const headers = (held) => new globalThis.Headers(Object.fromEntries(
  Object.entries(held).map(([name, value]) => [name, String(value)])));

/* The order every real call takes: the reservation, the send, then the answer's own reading. A case
   that answers without reserving is one whose call this process never made. The attempt each of the
   three is given is what the transport gives them, and it is what says which of a route's calls the
   answer belongs to. */
const call = (at, reading) => {
  const taken = {};
  const held = reserveIn(KEY, at, Infinity, taken);
  if (held) return held;
  sawBudget(KEY, stated(reading), taken);
  settled(KEY, taken);
  return null;
};

const attempts = (many) => Array.from({ length: many }, () => ({}));

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
  const taken = attempts(12);
  for (let one = 0; one < 12; one += 1) {
    assert.equal(reserveIn(KEY, 100_000, Infinity, taken[one]), null, "nothing stated, nothing paced");
  }
  for (let one = 0; one < 12; one += 1) {
    sawBudget(KEY, stated({ limit: 60, remaining: 59 - one, resetAt: 200_000 }), taken[one]);
    settled(KEY, taken[one]);
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
    const held = new globalThis.Headers({
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

/* The same bucket again, and the second route's answer has not come back yet: its calls are charged
   to the window somewhere and nothing has said which, so the window standing is charged with them. */
test("a route whose bucket nothing has named yet is charged to the window that announces", () => {
  const OTHER = "forge_comments.create";
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  for (let one = 0; one < 5; one += 1) assert.equal(reserveIn(OTHER, 100_000), null);
  for (let one = 0; one < 54; one += 1) reserveIn(KEY, 100_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 200_000 }));
  assert.equal(reserveIn(KEY, 100_000).said.includes("by something else"), false,
    "the five the other route sent are unanswered, not somebody else's");
});

test("a route whose first answer is from a window already past still brings its calls with it", () => {
  const OTHER = "forge_comments.create";
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  for (let one = 0; one < 5; one += 1) {
    assert.equal(reserveIn(OTHER, 100_000), null);
    settled(OTHER);
  }
  sawBudget(OTHER, stated({ limit: 60, remaining: 40, resetAt: 140_000 }));
  for (let one = 0; one < 54; one += 1) reserveIn(KEY, 100_000);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 200_000 }));
  assert.equal(reserveIn(KEY, 100_000).said.includes("by something else"), false,
    "the reading was dropped and the five calls under it were not");
});

/* The reading is written before the answers of calls still out are counted, so a window opened while
   eleven are in flight would otherwise lend all sixty and this process would send seventy-one. */
test("a window opened while calls are still out lends only what is left once they are off it", () => {
  forgetBudget();
  for (let one = 0; one < 12; one += 1) assert.equal(reserveIn(KEY, 100_000), null);
  sawBudget(KEY, stated({ limit: 60, remaining: 59, resetAt: 200_000 }));
  for (let one = 0; one < 48; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 48 the window has room for`);
  }
  assert.ok(reserveIn(KEY, 100_000), "the eleven still out are charged to this window too, so the next one waits");
});

/* The count that bounds admission is retired on every attempt however it ended. Held against what
   was sent instead, sixty calls that died before a header would leave the next window owing sixty. */
test("a call that never answered is not a debt the windows after it keep paying", () => {
  forgetBudget();
  for (let one = 0; one < 60; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null);
    settled(KEY);
  }
  sawBudget(KEY, stated({ limit: 60, remaining: 59, resetAt: 200_000 }));
  for (let one = 0; one < 59; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 59 the window states`);
  }
  assert.ok(reserveIn(KEY, 100_000), "and the sixtieth waits, the window being spent rather than owed");
});

/* The same bucket, a second route: its calls before anything named its scope are as much this
   process's as the first route's were, and the window they landed in is the one already open. */
test("a route joining a window already open takes its own calls off what that window has left", () => {
  const OTHER = "forge_comments.create";
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  const taken = attempts(5);
  for (let one = 0; one < 5; one += 1) {
    assert.equal(reserveIn(OTHER, 100_000, Infinity, taken[one]), null);
  }
  sawBudget(OTHER, stated({ limit: 60, remaining: 58, resetAt: 200_000 }), taken[0]);
  for (let one = 0; one < 54; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 54 this window has left`);
  }
  const waiting = reserveIn(KEY, 100_000);
  assert.ok(waiting, "the four of the other route the header had not counted are off this window too");
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 200_000 }));
  assert.equal(reserveIn(KEY, 100_000).said, null, "one window is announced once");
  assert.equal(waiting.said.includes("by something else"), false,
    "one, then five, then fifty-four: the window is spent and every call in it was this process's");
});

/* Forty-two of the sixty are gone and this process has sent thirteen, so something else is on the
   credential — and which of this process's own twelve the server has reached is then nothing here
   can say. The reading falls back to the bound that assumes it has reached none of them, which is
   the only one that holds when the figure is not this process's own arithmetic. */
test("a reading that lowers what a window has left is lowered again by the calls still out", () => {
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  for (let one = 0; one < 12; one += 1) assert.equal(reserveIn(KEY, 100_000), null);
  sawBudget(KEY, stated({ limit: 60, remaining: 18, resetAt: 200_000 }));
  settled(KEY);
  for (let one = 0; one < 7; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 7 this window has left`);
  }
  assert.ok(reserveIn(KEY, 100_000), "the eleven the answer had not counted are off it too");
});

/* The reading above with the one difference that decides it: here what the server says is gone is
   what this process sent, so nothing else is on the credential. Twelve workers each hold a call this
   window charged itself for when it admitted them, and the tracker counts a call when it handles it,
   so the figure an answer carries has already counted every call handled before its own. Subtracting
   all twelve from that figure charges eleven of them twice, and the downward-only minimum keeps the
   doubled figure, so a window of sixty is driven to zero at forty-nine — 11 of 60, which is the 17%
   a paced sweep cost over an unpaced one (ISS-1947). */
test("a window's own reservations are not taken off it again by an answer that finds them in flight", () => {
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  for (let one = 0; one < 12; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `worker ${one + 1} of the twelve fanning out`);
  }
  sawBudget(KEY, stated({ limit: 60, remaining: 47, resetAt: 200_000 }));
  settled(KEY);
  for (let one = 0; one < 47; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 47 left of the sixty`);
  }
  assert.ok(reserveIn(KEY, 100_000), "and the sixty-first waits: the window is spent, not spent eleven early");
});

/* Twelve workers whose calls opened the window keep working in it: each answer settles and the
   worker sends again, so nothing outstanding is a pass-through once the twelfth has come home while
   the count of what is out never falls. A count retired by what is still out rather than by which
   call came back would hold those twelve for as long as the load lasts, and take them off every
   reading of the window — which is the defect wearing a slower disguise. */
test("the pass-through debt of a window's opening calls is retired as they come home, not held behind the load", () => {
  forgetBudget();
  const opening = attempts(12);
  const after = attempts(12);
  for (let one = 0; one < 12; one += 1) {
    assert.equal(reserveIn(KEY, 100_000, Infinity, opening[one]), null, "nothing stated, nothing paced");
  }
  for (let one = 0; one < 12; one += 1) {
    sawBudget(KEY, stated({ limit: 60, remaining: 59 - one, resetAt: 200_000 }), opening[one]);
    settled(KEY, opening[one]);
    assert.equal(reserveIn(KEY, 100_000, Infinity, after[one]), null, `worker ${one + 1} sends again`);
  }
  sawBudget(KEY, stated({ limit: 60, remaining: 36, resetAt: 200_000 }), after[0]);
  for (let one = 0; one < 36; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 36 left of the sixty`);
  }
  assert.ok(reserveIn(KEY, 100_000), "twenty-four went and thirty-six followed: the window is spent, not spent early");
});

/* The answer's own call is discounted from what is subtracted only where it is one of them. This one
   is a reservation this window already charged itself for, so all five the other route has out are
   still to come off the figure it carries, and discounting one of them would admit a sixty-first
   call against a budget of sixty. */
test("an answer this window charged itself for discounts none of the pass-throughs outstanding beside it", () => {
  const OTHER = "forge_comments.create";
  forgetBudget();
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  const beside = attempts(5);
  for (let one = 0; one < 5; one += 1) {
    assert.equal(reserveIn(OTHER, 100_000, Infinity, beside[one]), null);
  }
  const mine = {};
  assert.equal(reserveIn(KEY, 100_000, Infinity, mine), null, "a reservation of this window's own");
  sawBudget(KEY, stated({ limit: 60, remaining: 58, resetAt: 200_000 }), mine);
  for (let one = 0; one < 53; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 53 this window has left`);
  }
  assert.ok(reserveIn(KEY, 100_000), "one, five and fifty-four: the sixty-first waits");
});

/* A route that failed sixty times before anything named its bucket still made sixty calls, and they
   are sixty this process has to answer for — but not sixty a window that has just opened may charge. */
test("calls that failed before a route's bucket was named are no debt against a window since opened", () => {
  const OTHER = "forge_comments.create";
  forgetBudget();
  for (let one = 0; one < 60; one += 1) {
    assert.equal(reserveIn(OTHER, 100_000), null);
    settled(OTHER);
  }
  call(100_000, { limit: 60, remaining: 59, resetAt: 200_000 });
  const taken = {};
  assert.equal(reserveIn(OTHER, 100_000, Infinity, taken), null);
  sawBudget(OTHER, stated({ limit: 60, remaining: 58, resetAt: 200_000 }), taken);
  settled(OTHER, taken);
  for (let one = 0; one < 58; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null, `reservation ${one + 1} of the 58 the window states`);
  }
  assert.ok(reserveIn(KEY, 100_000), "and the next waits, on the figure the tracker gave rather than on a history");
});

/* The window a route's first answer opens was spent by that route, and its calls that have already
   come back are in no live count: dropped with the reading, they read as a sibling's fifty-nine. */
test("the calls a route made and got back are in the window its first answer opens", () => {
  forgetBudget();
  for (let one = 0; one < 59; one += 1) {
    assert.equal(reserveIn(KEY, 100_000), null);
    settled(KEY);
  }
  assert.equal(reserveIn(KEY, 100_000), null);
  sawBudget(KEY, stated({ limit: 60, remaining: 0, resetAt: 200_000 }));
  settled(KEY);
  const waiting = reserveIn(KEY, 100_000);
  assert.ok(waiting, "the window is spent");
  assert.equal(waiting.said.includes("by something else"), false,
    "and this process spent all sixty of it");
});
