/* How long a call of each class took in each of the two windows `forge stats eval` compares, so a
   movement in what the harness spends is told apart from a movement in what it waits on. What the
   population is, and why the bound is a constant — docs/cli/stats-the-latency.md. */
import { minutes } from "../figures.mjs";
import { capped, elided } from "../tables.mjs";

/** Fewer calls than this on both sides and a class's seconds a call is one call's accident, so the
 *  row is folded into a tail line rather than listed or named. */
export const CALLS = 20;

/** The relative move in seconds a call past which a class is named in the prose. A constant of this
 *  reader and never a floor measured off the corpus: an angle's floor is a pass of block profiles
 *  per named scalar figure, computed beside the reading so that a ship's mark writer never spends
 *  it, and the class set is whatever this corpus classed rather than a closed set — a floor here
 *  would be that pass per class, inside the one assembly both mark writers store. Half is where the
 *  median-wall floor's own p95 stands on this project's corpus, so a class moving less than that is
 *  not told apart from how far two adjacent windows of it differ anyway. */
export const MOVED = 0.5;

const NO_BEFORE = "there is no window before this one, so no class has a figure to compare with";
const NO_CLASSES = "the reading standing as the before window carries no class figures of its own";

const NONE = { calls: 0, wait: 0 };

/* A mean of zero reads as a class that answered instantly, which is the one thing a window holding
   no call of it did not observe; so the calls are nought and the mean is absent. */
const sideOf = (classes, lookups, label) => {
  const held = classes.get(label) ?? NONE;
  return {
    calls: held.calls,
    wait: held.wait,
    lookups: lookups.get(label) ?? 0,
    seconds: held.calls ? held.wait / held.calls : null,
  };
};

const rowOf = (label, before, now) => {
  const both = before.seconds !== null && now.seconds !== null && before.seconds > 0;
  const thin = before.calls < CALLS && now.calls < CALLS;
  const shift = both ? (now.seconds - before.seconds) / before.seconds : null;
  return {
    label,
    before,
    now,
    shift,
    /* A difference of two means times a call count, and what `unionSeconds` in runs.mjs states of
       the sums it is built from carries into the product: an attribution derived from them is no
       more subtractable from the clock than they are. So the figure is labelled where it prints
       rather than left to be added to a wall-time saving, which is the one thing it cannot be. */
    toolMinutes: both ? minutes((now.seconds - before.seconds) * now.calls) : null,
    thin,
    named: both && Math.abs(shift) > MOVED && !thin,
  };
};

const classesIn = (rows) => new Map(rows ?? []);
const lookupsIn = (rows) => new Map((rows ?? []).map(([label, one]) => [label, one.calls]));

/** The comparison, off the two profiles the reading already holds and nothing else: every class
 *  either window classed a call to, each side's seconds a call beside the calls it is a mean over,
 *  and the help lookups inside that denominator on each side — a lookup's own wait sits in the
 *  class's wait and cannot be taken back out of it, so the mixture is printed rather than removed. */
export const classesCompared = (now, before) => {
  if (!before) return { why: NO_BEFORE, rows: [], lookups: null };
  if (!Array.isArray(before.byClass)) return { why: NO_CLASSES, rows: [], lookups: null };
  const nowClasses = classesIn(now.byClass);
  const beforeClasses = classesIn(before.byClass);
  const nowLookups = lookupsIn(now.helpReads);
  const beforeLookups = lookupsIn(before.helpReads);
  const rows = [...new Set([...nowClasses.keys(), ...beforeClasses.keys()])]
    .map((label) => rowOf(label, sideOf(beforeClasses, beforeLookups, label),
      sideOf(nowClasses, nowLookups, label)))
    /* By whichever side spent more on it: sorted by the recent side alone, a class whose time went
       to nothing sinks under classes that never cost the window anything, and a collapse is exactly
       what a reader of this table is looking for. */
    .sort((left, right) => Math.max(right.before.wait, right.now.wait)
      - Math.max(left.before.wait, left.now.wait));
  return { why: null, rows, lookups: { before: before.help?.calls ?? 0, now: now.help?.calls ?? 0 } };
};

const NAME = 26;
const TITLE = "seconds a call by class, before → now";
const percent = (value) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
const bound = `±${Math.round(MOVED * 100)}%`;

const sideSaid = (side) => `${String(side.calls).padStart(5)} call(s) @ `
  + `${(side.seconds === null ? "—" : `${side.seconds.toFixed(1)}s`).padStart(7)}`;

const classRow = (one) => `  ${one.label.padEnd(NAME)}${sideSaid(one.before)} → ${sideSaid(one.now)}`
  + `${(one.shift === null ? "—" : percent(one.shift)).padStart(8)}`
  + `   lookups ${one.before.lookups} → ${one.now.lookups}`;

/* A move that rounds to nothing is said in words rather than printed as a signed zero: a tenth of a
   second a call over forty calls is a real relative move and no minutes at all, and `0 tool-min`
   beside it reads as the arithmetic having failed rather than as the answer. */
const spent = (one) => (one.toolMinutes
  ? `${one.toolMinutes > 0 ? "+" : ""}${one.toolMinutes} tool-min`
  : "under a tenth of a tool-minute");

const movedSaid = (one) => `  ${one.label.padEnd(NAME)}${percent(one.shift)} a call, `
  + `${spent(one)} over ${one.now.calls} call(s)`;

const byMinutes = (left, right) => Math.abs(right.toolMinutes) - Math.abs(left.toolMinutes);

const movedLines = (rows) => {
  const named = rows.filter((one) => one.named).sort(byMinutes);
  const judged = rows.filter((one) => one.shift !== null && !one.thin).length;
  return ["",
    `what moved more than ${bound} a call, in the tool-minutes that move accounts for at this `
      + "window's own call count",
    ...(named.length
      ? named.map(movedSaid)
      : [`  no class moved past ${bound}, over the ${judged} with a mean on both sides`])];
};

/** The per-class block of the screen, the same comparison `--json` carries. */
export const latencyLines = (held) => {
  const mine = held.classes;
  if (mine.why) return ["", TITLE, `  ${mine.why}`];
  const listed = mine.rows.filter((one) => !one.thin);
  const thin = mine.rows.length - listed.length;
  return [
    "",
    /* The floor is stated whether or not a class fell under it: said only where one did, the rule
       goes unprinted on exactly the corpus where every class clears it, and a reader then has no
       way to know a fold was possible at all. The count below it is the conditional half. */
    `${TITLE} — over every call classed to it, the ${mine.lookups.before} → ${mine.lookups.now} `
      + "help lookup(s) among them included, since a lookup's own wait is inside the class's wait "
      + `and cannot be taken back out of it. A class under ${CALLS} call(s) on both sides is folded `
      + "rather than listed or named",
    ...capped(listed, false).map(classRow),
    ...elided(listed, false),
    ...(thin ? [`  ${thin} class(es) folded, listed under --json`] : []),
    ...movedLines(mine.rows),
  ];
};
