/* `forge stats eval` — the last fifty issue-flow runs against the fifty before them, on the figures
   the profile already computes; the one line the ship prints when the corpus reaches a multiple of
   the window, and the reading it writes there once, which `--against` reads back as the before
   window — docs/cli/stats-the-eval.md. */
import { rootFor } from "./transcripts.mjs";
import { derivedFrom, profileOf, projectFrom, readingAside, runsUnder, stamp } from "./runs.mjs";
import { UNRECORDED, cacheRoot, copyAt, installedCopies, spansInstall } from "./versions.mjs";
import { WHEN, comparedWindows, groupBy, shiftBetween, shiftLine, twoWindows } from "./windows.mjs";
import { RUNS, againstIn, heldAtMark, markLines, marksOf, resolveAgainst, writeMark, wroteSaid } from "./marks.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags } from "../resolve/flags.mjs";

export const WINDOW = 50;

export const MARKS_USAGE = [
  "Usage: forge stats marks [--project <dir>]",
  "The readings held for this project, one line each, newest first.",
].join("\n");

export const EVAL_USAGE = [
  "Usage: forge stats eval [--project <dir>] [--size 50] [--against [<mark>]] [--json]",
  "The last fifty issue-flow runs against the fifty before them, on the figures `stats runs` computes,",
  "each window grouped by the copy installed when its runs began, and what separates the two named.",
  "The ship says when to run it: at every multiple of the window in the project's own corpus, the way",
  "the consult that crosses a hundred-mark names `forge codex eval` — and writes the reading there,",
  "once per mark, which `--against` puts in the before window's place.",
  "",
  "  --project <dir>    as for runs",
  "  --size n           runs per window; fifty unless you say otherwise",
  "  --against [<mark>] the reading held at that mark as the before window, or the newest held",
  "  --json             the comparison alone, one object",
].join("\n");

const sized = (raw) => {
  if (raw === undefined) return WINDOW;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`stats eval: --size takes an integer of 1 or more, not \`${raw}\`.`);
  return value;
};

/* By the run's own last record, landed or not: a run that parked spent its minutes the same as one
   that closed, and the comparison is of cost. The profile sorts by start; a window is by end. */
const byEnd = (runs) => [...runs].sort((left, right) => left.endedAt - right.endedAt);

const SPANNED = "saw a release land";
const STEADY = "one copy throughout";

const versioned = (runs, copies) => runs.map((run) => ({
  ...run,
  copy: copyAt(copies, run.startedAt),
  spanned: spansInstall(copies, run) ? SPANNED : STEADY,
}));

const groupsOf = (rows) =>
  [...groupBy(rows, (row) => row.copy)].map(([copy, runs]) => ({ copy, runs: runs.length, profile: profileOf(runs) }));

/* Over rows present on both sides with runs on both: a row one window never reached has no median to
   move, and reading its zero as a fall is the mistake the phase table was built against. */
const movedIn = (nowRows, beforeRows, key) => {
  const pairs = nowRows
    .map((row) => [row, beforeRows.find((one) => one[key] === row[key])])
    .filter(([now, before]) => before && now.runs > 0 && before.runs > 0)
    .map(([now, before]) => ({
      row: now[key],
      before: before.medianMinutes,
      now: now.medianMinutes,
      by: Math.round((now.medianMinutes - before.medianMinutes) * 10) / 10,
      runsBefore: before.runs,
      runsNow: now.runs,
    }));
  /* One pass, and strictly: the sorts this replaces were stable, so the first row of an equal pair
     won, and only a strict comparison keeps that reading. */
  const moved = { rose: null, fell: null };
  for (const one of pairs) {
    if (one.by > 0 && one.by > (moved.rose?.by ?? 0)) moved.rose = one;
    if (one.by < 0 && one.by < (moved.fell?.by ?? 0)) moved.fell = one;
  }
  return moved;
};

/* Nothing a reader can derive: the profile carries the bounds and the tier counts, the shortfall is the
   size less the runs, and `spanned` is the one count the shifts need that nothing else holds. */
const windowOf = (rows) => ({
  runs: rows.length,
  spanned: rows.filter((row) => row.spanned === SPANNED).length,
  profile: profileOf(rows),
  groups: groupsOf(rows),
});

