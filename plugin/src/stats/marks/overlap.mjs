/* How much of the recent window a stored reading already holds, how far the corpus or the log has to
   move before a comparison against it can be read, and which reading a bare anchor flag takes —
   docs/cli/stats-the-mark.md. What counts as a shared row is each harness's own and is handed in. */
import { fail } from "../../resolve/settings.mjs";

/* More than half shared is most of both sides being the same rows, which no figure can read past. */
const readable = (shared, recent) => shared * 2 <= recent;

/* Rows arrive one at a time: a window short of its size grows and keeps every row it shares, and a
   full one drops its oldest, which is a shared row while any is left. */
const arrivalsUntil = (shared, recent, size, done) => {
  let [left, count, many] = [shared, recent, 0];
  while (!done(left, count)) {
    many += 1;
    if (count < size) count += 1;
    else left -= 1;
  }
  return many;
};

/** The overlap `--json` carries: the rows shared, the recent window's size, and the arrivals still
 *  owed before the reading can be read and before it shares none. */
export const overlapOf = (shared, recent, size) => ({
  shared,
  recent,
  untilReadable: arrivalsUntil(shared, recent, size, readable),
  untilDisjoint: arrivalsUntil(shared, recent, size, (left) => left === 0),
});

/** The clause every anchored before line ends on. `terms` is the harness's unit, as `{ unit, arrived }`. */
export const overlapSaid = (overlap, { unit, arrived }) => (overlap.shared
  ? `  — shares ${overlap.shared} of the recent ${overlap.recent} ${unit}, and none once ${overlap.untilDisjoint} more have ${arrived}`
  : "  — shares none of the recent window");

/** What a line inviting a comparison says at the moment the reading is written, when its window is the
 *  recent one: `count` rows of a window of `size`, every one of them shared. */
export const aheadSaid = (command, count, size, { noun, arrived }) => {
  const ahead = overlapOf(count, count, size);
  return `no ${noun} has ${arrived} after it yet: \`${command}\` can be read once ${ahead.untilReadable} more have `
    + `${arrived}, and shares none of the recent window once ${ahead.untilDisjoint} have`;
};

/* `recent` is what the caller knows of its recent window: `sharedWith(reading)`, the window's `rows`
   and `size`, its `terms`, and how a reading is named (`nameOf`), asked for (`askOf`) and passed over
   (`slide`, the sliding comparison, which shares nothing by construction). */
const measured = (recent, reading) => overlapOf(recent.sharedWith(reading), recent.rows, recent.size);

const sharedSaid = (recent, named, overlap) => {
  const { unit, arrived } = recent.terms;
  const head = `${named} shares ${overlap.shared} of the recent ${overlap.recent} ${unit}`;
  if (readable(overlap.shared, overlap.recent)) return `${head}, and none once ${overlap.untilDisjoint} more have ${arrived}`;
  return `${head}, so most of both sides would be the same ${unit}; it can be read once ${overlap.untilReadable} more `
    + `have ${arrived}, and shares none once ${overlap.untilDisjoint} have`;
};

const newestApart = (held, recent) => held.findLast((one) => measured(recent, one).shared === 0) ?? null;

const slideSaid = (recent) => `\`${recent.slide}\` compares the recent window with the one before it, which share nothing.`;

/** The reading an anchor flag resolves to: the one asked for where it can be read, or the newest held
 *  sharing none of the recent window where none was named; every other case is refused, with the one
 *  command that answers instead. `held` is oldest first and not empty. */
export const anchoredAt = (held, asked, recent, verb) => {
  if (asked) {
    const overlap = measured(recent, asked);
    if (readable(overlap.shared, overlap.recent)) return asked;
    const apart = newestApart(held, recent);
    return fail(`${verb}: ${sharedSaid(recent, recent.nameOf(asked), overlap)}. `
      + (apart ? `The newest reading sharing none is ${recent.nameOf(apart)}: \`${recent.askOf(apart)}\`.` : slideSaid(recent)));
  }
  const apart = newestApart(held, recent);
  if (apart) return apart;
  const newest = held.at(-1);
  const overlap = measured(recent, newest);
  return fail(`${verb}: ${recent.flag} alone takes the newest reading sharing none of the recent window, and no reading `
    + `held shares none yet: ${sharedSaid(recent, `${recent.nameOf(newest)}, the newest,`, overlap)}. `
    + (readable(overlap.shared, overlap.recent)
      ? `\`${recent.askOf(newest)}\` reads it with that overlap stated.`
      : slideSaid(recent)));
};
