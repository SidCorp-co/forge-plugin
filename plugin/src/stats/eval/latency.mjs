/* How long a call of each class took in each of the two windows `forge stats eval` compares, so a
   movement in what the harness spends is told apart from a movement in what it waits on. What the
   population is, and why the bound is a constant — docs/cli/stats-the-latency.md. */
import { DECIDED_BY_RELEASE, MOVED_AT } from "../corpus/generations.mjs";
import { DECLARABLE } from "../corpus/declared.mjs";
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

/** Which generation of the class table classed a profile's calls; `null` for a profile written
 *  before that number existed, whose table is therefore unknown here rather than assumed. */
const generationOf = (profile) => (typeof profile?.table === "number" ? profile.table : null);

/** Which words a profile's declared rows were counted by; `null` for a profile written before that
 *  was carried, which cannot be told from a project that declared nothing and so is told apart. */
const wordsOf = (profile) => (typeof profile?.declares === "string" ? profile.declares : null);

const GENERATIONS = "classed by";
const WORDS = "counted by different words for the rows a project's own declaration arms";
const ACT = "taken under different answers to what this project's release model asks of phase 7, "
  + "which decides whether the deploy row is in the table at all and what the landing rows count";

/** Which answer the release model gave when a profile was taken; `null` for one written before that
 *  was carried. The answer and not the model's word, so two projects that both declare no release
 *  step are told apart where one deploys production on its own and the other ships nothing. */
const actOf = (profile) => (typeof profile?.release === "string" ? profile.release : null);

/* What a project decided that a reading carries beside the table's generation: the answer each side
   gave, what a difference is called, and the rows a difference crosses. */
const CROSSINGS = [[wordsOf, WORDS, DECLARABLE], [actOf, ACT, DECIDED_BY_RELEASE]];

/* Which rows hold a different population on the two sides, and why. What moves a row's population is
   `MOVED_AT` in corpus/generations.mjs; the readings here are: a stored reading taken at an earlier
   generation is crossed on the rows that have moved since, and one naming no generation is crossed on
   every row rather than on the ones it happens to share, the table behind it being unreadable
   (ISS-2086). */
const crossedIn = (before, now) => {
  const held = generationOf(before);
  const why = [];
  let moved = () => false;
  /* Equal first, so two readings this table classed cross nothing whether or not either says which
     table that was: a sliding comparison and a pair of profiles built by hand are both that. */
  if (held === generationOf(now)) moved = () => false;
  else if (held === null) {
    why.push(`${GENERATIONS} a class table this reading cannot name, against generation ${generationOf(now)}`);
    moved = () => true;
  } else {
    why.push(`${GENERATIONS} class table generation ${held}, against generation ${generationOf(now)}`);
    moved = (label) => (MOVED_AT.get(label) ?? 0) > held;
  }
  if (held !== null) {
    for (const [answerOf, said, rows] of CROSSINGS) {
      if (answerOf(before) === answerOf(now)) continue;
      why.push(said);
      const prior = moved;
      moved = (label) => prior(label) || rows.includes(label);
    }
  }
  return { crossed: moved, why };
};

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

/* A crossed row takes no pair of means, which is what carries through to the shift, the minutes and
   the naming alike: the two figures are counts over different populations, and their difference is
   arithmetic on a definition that moved rather than a movement in what the harness spends. */
const rowOf = (label, before, now, crossed) => {
  const both = !crossed && before.seconds !== null && now.seconds !== null && before.seconds > 0;
  const thin = before.calls < CALLS && now.calls < CALLS;
  const shift = both ? (now.seconds - before.seconds) / before.seconds : null;
  return {
    label,
    before,
    now,
    crossed,
    shift,
    /* A difference of two means times a call count, and what `unionSeconds` in figures.mjs states of
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
  if (!before) return { why: NO_BEFORE, rows: [], crossedWhy: [], lookups: null };
  if (!Array.isArray(before.byClass)) return { why: NO_CLASSES, rows: [], crossedWhy: [], lookups: null };
  const nowClasses = classesIn(now.byClass);
  const beforeClasses = classesIn(before.byClass);
  const nowLookups = lookupsIn(now.helpReads);
  const beforeLookups = lookupsIn(before.helpReads);
  const held = crossedIn(before, now);
  const rows = [...new Set([...nowClasses.keys(), ...beforeClasses.keys()])]
    .map((label) => rowOf(label, sideOf(beforeClasses, beforeLookups, label),
      sideOf(nowClasses, nowLookups, label), held.crossed(label)))
    /* By whichever side spent more on it: sorted by the recent side alone, a class whose time went
       to nothing sinks under classes that never cost the window anything, and a collapse is exactly
       what a reader of this table is looking for. */
    .sort((left, right) => Math.max(right.before.wait, right.now.wait)
      - Math.max(left.before.wait, left.now.wait));
  return {
    why: null,
    rows,
    crossedWhy: held.why,
    lookups: { before: before.help?.calls ?? 0, now: now.help?.calls ?? 0 },
  };
};

const NAME = 26;
const TITLE = "seconds a call by class, before → now";
const signedWhole = (value) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
const bound = `±${Math.round(MOVED * 100)}%`;

const sideSaid = (side) => `${String(side.calls).padStart(5)} call(s) @ `
  + `${(side.seconds === null ? "—" : `${side.seconds.toFixed(1)}s`).padStart(7)}`;

const classRow = (one) => `  ${one.label.padEnd(NAME)}${sideSaid(one.before)} → ${sideSaid(one.now)}`
  + `${(one.shift === null ? "—" : signedWhole(one.shift)).padStart(8)}`
  + `   lookups ${one.before.lookups} → ${one.now.lookups}`;

/* A move that rounds to nothing is said in words rather than printed as a signed zero: a tenth of a
   second a call over forty calls is a real relative move and no minutes at all, and `0 tool-min`
   beside it reads as the arithmetic having failed rather than as the answer. */
const spent = (one) => (one.toolMinutes
  ? `${one.toolMinutes > 0 ? "+" : ""}${one.toolMinutes} tool-min`
  : "under a tenth of a tool-minute");

const movedSaid = (one) => `  ${one.label.padEnd(NAME)}${signedWhole(one.shift)} a call, `
  + `${spent(one)} over ${one.now.calls} call(s)`;

/* Its own line rather than a mark on the row, because a crossed row has to reach the reader whatever
   the table does with it: the listing caps at ten and folds a class thin on both sides, and a
   statement about what a figure means cannot be the one the fold takes. Said where a generation was
   crossed and nowhere else — a sliding comparison classed both its windows by the running table. */
const crossedLines = (mine) => {
  const crossed = mine.rows.filter((one) => one.crossed);
  if (!crossed.length) return [];
  const stood = mine.rows.length - crossed.length;
  return ["",
    `${crossed.map((one) => one.label).join(", ")} — not comparable: the window before this one was `
      + `${mine.crossedWhy.join(", and the two were ")}, so each of those rows counts a different `
      + "population on the two sides, and neither a move nor a share of one is read off it"
      + (stood ? `. The other ${stood} row(s) stand` : ", which is every row of this pair")];
};

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
    ...crossedLines(mine),
    ...movedLines(mine.rows),
  ];
};
