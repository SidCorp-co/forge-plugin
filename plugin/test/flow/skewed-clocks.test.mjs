/* The case this fix exists for: one lease, two devices, read at the same instant under wall clocks an
   hour apart. The tracker answers from a clock an hour behind this machine's, which is what a machine
   an hour fast meets, and every reading is taken with no `now` passed, so a default put back on this
   device's own clock goes red here; the raw clocks are asserted beside each reading (ISS-1212). */
import assert from "node:assert/strict";
import test from "node:test";

import { forgetClock, sawAnswer, sharedNow } from "../../src/wire/shared-clock.mjs";
import { claimed, freshLapse, leaseOf, stateOf } from "../../src/flow/lease.mjs";

const HOUR = 60 * 60_000;
const HELD = "the-run-that-holds-it";
const READER = "another-run";

const headers = (at) => ({ get: () => new Date(at).toUTCString() });

const anHourFast = () => {
  forgetClock();
  const sentAt = Math.floor(performance.now());
  sawAnswer(headers(Date.now() - HOUR), sentAt, sentAt + 200);
};

/* Written through `claimed`, so the stamp and its error are what the CLI would have put on the field, and one exchange stands before it: after that nothing here reads a wall clock. */
const writtenNow = (minutes) => leaseOf(claimed(null, { holder: HELD, minutes }));

const shifted = (lease, millis) =>
  ({ ...lease, renewedAt: new Date(Date.parse(lease.renewedAt) - millis).toISOString() });

test("a device an hour fast reads a live lease as live, where its own clock would have read it expired", () => {
  anHourFast();
  const held = shifted(writtenNow(60), 30 * 60_000);
  assert.equal(stateOf(held, READER), "live", "thirty minutes into sixty, on the clock both ends share");
  assert.equal(stateOf(held, READER, sharedNow()), stateOf(held, READER, Date.now() - HOUR),
    "and the device whose clock agrees with the tracker reads exactly the same");
  assert.notEqual(stateOf(held, READER, Date.now()), stateOf(held, READER, Date.now() - HOUR),
    "the raw clocks are what disagreed: the fast one read a live lease as expired");
});

test("a device an hour fast reads a fresh lapse as fresh, where its own clock would have reclaimed with no flag", () => {
  anHourFast();
  const held = shifted(writtenNow(60), 90 * 60_000);
  assert.equal(stateOf(held, READER), "expired");
  assert.equal(freshLapse(held), true, "thirty minutes into a lapse the holder's own duration covers");
  assert.equal(freshLapse(held, sharedNow()), freshLapse(held, Date.now() - HOUR),
    "and the device whose clock agrees with the tracker reads the same");
  assert.notEqual(freshLapse(held, Date.now()), freshLapse(held, Date.now() - HOUR),
    "the fast clock read a fresh lapse as stale, and a reclaim there needs no flag");
});

/* The residual, asserted rather than assumed: agreement is owed outside the sum of the two measurements and named inside it. */
test("what the correction does not buy is agreement inside the two measurements' own error", () => {
  anHourFast();
  const held = writtenNow(60);
  assert.equal(held.slack, 600, "a 200ms round trip and the second the header is truncated to");
  const expiry = Date.parse(held.renewedAt) + HOUR;
  assert.equal(stateOf(held, READER, expiry - 100), "live");
  assert.equal(stateOf(held, READER, expiry + 100), "expired",
    "200ms apart and inside a band of 1200, so which side of expiry an instant falls is not a thing either clock settles");
});
