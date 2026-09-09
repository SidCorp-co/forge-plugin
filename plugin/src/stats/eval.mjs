/* `forge stats eval` — the last fifty issue-flow runs against the fifty before them: the cost figures
   the profile computes, and beside them what became of the work, which is the tracker's to say and
   not the profile's. The one line the ship prints at a multiple of the window, the reading it writes
   there, and what a comparison since a release is confounded by — docs/cli/stats-the-eval.md. */
import { RUNG_UNKNOWN, rootFor } from "./transcripts.mjs";
import { checkoutFrom, derivedFrom, profileOf, readingAside, runsUnder, stamp } from "./runs.mjs";
import { UNRECORDED, cacheRoot, copyAt, installedCopies, spansInstall } from "./versions.mjs";
import { WHEN, comparedWindows, groupBy, shiftBetween, shiftLine, twoWindows } from "./windows.mjs";
import {
  RELEASES, RUNS, againstIn, heldAtMark, markLines, marksOf, resolveAgainst, resolveRelease,
  releaseSaid, sinceReleaseIn, writeMark, wroteSaid,
} from "./marks.mjs";
import { BUDGET, HORIZON, UNAVAILABLE, budgetOf, outcomesOf, parkedOver, readThreads, ruledOver } from "./outcomes.mjs";
import { logEntries } from "../codex/codex-log.mjs";
import { fail, projectAt, projectTarget, useProject } from "../resolve/settings.mjs";
import { flags } from "../resolve/flags.mjs";

export const WINDOW = 50;

/* Under this a median is one or two runs wearing a statistic, so the count prints and the median
   does not — for a whole window under `--since-release`, and for one copy's side of a row. */
export const FLOOR = 3;

const UNITS = { d: 86_400_000, h: 3_600_000, m: 60_000 };
const ASKED = /^(?<many>\d+)(?<unit>[dhm])$/u;

export const MARKS_USAGE = [
  "Usage: forge stats marks [--checkout <dir>]",
  "The readings held for this project, one line each, newest first — the count marks the ship writes",
  "every fifty runs, and the release marks it writes at every release, each carrying its version and",
  "the head it landed at.",
].join("\n");

export const EVAL_USAGE = [
  "Usage: forge stats eval [--checkout <dir>] [--size 50] [--against [<mark>]] [--since-release [<version>]] [--horizon 1d] [--requests 400] [--json]",
  "The last fifty issue-flow runs against the fifty before them, on the figures `stats runs` computes,",
  "each window grouped by the copy installed when its runs began, and what separates the two named.",
  "",
  "Beside every cost figure, what became of the work: the issues a window's runs owned, and how many",
  "of them were reopened, judged twice, parked or dropped, with the consult findings those runs",
  "rejected. Those four read the tracker, which is this verb's alone — `forge stats runs` reads none",
  "and prints none of them — and each prints over the population it was counted across, or",
  `\`${UNAVAILABLE}\` where the reading could not be made. \`${UNAVAILABLE}\` is not zero.`,
  "",
  "The ship says when to run it: at every multiple of the window in the project's own corpus, the way",
  "the consult that crosses a hundred-mark names `forge codex eval` — and writes the reading there,",
  "once per mark, which `--against` puts in the before window's place.",
  "",
  "One anchor per reading: each of the two flags below names the point the before window is taken",
  "from, which is also the point the header names and the point the confounding lines count from, so",
  "the two together are refused with both anchors named.",
  "",
  "  --checkout <dir>   as for runs",
  "  --size n           runs per window; fifty unless you say otherwise",
  "  --against [<mark>] the reading held at that mark as the before window, or the newest held",
  "  --since-release [<version>]  the reading held at that release, or the newest, and what the",
  "                     comparison since it is confounded by",
  "  --horizon 1d       how long after a run an outcome still counts as its own; one day unless you",
  "                     say otherwise, and the same interval on both sides",
  "  --requests n       the tracker requests this whole reading may spend; past it the outcome",
  "                     figures print unavailable and every cost figure still prints",
  "  --json             the comparison alone, one object",
].join("\n");

const sized = (raw) => {
  if (raw === undefined) return WINDOW;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`stats eval: --size takes an integer of 1 or more, not \`${raw}\`.`);
  return value;
};

const spend = (raw) => {
  if (raw === undefined) return BUDGET;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    fail(`stats eval: --requests takes an integer of 1 or more, not \`${raw}\`.`);
  }
  return value;
};

