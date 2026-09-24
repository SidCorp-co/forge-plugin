/* `forge stats eval` — the last fifty issue-flow runs against the fifty before them: the cost figures
   the profile computes, and beside them what became of the work, which is the tracker's to say and
   not the profile's. What a comparison since a release is confounded by, and what a reading too
   shallow for its own window says instead — docs/cli/stats-the-eval.md; the line the ship prints at a
   multiple of the window and the reading it writes there — docs/cli/stats-the-mark.md. */
import { RUNG_UNKNOWN } from "../corpus/transcripts.mjs";
import { scopeFor } from "../corpus/release.mjs";
import { corpusOf } from "../corpus/read.mjs";
import { deviceOf } from "../../resolve/machine/device.mjs";
import { checkoutFrom, derivedFrom, profileOf, readingAside } from "../runs.mjs";
import { stamp } from "../figures.mjs";
import { UNRECORDED, copyAt, servedCopies, spansInstall } from "../versions.mjs";
import { WHEN, comparedWindows, groupBy, shiftBetween, shiftLine, twoWindows } from "../windows.mjs";
import {
  RELEASES, RUNS, againstIn, heldAtMark, markLines, marksOf, resolveAgainst, resolveRelease,
  releaseSaid, scopeOf, sinceReleaseIn, writeMark, wroteSaid,
} from "../marks/marks.mjs";
import { reachOf, reachSaid } from "../marks/reach.mjs";
import { overlapOf, overlapSaid } from "../marks/overlap.mjs";
import { BUDGET, HORIZON, UNAVAILABLE, budgetOf, outcomesOf, parkedOver, readThreads, ruledOver } from "./outcomes.mjs";
import { classesCompared, latencyLines } from "./latency.mjs";
import { NOT_MEASURED, angleList, anglesAsked, anglesOver, anglesSaid } from "./angles.mjs";
import { POPULATIONS, contractOf } from "./reading.mjs";
import { logEntries } from "../../codex/codex-log.mjs";
import { fail, useProject } from "../../resolve/settings.mjs";
import { flags } from "../../resolve/flags.mjs";
import { printWavesEval } from "../waves/eval.mjs";
import { typedBack } from "../../refusal.mjs";
import { UNITS, durationOf } from "../window/duration.mjs";

export const WINDOW = 50;

/* Under this a median is one or two runs wearing a statistic, so the count prints and the median
   does not — for a whole window under `--since-release`, and for one copy's side of a row. */
export const FLOOR = 3;

export const MARKS_USAGE = [
  "Usage: forge stats marks [--checkout <dir>]",
  "The readings held for this project, one line each, newest first — the count marks the ship writes",
  "every fifty runs, and the release marks it writes at every release, each carrying its version and",
  "the head it landed at.",
].join("\n");

export const EVAL_USAGE = [
  "Usage: forge stats eval [--checkout <dir>] [--size 50] [--against [<mark>]] [--since-release [<version>]]",
  "                        [--angles a,a] [--horizon 1d] [--requests 400] [--json]",
  "The last fifty issue-flow runs against the fifty before them, on the figures `stats runs` computes,",
  "each window grouped by the copy installed when its runs began, and what separates the two named.",
  "",
  "Beside every cost figure, what became of the work: the issues a window's runs owned, and how many",
  "of them were reopened, judged twice, parked or dropped, with the consult findings those runs",
  "rejected. Those four read the tracker, which is this verb's alone, and each prints over the",
  `population it was counted across, or \`${UNAVAILABLE}\` where the reading could not be made.`,
  `\`${UNAVAILABLE}\` is not zero.`,
  "",
  "The ship says when to run it: at every multiple of the window in the project's own corpus, writing",
  "the reading there once per mark, which `--against` puts in the before window's place.",
  "",
  "One anchor per reading: each of the two flags below names the point the before window is taken",
  "from, which is also the point the header names and the point the confounding lines count from, so",
  "the two together are refused with both anchors named, as is a reading sharing most of the window.",
  "",
  "  --checkout <dir>   as for runs",
  "  --size n           runs per window; fifty unless you say otherwise",
  "  --against [<mark>] the reading held at that mark as the before window, or alone the newest",
  "                     sharing none of the recent window",
  "  --since-release [<version>]  as --against, for a release, and what it is confounded by",
  "  --angles a,a       which angles to judge and in what order, each over the population it names",
  "                     and against how far two adjacent blocks of this corpus have themselves",
  "                     differed; every one of them unless you say otherwise. There is:",
  ...angleList("                       ", 97),
  "  --horizon 1d       how long after a run an outcome still counts as its own; one day unless you",
  "                     say otherwise, and the same interval on both sides",
  "  --requests n       the tracker requests this whole reading may spend; past it the outcome",
  "                     figures print unavailable and every cost figure still prints",
  "  --json             the comparison alone, one object",
  "  --waves            dispatch waves instead of runs: forge stats eval --waves -h",
].join("\n");