/* The tallies the shifts compare, read off a window and never its rows: a stored before has none. */
const mixOf = (window) => ({
  tier: Object.fromEntries(window.profile.tiers.map((row) => [row.tier, row.runs])),
  spanned: { [SPANNED]: window.spanned, [STEADY]: window.runs - window.spanned },
});

/** The comparison, every figure of it one `profileOf` computes over a window or a group. With a stored
 *  reading, its recent window stands where the earlier one would, through the same lines. */
export const evalRuns = (runs, copies, size = WINDOW, against = null) => {
  const { now, before } = twoWindows(versioned(byEnd(runs), copies), size);
  const nowHeld = windowOf(now);
  const beforeHeld = against ? against.now : before.length ? windowOf(before) : null;
  return comparedWindows({
    size,
    total: runs.length,
    against,
    now: nowHeld,
    before: beforeHeld,
    moved: beforeHeld
      ? { tiers: movedIn(nowHeld.profile.tiers, beforeHeld.profile.tiers, "tier"),
        phases: movedIn(nowHeld.profile.phases, beforeHeld.profile.phases, "name") }
      : null,
    separates: (a, b) => shiftBetween(mixOf(a), mixOf(b)),
  });
};

const span = (window) => `${stamp(window.profile.from)} to ${stamp(window.profile.to)}`;

const figureLine = (when, held) => {
  const p = held.profile;
  return `  ${when.padEnd(WHEN)} ${String(held.runs).padStart(3)} run(s)  ${span(held)}  `
    + `median ${p.medianMinutes} min, ${p.medianCalls} calls, ${p.waitShare} waiting  `
    + `per run ${p.perRun.gate} gate, ${p.perRun.consult} consult, ${p.perRun.verdict} verdict, ${p.perRun.advance} advance, `
    + `${p.ships.perRun} ship, ${p.editCharsPerRun} edit chars`;
};

const groupLine = (when, group) =>
  `  ${when.padEnd(WHEN)} ${String(group.runs).padStart(3)} run(s)  median ${group.profile.medianMinutes} min, `
  + `${group.profile.medianCalls} calls, ${group.profile.waitShare} waiting`;

/* A release every half hour puts one or two runs under most copies, and a screen of those says
   nothing a reader can act on; the JSON keeps every group, the screen names the ones with runs to
   count and folds the rest into one line. */
const SMALL = 3;

const groupLines = (held) => {
  const groups = new Map();
  for (const one of held.now.groups) groups.set(one.copy, { now: one });
  for (const one of held.before?.groups ?? []) groups.set(one.copy, { ...groups.get(one.copy), before: one });
  const large = [...groups].filter(([, pair]) => (pair.now?.runs ?? 0) >= SMALL || (pair.before?.runs ?? 0) >= SMALL);
  const small = [...groups].filter(([copy]) => !large.some(([one]) => one === copy));
  const lines = large.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).flatMap(([copy, pair]) => [
    `copy ${copy}${copy === UNRECORDED ? " — began before every copy the cache still holds" : ""}`,
    pair.now ? groupLine("now", pair.now) : `  ${"now".padEnd(WHEN)} not in this window`,
    pair.before ? groupLine("before", pair.before) : `  ${"before".padEnd(WHEN)} not in this window`,
  ]);
  if (small.length) {
    const sum = (side) => small.reduce((many, [, pair]) => many + (pair[side]?.runs ?? 0), 0);
    lines.push(`${small.length} other cop${small.length === 1 ? "y" : "ies"} with fewer than ${SMALL} runs on either side: `
      + `${sum("before")} → ${sum("now")} run(s), listed under --json`);
  }
  return lines;
};

const movedLine = (what, one, way) => (one
  ? `  ${what.padEnd(6)} ${one.row.padEnd(12)} ${one.before} → ${one.now} min (${one.by > 0 ? "+" : ""}${one.by}) `
    + `over ${one.runsBefore} → ${one.runsNow} run(s)  ${way}`
  : `  ${what.padEnd(6)} no row ${way} on both sides`);

const head = (held) => {
  const full = held.now.runs < held.size ? `  — ${held.size} is a full window and the corpus holds no more` : "";
  const first = `the last ${held.now.runs} issue-flow run(s)  ${span(held.now)}${full}`;
  if (!held.before) {
    return [first,
      `no window before them: the corpus holds ${held.total} run(s) in all, so there is nothing yet to compare this one against.`];
  }
  if (held.against !== undefined) {
    return [first, heldAtMark(held.before.runs, held.against, span(held.before),
      held.now.profile.from <= held.before.profile.to)];
  }
  const short = held.size - held.before.runs;
  return [
    first,
    `the ${held.before.runs} before them  ${span(held.before)}${short > 0 ? `  — short of a full ${held.size} by ${short}` : ""}`,
  ];
};

