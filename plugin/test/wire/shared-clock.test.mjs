/* Two devices decided whether an issue was held by comparing a stamp one of them wrote against the
   other's own `Date.now()`, so a pair skewed past the margin disagreed about the same lease at the
   same instant (ISS-1212). What is asserted here is the frame both ends are moved into, and the
   band around a boundary that frame still cannot order — which is what the claim says rather than
   guesses. Nothing here reaches the tracker: an observation is a header and two local instants. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  answered, bandWith, forgetClock, measured, offsetSaid, orderableFrom, sawAnswer, sharedNow,
  sharedStamp, slackNow, straddleSaid, straddles, unplaceable,
} from "../../src/wire/shared-clock.mjs";

const headers = (date) => ({ get: (name) => (name === "date" && date !== null ? date : null) });

/* The two instants are `performance.now()`'s, as the transport's are: what the offset is held against
   is the monotonic clock, so a case naming a wall instant would be naming the wrong one. */
const seenAt = (serverIso, trip = 400) => {
  forgetClock();
  const sentAt = Math.floor(performance.now());
  sawAnswer(headers(new Date(Date.parse(serverIso)).toUTCString()), sentAt, sentAt + trip);
};

test("the shared clock is the instant the header named, run on from there by the monotonic clock and not by this device's", () => {
  forgetClock();
  assert.equal(measured(), false);
  assert.equal(answered(), false);
  assert.equal(slackNow(), null);
  seenAt("2026-09-12T01:00:00.000Z");
  assert.equal(measured(), true);
  assert.equal(slackNow(), 700, "200ms of one-way flight and 500ms for the header's grain");
  const off = sharedNow() - Date.parse("2026-09-12T01:00:00.500Z");
  assert.equal(Math.abs(off) < 1000, true,
    `the middle of the second the header truncated, give or take the trip and this case: ${off}ms`);
  const real = Date.now;
  const before = sharedNow();
  Date.now = () => real() + 60 * 60_000;
  try {
    const stepped = sharedNow() - before;
    assert.equal(stepped < 100, true,
      `an hour's step in the wall clock moves nothing, or the correction is applied twice: ${stepped}ms`);
  } finally {
    Date.now = real;
  }
});

test("an answer with no readable time measures nothing, and is not the same as no answer at all", () => {
  forgetClock();
  sawAnswer(headers(null), performance.now(), performance.now() + 10);
  assert.equal(answered(), true, "the tracker replied");
  assert.equal(measured(), false, "and its reply placed no clock");
  assert.equal(Math.abs(sharedNow() - Date.now()) <= 2, true, "so the frame falls back to this device's own");
  assert.match(offsetSaid(), /^unmeasured — the tracker's answers carry no readable time/u);
  forgetClock();
  assert.match(offsetSaid(), /^unmeasured — nothing has been asked of the tracker yet/u);
  sawAnswer(headers("not a date"), performance.now(), performance.now() + 10);
  assert.equal(measured(), false, "and a header nobody can parse is no reading");
});

test("the narrowest exchange wins, a later wider one leaving the frame where it was", () => {
  seenAt("2026-09-12T01:00:00.000Z", 2000);
  assert.equal(slackNow(), 1500);
  const sentAt = Math.floor(performance.now());
  sawAnswer(headers(new Date(Date.parse("2026-09-12T01:00:10.000Z")).toUTCString()), sentAt, sentAt + 100);
  assert.equal(slackNow(), 550, "the second exchange spent less time in flight, so it is the more accurate");
  sawAnswer(headers(new Date(Date.parse("2026-09-12T01:00:20.000Z")).toUTCString()), sentAt, sentAt + 5000);
  assert.equal(slackNow(), 550, "and the third is wider, so it is not taken");
});

test("a device an hour fast stamps in the tracker's clock, so the stamp is not its own", () => {
  /* An hour ahead: this machine's own clock reads an hour past what the tracker's answer says. */
  seenAt(new Date(Date.now() - 60 * 60_000).toISOString(), 200);
  const stamped = Date.parse(sharedStamp());
  assert.equal(Math.abs(stamped - (Date.now() - 60 * 60_000)) < 1500, true,
    "the stamp is the tracker's clock and not the hour-fast one this machine holds");
});

test("the band is both errors and a lease carrying none has no band at all", () => {
  seenAt("2026-09-12T01:00:00.000Z");
  assert.equal(bandWith(300), 1000, "this reader's 700 and the writer's 300");
  assert.equal(bandWith(null), null, "a stamp with no error recorded gives no sum");
  assert.equal(bandWith(-1), null);
  forgetClock();
  assert.equal(bandWith(300), null, "and a reader that measured nothing has none either");
});

test("an instant inside the band cannot be ordered against now, and one outside it can", () => {
  const now = Date.parse("2026-09-12T01:00:00.000Z");
  assert.equal(straddles(now + 900, 1000, now), true);
  assert.equal(straddles(now - 900, 1000, now), true, "either side of now, the band being symmetric");
  assert.equal(straddles(now + 1100, 1000, now), false);
  assert.equal(straddles(now + 900, null, now), false,
    "no band is not an infinite one: nothing is ordered by it and the caller is told which end went unmeasured");
});

test("the instant a straddled boundary comes out of the band is the boundary plus the band, rounded up to the printed minute", () => {
  const boundary = Date.parse("2026-09-12T01:00:30.000Z");
  assert.equal(orderableFrom(boundary, 1000), Date.parse("2026-09-12T01:01:00.000Z"));
  assert.equal(orderableFrom(Date.parse("2026-09-12T01:00:59.000Z"), 1000), Date.parse("2026-09-12T01:01:00.000Z"),
    "an instant already on the minute is left where it is");
  assert.equal(orderableFrom(Date.parse("2026-09-12T01:00:59.500Z"), 1000), Date.parse("2026-09-12T01:02:00.000Z"),
    "and half a second past it costs the whole minute, a truncated minute still being held");
  assert.equal(orderableFrom(boundary, null), 0);
  const said = straddleSaid("the expiry of the lease on ISS-4", boundary, 1000);
  assert.match(said, /cannot order the expiry of the lease on ISS-4 against now/u);
  assert.match(said, /±1\.00s/u, "the band, so a reader knows how wide the doubt is");
  assert.match(said, /Past 2026-09-12T01:01 they can/u, "and the instant past which it goes away");
});

test("what the frame could not settle is handed back as a sentence naming which end went unmeasured", () => {
  forgetClock();
  assert.equal(unplaceable(300), null, "before anything is asked of the tracker, nothing is claimed either way");
  sawAnswer(headers(null), performance.now(), performance.now() + 10);
  assert.match(unplaceable(300), /compared against this device's own clock/u,
    "this end read no clock, whatever the stamp carries");
  seenAt("2026-09-12T01:00:00.000Z", 200);
  assert.equal(unplaceable(300), null, "both ends placed, so there is nothing to say");
  assert.match(unplaceable(null), /stamped by a device that had not read the tracker's clock/u,
    "and a stamp with no error recorded is that machine's time, not this one's");
  assert.match(offsetSaid(), /known to ±0\.60s {2}← the `date` header on the tracker's own answers/u);
});
