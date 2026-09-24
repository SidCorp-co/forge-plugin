/* A calendar day in this device's own zone, which is the unit `forge stats daily` reports on: a
   window relative to now names a different span each time it is asked, and a day does not —
   docs/cli/stats.md. */
const SHAPE = /^\d{4}-\d{2}-\d{2}$/u;

const DAY_FORM = "YYYY-MM-DD";

const pad = (number) => String(number).padStart(2, "0");

const partsOf = (day) => day.split("-").map(Number);

/** The day a moment falls on, in the zone this process runs under. */
export const dayOf = (at) => {
  const held = new Date(at);
  return `${held.getFullYear()}-${pad(held.getMonth() + 1)}-${pad(held.getDate())}`;
};

/** The day `by` days from this one, counted on the calendar rather than in hours, so a day a clock
 *  change shortens is still one day. */
export const shifted = (day, by) => {
  const [year, month, date] = partsOf(day);
  return dayOf(new Date(year, month - 1, date + by));
};

/** Where the day begins and where the next one does, both local midnights. */
export const boundsOf = (day) => {
  const [year, month, date] = partsOf(day);
  return { from: new Date(year, month - 1, date).getTime(), to: new Date(year, month - 1, date + 1).getTime() };
};

/** The day as typed, or null where it is not one: `2026-02-30` has the shape and names no day,
 *  which a round trip through the calendar is what tells apart. */
export const dayIn = (given) => (typeof given === "string" && SHAPE.test(given)
  && shifted(given, 0) === given ? given : null);

export const yesterday = (now = Date.now()) => shifted(dayOf(now), -1);

/** The seven days before a day, oldest first: what its figures are set beside. */
export const weekBefore = (day) => [7, 6, 5, 4, 3, 2, 1].map((back) => shifted(day, -back));

/** The seven days ending at a day, oldest first: what its trend is drawn over. */
export const trendDays = (day) => [6, 5, 4, 3, 2, 1, 0].map((back) => shifted(day, -back));

/** The days a report can be written for: from the first day anything was recorded to the last one
 *  that has ended. `first` null is a corpus holding nothing yet. */
export const heldRange = (first, now = Date.now()) => ({ from: first === null ? null : dayOf(first), to: yesterday(now) });

const rangeSaid = (range) => (range.from === null || range.from > range.to
  ? "No day is held yet: neither a transcript nor a consult has been recorded on this device."
  : `The days held run from ${range.from} to ${range.to}.`);

/** Why a day cannot be reported on, with the range that can, or null where it can. Unparsed first,
 *  then unended, then older than anything held: each is its own sentence, because the way out of
 *  each is a different day to type. */
export const dayRefusal = (given, range) => {
  const day = dayIn(given);
  if (day === null) return `stats daily: --day takes a calendar day as ${DAY_FORM}, not \`${given}\`. ${rangeSaid(range)}`;
  if (day > range.to) return `stats daily: ${day} has not ended in this device's zone, so there is no whole day to report. ${rangeSaid(range)}`;
  if (range.from === null || day < range.from) return `stats daily: ${day} is earlier than anything this device still holds. ${rangeSaid(range)}`;
  return null;
};