export const evalLines = (held) => {
  const lines = head(held);
  if (!held.before) return lines;
  return [
    ...lines,
    "",
    figureLine("now", held.now),
    figureLine("before", held.before),
    "",
    ...groupLines(held),
    "",
    "moved most, in median minutes before → now",
    movedLine("tier", held.moved.tiers.rose, "rose"),
    movedLine("tier", held.moved.tiers.fell, "fell"),
    movedLine("phase", held.moved.phases.rose, "rose"),
    movedLine("phase", held.moved.phases.fell, "fell"),
    "",
    "what separates the two windows, in runs before → now",
    ...held.shifts.map((shift) => shiftLine(shift)),
    "",
    "A copy is the one installed when the run began, read off the cache directory's creation time, and "
      + "fixes the guide text, the CLI and the gates its calls used until the next install; a run that saw a "
      + "release land ran the newer copy after it. A role or a stub the dispatching session loaded earlier is "
      + "not fixed by it.",
  ];
};

const corpusOf = (directory) => {
  const root = rootFor(directory);
  return { root, ...runsUnder(root, null), copies: installedCopies(cacheRoot()) };
};

/** The object `--json` prints, and the record the ship writes: one assembly, so a stored reading is
 *  what the verb would have computed at that moment. */
const readingOf = (directory, corpus, size, against = null) => ({
  root: corpus.root,
  project: directory,
  skipped: corpus.skipped,
  unreadable: corpus.unreadable,
  copies: corpus.copies.length,
  ...evalRuns(corpus.runs, corpus.copies, size, against),
});

const WRITES = "the release step writes one at every multiple of fifty runs in the corpus";

/** The one line the ship prints at a multiple of the window, or null. The count is the corpus's own,
 *  read each time and never off the store, so no stale memory of a crossing can misplace it; the
 *  reading is written there once, and a second ship landing on the same count appends nothing. */
export const runsMark = (directory, size = WINDOW) => {
  const corpus = corpusOf(directory);
  const many = corpus.runs.length;
  if (!(many > 0 && many % size === 0)) return null;
  const said = `stats: ${many} issue-flow runs in this project's corpus — \`forge stats eval\`.`;
  const wrote = writeMark({ kind: RUNS, mark: many, at: new Date().toISOString(), ...readingOf(directory, corpus, size) });
  return `${said} ${wroteSaid(wrote, many, "forge stats eval")}`;
};

export const printEval = (argv) => {
  const { against, rest } = againstIn(argv, "stats eval");
  const { project, size, json } = flags(rest, "stats eval", ["--json"], { usage: EVAL_USAGE });
  const window = sized(size);
  const directory = projectFrom(project, "stats eval");
  const corpus = corpusOf(directory);
  /* The reading asked for is resolved before the corpus is judged: a mark nobody wrote is refused by
     name whatever the corpus holds, rather than answered with the empty corpus's sentence. */
  const stored = against === undefined ? null
    : resolveAgainst(RUNS, against, { root: corpus.root, verb: "stats eval", list: "forge stats marks", writes: WRITES });
  if (!corpus.runs.length) {
    return console.log(`No issue-flow run under ${corpus.root}, so there is nothing to compare. `
      + `${readingAside(corpus)}.${derivedFrom(directory)}`);
  }
  const held = readingOf(directory, corpus, window, stored);
  if (json) return console.log(JSON.stringify(held, null, 2));
  for (const line of evalLines(held)) console.log(line);
};

/** `forge stats marks` — the readings held for the project, newest first. */
export const printMarks = (rest) => {
  const { project } = flags(rest, "stats marks", [], { usage: MARKS_USAGE });
  const directory = projectFrom(project, "stats marks");
  const held = marksOf(RUNS, rootFor(directory));
  if (!held.length) return console.log(`No reading is held for this project yet; ${WRITES}.`);
  const lines = markLines(held, (one) =>
    `${String(one.now.runs).padStart(3)} run(s)  ${stamp(one.now.profile.from)} to ${stamp(one.now.profile.to)}`);
  for (const line of lines) console.log(line);
};