const sized = (raw) => {
  if (raw === undefined) return WINDOW;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`stats eval: --size takes an integer of 1 or more, not \`${raw}\`.`);
  return value;
};

export const spend = (raw, verb = "stats eval") => {
  if (raw === undefined) return BUDGET;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    fail(`${verb}: --requests takes an integer of 1 or more, not \`${raw}\`.`);
  }
  return value;
};

export const horizonOf = (raw, verb = "stats eval") => {
  if (raw === undefined) return HORIZON;
  return durationOf(raw, verb, "--horizon");
};

export const saidHorizon = (ms) => {
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

const groupsOf = (rows, declared, act) =>
  [...groupBy(rows, (row) => row.copy)]
    .map(([copy, runs]) => ({ copy, runs: runs.length, profile: profileOf(runs, declared, act) }));

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
const windowOf = (rows, read, declared, act) => ({
  runs: rows.length,
  spanned: rows.filter((row) => row.spanned === SPANNED).length,
  profile: profileOf(rows, declared, act),
  groups: groupsOf(rows, declared, act),
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
const readBack = (record) => {
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

/* A run is the row here, and it arrives by ending. */
const RUN_TERMS = { unit: "run(s)", noun: "run", arrived: "ended" };

/* The recent runs a stored reading's window held: both windows are the latest runs by end, so over one
   corpus they are the recent runs that had ended by the time that window closed — and never more than
   it held, since a `--size` wider than the stored window reaches runs from before it, which are the
   `ahead` of them. */
const sharedRuns = (recent, reading) => {
  const ended = recent.filter((run) => run.endedAt <= reading.now.profile.to).length;
  const shared = Math.min(ended, reading.now.runs);
  return { shared, ahead: ended - shared };
};

const overlapIn = (recent, reading, size) => {
  const { shared, ahead } = sharedRuns(recent, reading);
  return overlapOf(shared, recent.length, size, ahead);
};

/** Why a first reading is no comparison: nothing was measured ahead of its window. */
export const NO_WINDOW_BEFORE = "there is no window before it";

/** Whether the reading is a comparison, and each way it falls short — docs/cli/stats-the-eval.md. */
const comparabilityOf = ({ size, now, before, reach }) => {
  const short = [];
  if (now.runs < size) short.push(`the recent window holds ${now.runs} of ${size}`);
  if (!before) short.push(NO_WINDOW_BEFORE);
  else if (before.runs < size) short.push(`the window before it holds ${before.runs} of ${size}`);
  return { comparable: !short.length, short, reach };
};

/** The comparison, every cost figure of it one `profileOf` computes over a window or a group. With a
 *  stored reading, its recent window stands where the earlier one would, through the same lines; a
 *  reading held before the outcome figures existed carries none, which is not the same as zeroes. */
export const evalRuns = (runs, copies, size = WINDOW, against = null, read = null, reach = null,
  declared = null, act = null) => {
  const { now, before } = twoWindows(versioned(byEnd(runs), copies), size);
  const nowHeld = windowOf(now, read, declared, act);
  const beforeHeld = against ? against.now : before.length ? windowOf(before, read, declared, act) : null;
  return comparedWindows({
    size,
    total: runs.length,
    against,
    overlap: against ? overlapIn(now, against, size) : undefined,
    now: nowHeld,
    before: beforeHeld,
    comparability: comparabilityOf({ size, now: nowHeld, before: beforeHeld, reach }),
    moved: beforeHeld
      ? { rungs: movedIn(nowHeld.profile.rungs, beforeHeld.profile.rungs, "rung"),
        phases: movedIn(nowHeld.profile.phases, beforeHeld.profile.phases, "name") }
      : null,
    classes: classesCompared(nowHeld.profile, beforeHeld?.profile ?? null),
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

/* A held reading written before the split carries none, and says only the total it had. */
const unpairedWhy = (by) => {
  const parts = [
    by?.unnamed ? `${by.unnamed} naming no run` : null,
    by?.unmatched ? `${by.unmatched} whose run no single entry answered` : null,
  ].filter(Boolean);
  return parts.length ? `: ${parts.join(", ")}` : "";
};

const notesOn = (figure) => [
  figure?.later ? `${figure.later} later than the horizon, counted apart` : null,
  figure?.unattributed ? `${figure.unattributed} park(s) no owner's call answers for` : null,
  figure?.unpaired ? `${figure.unpaired} ruling call(s) unpaired${unpairedWhy(figure.unpairedBy)}` : null,
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
    "  the recent side of this comparison is the corpus's last runs by end time, not the runs that "
      + `began after ${release.version} landed — for that population, \`forge stats change ${release.version}\``,
    `  ${after} release(s) landed after it inside this window`,
    `  ${held.now.spanned} run(s) saw a release land while they ran, so their later calls used the newer copy`,
    "  a dispatching session may still have held a role, a skill stub or a hook registration from an "
      + "older copy, which no install moves until it restarts"];
};

/** Whether the anchor a screen was taken at is a release's reading, asked of one object by every line
 *  that names it: two points stated for one reading leave the reader nothing to tell which of them
 *  the figures came from. */
const releaseIn = (anchor) => (anchor?.kind === RELEASES ? anchor : null);

/* The verdict the window lines never carried — docs/cli/stats-the-eval.md. */
const judgedLines = (held) => {
  const said = held.comparability;
  if (said.comparable) return [];
  return [
    `not a comparison: ${said.short.join(", and ")}, over a corpus holding ${held.total} run(s) in all.`,
    ...(said.reach ? [`  ${reachSaid(said.reach, held.sources ?? [])}.`] : []),
  ];
};

const windowLines = (held, anchor) => {
  const full = held.now.runs < held.size ? `  — ${held.size} is a full window and the corpus holds no more` : "";
  const first = `the last ${held.now.runs} issue-flow run(s)  ${span(held.now)}${full}`;
  if (!held.before) return [first, `no window before them: the corpus holds ${held.total} run(s) in all.`];
  const release = releaseIn(anchor);
  if (release) {
    return [first, `the ${held.before.runs} held at release ${release.version}  ${span(held.before)}`
      + overlapSaid(held.overlap, RUN_TERMS)];
  }
  if (anchor) return [first, heldAtMark(held.before.runs, held.against, span(held.before), held.overlap, RUN_TERMS)];
  const short = held.size - held.before.runs;
  return [
    first,
    `the ${held.before.runs} before them  ${span(held.before)}${short > 0 ? `  — short of a full ${held.size} by ${short}` : ""}`,
  ];
};

const head = (held, anchor) => [...windowLines(held, anchor), ...judgedLines(held)];

/** `anchor` is the stored reading this comparison's before window came from, or null where it slid:
 *  one argument and not one per line, so no line is handed a point another line did not read. */
export const evalLines = (held, anchor = null, copies = [], angles = []) => {
  const release = releaseIn(anchor);
  const lines = head(held, anchor);
  const judged = angles.length ? anglesSaid(angles) : [];
  if (!held.before) return [...lines, ...judged, ...latencyLines(held)];
  return [
    ...lines,
    "",
    figureLine("now", held.now),
    figureLine("before", held.before),
    ...judged,
    "",
    ...groupLines(held),
    ...latencyLines(held),
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

/** The tracker read both windows share, taken once for the union of their pairs and keyed so each
 *  window folds it alone; the ruling pairing's own scope is `outcomes.mjs`'s. */
export const outcomeReadFor = async (corpusRuns, owners, directory, { horizon, most }) => {
  const wanted = [...new Set(owners.flatMap((run) => run.issues))];
  const { spent, bound } = budgetOf(most);
  const aimed = scopeFor(directory);
  if (aimed) useProject(aimed);
  const { threads, documents, complexities } = await readThreads(wanted, bound);
  return {
    threads,
    documents,
    complexities,
    ruled: ruledOver(corpusRuns, logEntries()),
    parks: parkedOver(corpusRuns, threads, documents),
    horizon,
    now: Date.now(),
    spent,
  };
};

const outcomeRead = async (corpus, directory, size, spending) => {
  const { now, before } = twoWindows(byEnd(corpus.runs), size);
  return outcomeReadFor(corpus.runs, [...now, ...before], directory, spending);
};

/** The object `--json` prints, and the record the ship writes: one assembly, so a stored reading is
 *  what the verb would have computed at that moment. */
const readingOf = (directory, corpus, size, against = null, read = null) => {
  const compared = evalRuns(corpus.runs, corpus.copies, size, against, read,
    reachOf(corpus.scope, corpus.runs[0]?.startedAt), corpus.declared, corpus.act);
  return {
    root: corpus.root,
    scope: corpus.scope,
    sources: corpus.sources,
    project: directory,
    device: deviceOf(),
    contract: contractOf(compared.now?.profile),
    skipped: corpus.skipped,
    unreadable: corpus.unreadable,
    copies: corpus.copies.length,
    served: servedCopies(corpus.copies, corpus.runs),
    populations: POPULATIONS,
    ...(read ? { requests: read.spent.requests } : {}),
    ...compared,
  };
};

/* What of a reading is written down is `withoutDead` in the store's own write, which is where a
   writer cannot forget it: the live object here keeps every field, the screen and the angles and
   `--json` all reading its `before` window and its `classes` table off it (ISS-2106). */

const WRITES = "one is written when this project's corpus reaches a multiple of fifty runs, by this verb or by a release";
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
/* The crossing this corpus stands at, or null where a reading already covers it. It is the highest
   multiple at or below the count, judged against the last reading held for the project rather than
   against the count at one moment: an equality test took five of this corpus's twelve crossings,
   because a count only lands exactly on a multiple when a run happens to end there (ISS-1984). */
const crossingAt = (scope, many, size) => {
  const at = Math.floor(many / size) * size;
  if (at < size) return null;
  const last = marksOf(RUNS, scope).at(-1)?.mark ?? 0;
  return at > last ? at : null;
};

export const runsMark = async (directory, size = WINDOW, held = null) => {
  const corpus = held ?? await corpusOf(directory);
  const crossed = crossingAt(corpus.scope, corpus.runs.length, size);
  if (crossed === null) return null;
  const said = `stats: ${crossed} issue-flow runs in this project's corpus — \`forge stats eval\`.`;
  const wrote = writeMark({ kind: RUNS, mark: crossed, at: new Date().toISOString(),
    ...readingOf(directory, corpus, size) });
  const ahead = { count: Math.min(size, corpus.runs.length), size, terms: RUN_TERMS };
  return `${said} ${wroteSaid(wrote, crossed, "forge stats eval", ahead)}`;
};

/** The mark a release writes, whatever the corpus count: the version, the head and the issue keys it
 *  landed are what a run cannot work out later, and `--since-release` and `stats change` are what read
 *  them back. The keys are what makes a change resolvable to the copy that carried it, and what tells
 *  a reading that one release landed several changes. Silent unless the corpus holds a run, since a
 *  reading of nothing pins nothing. */
export const releaseMark = async (directory, { version, head, issues = [] }, size = WINDOW) => {
  if (!version) return null;
  const corpus = await corpusOf(directory);
  if (!corpus.runs.length) return null;
  const wrote = writeMark({
    kind: RELEASES, mark: corpus.runs.length, version, head: head ?? null,
    issues: [...issues].map((one) => String(one).toUpperCase()),
    at: new Date().toISOString(), ...readingOf(directory, corpus, size),
  });
  const ahead = { count: Math.min(size, corpus.runs.length), size, terms: RUN_TERMS };
  return `stats: this release is held as ${version} over ${corpus.runs.length} run(s). ${releaseSaid(wrote, version, ahead)}`;
};

/* What the anchor resolvers need of the recent window, and how this verb names a reading and asks for
   it — `asked` being the checkout and size this call was given, so a command a refusal names reads the
   corpus and the window the refused one did. */
const recentOf = (corpus, size, asked, nameOf, flagOf) => {
  const { now } = twoWindows(byEnd(corpus.runs), size);
  return {
    sharedWith: (reading) => sharedRuns(now, reading),
    rows: now.length,
    size,
    terms: RUN_TERMS,
    nameOf,
    askOf: (one) => `forge stats eval${asked} ${flagOf(one)}`,
    slide: `forge stats eval${asked}`,
  };
};

export const flagsAsked = (checkout, size) =>
  (checkout === undefined ? "" : ` --checkout ${typedBack(checkout)}`) + (size === undefined ? "" : ` --size ${size}`);

export const printEval = async (argv) => {
  if (argv.includes("--waves")) return printWavesEval(argv.filter((one) => one !== "--waves"));
  const { against, rest: left } = againstIn(argv, "stats eval");
  const { release, rest } = sinceReleaseIn(left);
  if (against !== undefined && release !== undefined) oneAnchorOnly(against, release);
  const { checkout, size, horizon, requests, angles, json } = flags(rest, "stats eval", ["--json"], { usage: EVAL_USAGE });
  const window = sized(size);
  /* Refused before a transcript is opened: a name this CLI does not hold costs nobody a corpus read. */
  const names = anglesAsked(angles);
  const asked = { horizon: horizonOf(horizon), most: spend(requests) };
  const directory = checkoutFrom(checkout, "stats eval");
  const asAsked = flagsAsked(checkout, size);
  const corpus = await corpusOf(directory);
  /* The reading asked for is resolved before the corpus is judged: a mark nobody wrote is refused by
     name whatever the corpus holds, rather than answered with the empty corpus's sentence. */
  const stored = against === undefined ? null
    : resolveAgainst(RUNS, against, { scope: corpus.scope, verb: "stats eval", list: "forge stats marks", writes: WRITES,
      recent: recentOf(corpus, window, asAsked, (one) => `mark ${one.mark}`, (one) => `--against ${one.mark}`) });
  const since = release === undefined ? null
    : resolveRelease(corpus.scope, release, { verb: "stats eval", list: "forge stats marks", writes: RELEASE_WRITES,
      recent: recentOf(corpus, window, asAsked, (one) => `release ${one.version}`, (one) => `--since-release ${one.version}`) });
  if (!corpus.runs.length) {
    return console.log(`No issue-flow run under ${corpus.root}, so there is nothing to compare. `
      + `${readingAside(corpus)}.${derivedFrom(directory)}`);
  }
  const read = await outcomeRead(corpus, directory, window, asked);
  const anchor = readBack(stored ?? since ?? null);
  const held = readingOf(directory, corpus, window, anchor, read);
  /* Beside the reading and never inside it: `readingOf` is the one assembly both mark writers spread
     into `writeMark`, so an angle folded there would be stored in every record and its floor spent
     during a ship. */
  const judged = anglesOver({ ordered: byEnd(corpus.runs), held, names, runFloor: FLOOR });
  /* Beside `angles` and outside `held`: the statement is one claim about the whole set rather than a
     field of each angle, and `held` is what both mark writers store — a key added there would be
     carried in every reading a ship holds, which is the boundary the line above keeps. */
  /* Here and not at a release step alone, which a project adopting this plugin never reaches
     (ISS-1984); above the JSON return, a machine reading this verb crossing the same windows a
     person does; and at the canonical window, so what `--size` asks to see cannot decide what is
     written down. The line it returns is printed on the screen path alone. */
  const mark = await runsMark(directory, WINDOW, corpus);
  if (json) return console.log(JSON.stringify({ ...held, angles: judged, notMeasured: NOT_MEASURED }, null, 2));
  for (const line of evalLines(held, anchor, corpus.copies, judged)) console.log(line);
  if (mark) console.log(`\n${mark}`);
  return null;
};

/** `forge stats marks` — the readings held for the project, newest first. */
export const printMarks = (rest) => {
  const { checkout } = flags(rest, "stats marks", [], { usage: MARKS_USAGE });
  const directory = checkoutFrom(checkout, "stats marks");
  const counts = marksOf(RUNS, scopeOf(directory));
  const releases = marksOf(RELEASES, scopeOf(directory));
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
