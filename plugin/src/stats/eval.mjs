/* `forge stats eval` — the last fifty issue-flow runs against the fifty before them, on the figures
   the profile already computes, and the one line the ship prints when the corpus reaches a multiple
   of the window. Nothing is written — docs/cli/stats-the-eval.md. */
import { rootFor } from "./transcripts.mjs";
import { derivedFrom, profileOf, projectFrom, readingAside, runsUnder, stamp } from "./runs.mjs";
import { UNRECORDED, cacheRoot, installedCopies, spansInstall, versionAt } from "./versions.mjs";
import { WHEN, shiftBetween, shiftLine, twoWindows } from "./windows.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags } from "../resolve/flags.mjs";
import { unknownFlag } from "../suggest.mjs";

export const WINDOW = 50;

export const EVAL_USAGE = [
  "Usage: forge stats eval [--project <dir>] [--size 50] [--json]",
  "The last fifty issue-flow runs against the fifty before them, on the figures `stats runs` computes,",
  "each window grouped by the copy installed when its runs began, and what separates the two named.",
  "Nothing is written. The ship says when to run it: at every multiple of the window in the project's",
  "own corpus, the way the consult that crosses a hundred-mark names `forge codex eval`.",
  "",
  "  --project <dir>  as for runs",
  "  --size n       runs per window; fifty unless you say otherwise",
  "  --json         the comparison alone, one object",
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
  copy: versionAt(copies, run.startedAt),
  spanned: spansInstall(copies, run) ? SPANNED : STEADY,
}));

const DIMENSIONS = [
  ["copy", (run) => run.copy],
  ["tier", (run) => run.tier],
  ["spanned", (run) => run.spanned],
];

const groupsOf = (rows) => {
  const held = new Map();
  for (const row of rows) {
    const group = held.get(row.copy) ?? [];
    if (!group.length) held.set(row.copy, group);
    group.push(row);
  }
  return [...held].map(([copy, runs]) => ({ copy, runs: runs.length, profile: profileOf(runs) }));
};

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

const windowOf = (rows, size) => {
  const profile = profileOf(rows);
  return { runs: rows.length, short: size - rows.length, from: profile.from, to: profile.to, profile, groups: groupsOf(rows) };
};

/** The comparison, every figure of it one `profileOf` computes over a window or a group. */
export const evalRuns = (runs, copies, size = WINDOW) => {
  const { now, before } = twoWindows(versioned(byEnd(runs), copies), size);
  const nowHeld = windowOf(now, size);
  const beforeHeld = before.length ? windowOf(before, size) : null;
  return {
    size,
    total: runs.length,
    now: nowHeld,
    before: beforeHeld,
    moved: beforeHeld
      ? { tiers: movedIn(nowHeld.profile.tiers, beforeHeld.profile.tiers, "tier"),
        phases: movedIn(nowHeld.profile.phases, beforeHeld.profile.phases, "name") }
      : null,
    shifts: beforeHeld ? shiftBetween(now, before, DIMENSIONS) : [],
  };
};

const figureLine = (when, held) => {
  const p = held.profile;
  return `  ${when.padEnd(WHEN)} ${String(held.runs).padStart(3)} run(s)  ${stamp(held.from)} to ${stamp(held.to)}  `
    + `median ${p.medianMinutes} min, ${p.medianCalls} calls, ${p.waitShare} waiting  `
    + `per run ${p.perRun.gate} gate, ${p.perRun.consult} consult, ${p.perRun.verdict} verdict, ${p.perRun.advance} advance`;
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

/* Only the copies are folded: every other dimension has a handful of values a reader wants named. */
const FOLD = { least: SMALL, folds: (name) => name === "copy" };

const head = (held) => {
  const full = held.now.runs < held.size ? `  — ${held.size} is a full window and the corpus holds no more` : "";
  const first = `the last ${held.now.runs} issue-flow run(s)  ${stamp(held.now.from)} to ${stamp(held.now.to)}${full}`;
  if (!held.before) {
    return [first,
      `no window before them: the corpus holds ${held.total} run(s) in all, so there is nothing yet to compare this one against.`];
  }
  return [
    first,
    `the ${held.before.runs} before them  ${stamp(held.before.from)} to ${stamp(held.before.to)}`
      + (held.before.short > 0 ? `  — short of a full ${held.size} by ${held.before.short}` : ""),
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
    ...held.shifts.map((shift) => shiftLine(shift, FOLD)),
    "",
    "A copy is the one installed when the run began, read off the cache directory's creation time, and "
      + "fixes the guide text, the CLI and the gates its calls used until the next install; a run that saw a "
      + "release land ran the newer copy after it. A role or a stub the dispatching session loaded earlier is "
      + "not fixed by it.",
  ];
};

/** The one line the ship prints at a multiple of the window, or null. The count is the corpus's own,
 *  read each time, so nothing remembers a crossing and nothing can remember it wrongly. */
export const runsMark = (directory, size = WINDOW) => {
  const { runs } = runsUnder(rootFor(directory), null);
  const many = runs.length;
  return many > 0 && many % size === 0 ? `stats: ${many} issue-flow runs in this project's corpus — \`forge stats eval\`.` : null;
};

export const printEval = (rest) => {
  const wrong = unknownFlag("stats eval", rest, { usage: EVAL_USAGE });
  if (wrong) fail(wrong);
  const { project, size, json } = flags(rest, "stats eval", ["--json"]);
  const window = sized(size);
  const directory = projectFrom(project, "stats eval");
  const root = rootFor(directory);
  const { runs, skipped, unreadable } = runsUnder(root, null);
  const copies = installedCopies(cacheRoot());
  if (!runs.length) {
    return console.log(`No issue-flow run under ${root}, so there is nothing to compare. `
      + `${readingAside({ skipped, unreadable })}.${derivedFrom(directory)}`);
  }
  const held = evalRuns(runs, copies, window);
  if (json) {
    return console.log(JSON.stringify({ root, project: directory, skipped, unreadable, copies: copies.length, ...held }, null, 2));
  }
  for (const line of evalLines(held)) console.log(line);
};
