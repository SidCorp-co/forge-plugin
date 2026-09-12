/* The one clock two devices share, off the `date` header of the tracker's answers and nothing
   else's: a lease compares a stamp one machine wrote against another's `Date.now()` (ISS-1212), and
   correcting the reader alone leaves the stamp in the writer's frame, so it is stamped here too. */

/* HTTP dates are truncated to the second, so the instant one names lies in [date, date + 1s), and the estimate takes its middle; `stampOf` cuts to the minute below, which is the width `lease.mjs` prints an expiry at and takes from here so one refusal naming both prints them alike. */
const HEADER_GRAIN = 1000;
const MINUTE = 60_000;

let best = null;
let answers = 0;

/* Anchored to the monotonic clock, `sentAt` and `gotAt` being `performance.now()`: an offset held against a wall clock is applied twice the moment that clock steps, which is what a machine an hour out does when somebody fixes it. */
export const sawAnswer = (headers, sentAt, gotAt) => {
  answers += 1;
  const named = Date.parse(headers?.get?.("date") ?? "");
  if (!Number.isFinite(named) || !(gotAt >= sentAt)) return;
  const slack = Math.ceil((gotAt - sentAt) / 2) + HEADER_GRAIN / 2;
  if (best && best.slack <= slack) return;
  best = { epoch: named + HEADER_GRAIN / 2, mono: (sentAt + gotAt) / 2, slack };
};

export const answered = () => answers > 0;

export const measured = () => best !== null;

export const slackNow = () => best?.slack ?? null;

export const sharedNow = () => (best ? best.epoch + (performance.now() - best.mono) : Date.now());

export const sharedStamp = () => new Date(sharedNow()).toISOString();

const seconds = (millis) => `${(Math.abs(millis) / 1000).toFixed(2)}s`;

export const offsetSaid = () => {
  if (best) {
    const offset = sharedNow() - Date.now();
    return `this device is ${seconds(offset)} ${offset < 0 ? "ahead of" : "behind"} `
      + `the tracker, known to ±${seconds(best.slack)}`
      + "  ← the `date` header on the tracker's own answers";
  }
  return answers
    ? "unmeasured — the tracker's answers carry no readable time, so a lease's expiry is decided "
      + "by this device's clock alone"
    : "unmeasured — nothing has been asked of the tracker yet";
};

/* Both errors: the reader's view is off by its own slack and the stamp it reads by the writer's.
   A lease carrying none was stamped by a device that measured none, and null is not a wide band. */
export const bandWith = (theirs) => (
  best === null || !Number.isFinite(theirs) || theirs < 0 ? null : best.slack + theirs);

export const straddles = (instant, band, now = sharedNow()) =>
  band !== null && Math.abs(instant - now) <= band;

export const orderableFrom = (instant, band) =>
  (band === null ? 0 : Math.ceil((instant + band) / MINUTE) * MINUTE);

/* Handed back, not failed: what a claim does about a frame that settled nothing is `claim.mjs`'s. */
export const unplaceable = (theirs) => {
  if (!answered()) return null;
  if (!measured()) {
    return "No answer from the tracker carried a readable time, so this lease's renew time was "
      + "compared against this device's own clock and against no clock its writer shares.";
  }
  if (Number.isFinite(theirs) && theirs >= 0) return null;
  return "That renew time was stamped by a device that had not read the tracker's clock, so it "
    + "carries that machine's time and this CLI cannot place it against the tracker's.";
};

export const stampOf = (ms) => new Date(ms).toISOString().slice(0, 16);

export const straddleSaid = (what, instant, band) =>
  `The two clocks cannot order ${what} against now: it is ${stampOf(instant)} in the tracker's `
  + `frame and the two measurements this rests on are worth ±${seconds(band)} between them. `
  + `Past ${stampOf(orderableFrom(instant, band))} they can.`;

export const forgetClock = () => {
  best = null;
  answers = 0;
};