const horizonOf = (raw) => {
  if (raw === undefined) return HORIZON;
  const asked = ASKED.exec(raw)?.groups;
  if (!asked || Number(asked.many) < 1) {
    fail(`stats eval: --horizon takes a window like \`3d\`, \`12h\` or \`90m\`, not \`${raw}\`.`);
  }
  return Number(asked.many) * UNITS[asked.unit];
};

const saidHorizon = (ms) => {
  for (const [unit, size] of [["d", UNITS.d], ["h", UNITS.h], ["m", UNITS.m]]) {
    if (ms % size === 0) return `${ms / size}${unit}`;
  }
  return `${Math.round(ms / 1000)}s`;
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

/* Nothing a reader can derive: the profile carries the bounds and the rung counts, the shortfall is the
   size less the runs, and `spanned` is the one count the shifts need that nothing else holds. */
const windowOf = (rows, read) => ({
  runs: rows.length,
  spanned: rows.filter((row) => row.spanned === SPANNED).length,
  profile: profileOf(rows),
  groups: groupsOf(rows),
  /* Absent rather than empty where no tracker was read, so a window computed without one is not a
     window that read and found nothing. */
  ...(read ? { outcomes: outcomesOf(rows, read) } : {}),
});

/* The tallies the shifts compare, read off a window and never its rows: a stored before has none. */
const mixOf = (window) => ({
  rung: Object.fromEntries(window.profile.rungs.map((row) => [row.rung, row.runs])),
  spanned: { [SPANNED]: window.spanned, [STEADY]: window.runs - window.spanned },
});

const RETIRED_ROWS = "tiers";
const RETIRED_ROW = "tier";
const RETIRED_UNKNOWN = "untiered";

const rungsBack = (profile) => {
  const rows = profile?.[RETIRED_ROWS];
  if (!rows) return profile;
  const { [RETIRED_ROWS]: held, ...rest } = profile;
  const rungs = held.map(({ [RETIRED_ROW]: name, ...row }) =>
    ({ rung: name === RETIRED_UNKNOWN ? RUNG_UNKNOWN : name, ...row }));
  return { ...rest, rungs };
};

/** A reading held before the rung had one word carries the retired key for its rows, for each row's
 *  own name, and for the runs no stamp named. All three read as the canonical ones, so a mark written
 *  then compares against a window read now rather than reporting every rung as newly arrived. Every
 *  profile the record holds is turned over, its own and each group's, because `--json` prints the
 *  whole of a stored window and a spelling nothing reads is still a spelling something emitted. */
export const readBack = (record) => {
  if (!record?.now?.profile) return record ?? null;
  const groups = record.now.groups?.map((one) => ({ ...one, profile: rungsBack(one.profile) }));
  return {
    ...record,
    now: {
      ...record.now,
      profile: rungsBack(record.now.profile),
      ...(groups ? { groups } : {}),
    },
  };
};

/** The comparison, every cost figure of it one `profileOf` computes over a window or a group. With a
 *  stored reading, its recent window stands where the earlier one would, through the same lines; a
 *  reading held before the outcome figures existed carries none, which is not the same as zeroes. */
export const evalRuns = (runs, copies, size = WINDOW, against = null, read = null) => {
  const { now, before } = twoWindows(versioned(byEnd(runs), copies), size);
  const nowHeld = windowOf(now, read);
  const beforeHeld = against ? against.now : before.length ? windowOf(before, read) : null;
  return comparedWindows({
    size,
    total: runs.length,
    against,
    now: nowHeld,
    before: beforeHeld,
    moved: beforeHeld
      ? { rungs: movedIn(nowHeld.profile.rungs, beforeHeld.profile.rungs, "rung"),
        phases: movedIn(nowHeld.profile.phases, beforeHeld.profile.phases, "name") }
      : null,
    separates: (a, b) => shiftBetween(mixOf(a), mixOf(b)),
  });
};

const span = (window) => `${stamp(window.profile.from)} to ${stamp(window.profile.to)}`;

/* Under the floor the count stands alone: a median of two runs is a number that reads like a finding
   and is one run's accident. The same rule for a window and for a copy's row. */
const thin = (runs) => runs < FLOOR;

const figureLine = (when, held) => {
  const p = held.profile;
  const head = `  ${when.padEnd(WHEN)} ${String(held.runs).padStart(3)} run(s)  ${span(held)}  `;
  if (thin(held.runs)) return `${head}insufficient evidence: fewer than the floor of ${FLOOR} runs, so no median`;
  return `${head}median ${p.medianMinutes} min, ${p.medianCalls} calls, ${p.waitShare} waiting  `
    + `per run ${p.perRun.gate} gate, ${p.perRun.consult} consult, ${p.perRun.verdict} verdict, ${p.perRun.advance} advance, `
    + `${p.ships.perRun} ship, ${p.editCharsPerRun} edit chars`;
};

const groupLine = (when, group) => {
  const head = `  ${when.padEnd(WHEN)} ${String(group.runs).padStart(3)} run(s)  `;
  if (thin(group.runs)) return `${head}fewer than the floor of ${FLOOR}, so no median`;
  return `${head}median ${group.profile.medianMinutes} min, `
    + `${group.profile.medianCalls} calls, ${group.profile.waitShare} waiting`;
};

/* A release every half hour puts one or two runs under most copies, and a screen of those says
   nothing a reader can act on; the JSON keeps every group, the screen names the ones with runs to
   count and folds the rest into one line. */
const SMALL = FLOOR;

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

/* A count over a population, or the word for a population of nothing. Nothing here rounds into a
   percentage: a rate off eleven pairs printed as a percentage is a figure nobody can put back. */
const NAMES = 26;
const said = (figure) => {
  if (!figure) return "not in that reading";
  const unit = figure.unit ?? "pair";
  return figure.count === null
    ? `${UNAVAILABLE} (0 ${unit}(s) read)`
    : `${figure.count}/${figure.over} ${unit}(s)`;
};

const notesOn = (figure) => [
  figure?.later ? `${figure.later} later than the horizon, counted apart` : null,
  figure?.unattributed ? `${figure.unattributed} park(s) no owner's call answers for` : null,
  figure?.unpaired ? `${figure.unpaired} ruling call(s) unpaired` : null,
].filter(Boolean).join("; ");

/* Both sides and each said whose it is: one window's fraction beside the other's is comparable only
   with the coverage that explains it, and a note printed unlabelled was read as belonging to both. */
const notesLine = (was, figure) => {
  const held = [["before", notesOn(was)], ["now", notesOn(figure)]].filter(([, note]) => note);
  return held.length ? `  ${held.map(([side, note]) => `${side} ${note}`).join("; ")}` : "";
};

const unreadLines = (figure, side) => (figure?.unread ?? []).map((one) =>
  `      ${String(one.pairs).padStart(3)} pair(s) unread ${side}: ${one.why}`);

const outcomeLines = (held) => {
  const mine = held.now.outcomes;
  if (!mine) return [];
  const theirs = held.before?.outcomes ?? null;
  const lines = ["", `what became of the work — horizon ${saidHorizon(mine.horizonMs)}, read ${stamp(Date.parse(mine.readAt))}`,
    `  ${String(mine.pairs).padStart(3)} run-and-issue pair(s) owned by this window, `
    + `${mine.unread} run(s) whose issues this reading could not establish`
    + (theirs ? `; before: ${theirs.pairs} pair(s), ${theirs.unread} unread` : "")];
  let when = null;
  for (const figure of mine.figures) {
    if (figure.when !== when) {
      when = figure.when;
      lines.push(`  ${when}`);
    }
    const was = theirs?.figures.find((one) => one.name === figure.name);
    lines.push(`    ${figure.name.padEnd(NAMES)} ${said(was).padStart(22)} → ${said(figure).padStart(22)}`
      + notesLine(was, figure));
    lines.push(...unreadLines(was, "before"), ...unreadLines(figure, "now"));
  }
  lines.push("A parked figure is the record's own claim and not the issue's status today: no source here can "
    + "establish what an issue's state was when a run ended. A count over a population is comparable with "
    + "another over a different one only as far as both populations are printed, which is why they are.");
  return lines;
};

/* The three things a comparison since one release cannot hold apart, said rather than removed: an
   isolated observation window would mean holding releases back to measure one. */
const confoundedLines = (held, release, copies) => {
  const from = Date.parse(release.at) || 0;
  const to = held.now.profile.to ?? 0;
  const after = copies.filter((one) => one.at > from && one.at <= to).length;
  return ["", `what a comparison since ${release.version} is confounded by`,
    `  ${after} release(s) landed after it inside this window`,
    `  ${held.now.spanned} run(s) saw a release land while they ran, so their later calls used the newer copy`,
    "  a dispatching session may still have held a role, a skill stub or a hook registration from an "
      + "older copy, which no install moves until it restarts"];
};

/** Whether the anchor a screen was taken at is a release's reading, asked of one object by every line
 *  that names it: two points stated for one reading leave the reader nothing to tell which of them
 *  the figures came from. */
const releaseIn = (anchor) => (anchor?.kind === RELEASES ? anchor : null);

const head = (held, anchor) => {
  const full = held.now.runs < held.size ? `  — ${held.size} is a full window and the corpus holds no more` : "";
  const first = `the last ${held.now.runs} issue-flow run(s)  ${span(held.now)}${full}`;
  if (!held.before) {
    return [first,
      `no window before them: the corpus holds ${held.total} run(s) in all, so there is nothing yet to compare this one against.`];
  }
  const overlapping = held.now.profile.from <= held.before.profile.to;
  const release = releaseIn(anchor);
  if (release) {
    return [first, `the ${held.before.runs} held at release ${release.version}  ${span(held.before)}`
      + (overlapping ? "  — overlapping the recent window, which begins before this one ends" : "")];
  }
  if (anchor) return [first, heldAtMark(held.before.runs, held.against, span(held.before), overlapping)];
  const short = held.size - held.before.runs;
  return [
    first,
    `the ${held.before.runs} before them  ${span(held.before)}${short > 0 ? `  — short of a full ${held.size} by ${short}` : ""}`,
  ];
};

/** `anchor` is the stored reading this comparison's before window came from, or null where it slid:
 *  one argument and not one per line, so no line is handed a point another line did not read. */
export const evalLines = (held, anchor = null, copies = []) => {
  const release = releaseIn(anchor);
  const lines = head(held, anchor);
  if (!held.before) return lines;
  return [
    ...lines,
    "",
    figureLine("now", held.now),
    figureLine("before", held.before),
    "",
    ...groupLines(held),
    ...outcomeLines(held),
    ...(release ? confoundedLines(held, release, copies) : []),
    "",
    "moved most, in median minutes before → now",
    movedLine("rung", held.moved.rungs.rose, "rose"),
    movedLine("rung", held.moved.rungs.fell, "fell"),
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

/** The tracker read both windows share, taken once for the union of their pairs and keyed so each
 *  window folds it alone; the ruling pairing's own scope is `outcomes.mjs`'s. */
/** Where the tracker read of a NAMED checkout goes, or null for wherever the shell already points:
 *  `ISS-1` means one issue per project, so a reading of one project's runs against another's records
 *  is a figure about work nobody did. A checkout declaring no project contradicts nothing. */
export const scopeFor = (directory) => {
  const held = projectAt(directory);
  return held && held !== projectTarget().value
    ? { slug: held, from: `the project file under ${directory}` }
    : null;
};

const outcomeRead = async (corpus, directory, size, { horizon, most }) => {
  const rows = byEnd(corpus.runs);
  const { now, before } = twoWindows(rows, size);
  const wanted = [...new Set([...now, ...before].flatMap((run) => run.issues))];
  const { spent, bound } = budgetOf(most);
  const aimed = scopeFor(directory);
  if (aimed) useProject(aimed);
  const { threads, documents } = await readThreads(wanted, bound);
  return {
    threads,
    documents,
    ruled: ruledOver(corpus.runs, logEntries()),
    parks: parkedOver(corpus.runs, threads, documents),
    horizon,
    now: Date.now(),
    spent,
  };
};

/** The object `--json` prints, and the record the ship writes: one assembly, so a stored reading is
 *  what the verb would have computed at that moment. */
const readingOf = (directory, corpus, size, against = null, read = null) => ({
  root: corpus.root,
  project: directory,
  skipped: corpus.skipped,
  unreadable: corpus.unreadable,
  copies: corpus.copies.length,
  ...(read ? { requests: read.spent.requests } : {}),
  ...evalRuns(corpus.runs, corpus.copies, size, against, read),
});

const WRITES = "the release step writes one at every multiple of fifty runs in the corpus";
const RELEASE_WRITES = "the release step writes one at every release";

const anchorAsked = (flag, value) => (value === null ? flag : `${flag} ${value}`);

/* Every line answers for the one point a reading was taken at: the before window comes from it, the
   header names it, the confounding count measures from it. Two flags name two, so the pair is refused
   rather than one taking the figures while the other takes the words. */
const oneAnchorOnly = (against, release) => fail(
  `stats eval: ${anchorAsked("--against", against)} and ${anchorAsked("--since-release", release)} name two anchors, `
  + "and a reading has one — the before window, the header line and the confounding lines all read it. "
  + `Run one alone: \`forge stats eval ${anchorAsked("--against", against)}\` for the reading held at a count mark, `
  + `or \`forge stats eval ${anchorAsked("--since-release", release)}\` for the one held at a release.`,
);

/** The count is the corpus's own, read each time and never off the store, so no stale memory of a
 *  crossing can misplace it; the reading is written once, and a second ship landing on the same
 *  count appends nothing. */
export const runsMark = (directory, size = WINDOW) => {
  const corpus = corpusOf(directory);
  const many = corpus.runs.length;
  if (!(many > 0 && many % size === 0)) return null;
  const said = `stats: ${many} issue-flow runs in this project's corpus — \`forge stats eval\`.`;
  const wrote = writeMark({ kind: RUNS, mark: many, at: new Date().toISOString(),
    ...readingOf(directory, corpus, size) });
  return `${said} ${wroteSaid(wrote, many, "forge stats eval")}`;
};

/** The mark a release writes, whatever the corpus count: the version and the head are the only
 *  things a run cannot work out later, and `--since-release` is what reads it back. Silent unless
 *  the corpus holds a run, since a reading of nothing pins nothing. */
export const releaseMark = (directory, { version, head }, size = WINDOW) => {
  if (!version) return null;
  const corpus = corpusOf(directory);
  if (!corpus.runs.length) return null;
  const wrote = writeMark({
    kind: RELEASES, mark: corpus.runs.length, version, head: head ?? null,
    at: new Date().toISOString(), ...readingOf(directory, corpus, size),
  });
  return `stats: this release is held as ${version} over ${corpus.runs.length} run(s) `
    + `(\`forge stats eval --since-release ${version}\`). ${releaseSaid(wrote, version)}`;
};

export const printEval = async (argv) => {
  const { against, rest: left } = againstIn(argv, "stats eval");
  const { release, rest } = sinceReleaseIn(left);
  if (against !== undefined && release !== undefined) oneAnchorOnly(against, release);
  const { checkout, size, horizon, requests, json } = flags(rest, "stats eval", ["--json"], { usage: EVAL_USAGE });
  const window = sized(size);
  const asked = { horizon: horizonOf(horizon), most: spend(requests) };
  const directory = checkoutFrom(checkout, "stats eval");
  const corpus = corpusOf(directory);
  /* The reading asked for is resolved before the corpus is judged: a mark nobody wrote is refused by
     name whatever the corpus holds, rather than answered with the empty corpus's sentence. */
  const stored = against === undefined ? null
    : resolveAgainst(RUNS, against, { root: corpus.root, verb: "stats eval", list: "forge stats marks", writes: WRITES });
  const since = release === undefined ? null
    : resolveRelease(corpus.root, release, { verb: "stats eval", list: "forge stats marks", writes: RELEASE_WRITES });
  if (!corpus.runs.length) {
    return console.log(`No issue-flow run under ${corpus.root}, so there is nothing to compare. `
      + `${readingAside(corpus)}.${derivedFrom(directory)}`);
  }
  const read = await outcomeRead(corpus, directory, window, asked);
  const anchor = readBack(stored ?? since ?? null);
  const held = readingOf(directory, corpus, window, anchor, read);
  if (json) return console.log(JSON.stringify(held, null, 2));
  for (const line of evalLines(held, anchor, corpus.copies)) console.log(line);
  return null;
};

/** `forge stats marks` — the readings held for the project, newest first. */
export const printMarks = (rest) => {
  const { checkout } = flags(rest, "stats marks", [], { usage: MARKS_USAGE });
  const directory = checkoutFrom(checkout, "stats marks");
  const counts = marksOf(RUNS, rootFor(directory));
  const releases = marksOf(RELEASES, rootFor(directory));
  if (!counts.length && !releases.length) {
    return console.log(`No reading is held for this project yet; ${WRITES}, and ${RELEASE_WRITES}.`);
  }
  const window = (one) => `${String(one.now.runs).padStart(3)} run(s)  ${stamp(one.now.profile.from)} to ${stamp(one.now.profile.to)}`;
  for (const line of markLines(counts, window)) console.log(line);
  for (const line of markLines(releases, (one) => `release ${one.version} at ${one.head ?? "no head recorded"}  ${window(one)}`)) {
    console.log(line);
  }
  return null;
};
