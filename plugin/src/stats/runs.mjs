/* `forge stats runs` — where an issue-flow run's time and rounds go, rerun rather than rewritten.
   Two profiles of this corpus were written by hand as throwaway scripts, which is a measurement
   taken once. What each figure means, and what it deliberately does not: docs/cli/stats.md. */
import { join } from "node:path";

import {
  FLOW_BRIEF,
  PHASES,
  callsIn,
  markerOf,
  readTranscript,
  slugFor,
  transcriptBase,
  transcriptsUnder,
} from "./transcripts.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { unknownFlag } from "../suggest.mjs";

const ROWS = 10;
const REPEATED = 3;
const LONG_WAIT_MINUTES = 10;
const WINDOW = /^(?<many>\d+)(?<unit>[dhm])$/u;
const UNITS = { d: 86_400_000, h: 3_600_000, m: 60_000 };

export const USAGE = [
  "Usage: forge stats runs [--since 3d] [--project <dir>] [--json]",
  "Where an issue-flow run's time and rounds go, read off the transcripts the harness keeps for a",
  "project. Nothing is written and nothing the tracker holds is read: this measures the flow, not",
  "the backlog. A transcript with no issue-flow marker in it is skipped and counted as skipped.",
  "",
  "  --since 3d     the window, in d, h or m; the whole corpus unless you say otherwise",
  "  --project <dir>  an absolute project directory, whose transcript root is derived from its path;",
  "                 the working directory unless you say otherwise, so a run from a worktree names",
  "                 the checkout the runs were worked in",
  "  --json         the whole table rather than the top rows, for a diff between two weeks",
].join("\n");

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const minutes = (seconds) => Math.round((seconds / 60) * 10) / 10;
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const add = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);
const stamp = (at) => new Date(at).toISOString().slice(0, 16).replace("T", " ");

const REFUSED = /\brefused\b|^Hold —|Exit code [1-9]/mu;
/* 143 is the shell's own answer to a killed command; the words alone appear in a log a run was
   reading, and counting those made a transcript that MENTIONED a timeout into one that hit it. */
const timedOut = (call) => /Exit code 143/u.test(call.body) || (call.error && /timed out/iu.test(call.body));

const firstLineOf = (body) => {
  const line = body.trim().split("\n")[0] ?? "";
  return (line.slice(0, 110) || "(empty)").replaceAll(/ISS-\d+/gu, "ISS-nn").replaceAll(/[0-9a-f]{7,}/gu, "<sha>");
};

const said = (command) => command.replaceAll(/\s+/gu, " ").trim().slice(0, 160);

/* The phase a call sits in, and the segments the markers cut. A marker already passed cannot pull
   the run backwards, and the ship call is the last of its phase rather than the first of the next. */
const segmented = (calls) => {
  const seen = new Set();
  let phase = 0;
  return calls.map((call) => {
    const marker = markerOf(call.class);
    if (marker && marker > phase && !seen.has(marker)) {
      seen.add(marker);
      phase = marker;
    }
    const held = phase;
    if (call.class === "ship" && phase === 5) phase = 6;
    return { ...call, phase: held };
  });
};

const emptyPhase = () => PHASES.map(() => ({ seconds: 0, calls: 0, byClass: new Map() }));

const foldPhases = (calls, startedAt) => {
  const phases = emptyPhase();
  let last = startedAt;
  for (const call of calls) {
    const held = phases[call.phase];
    held.calls += 1;
    held.seconds += Math.max(0, call.endedAt - last) / 1000;
    const was = held.byClass.get(call.class) ?? { calls: 0, wait: 0 };
    held.byClass.set(call.class, { calls: was.calls + 1, wait: was.wait + call.wait });
    last = Math.max(last, call.endedAt);
  }
  return phases;
};

/* Waits overlap: the host issues several calls in one turn and they run at once, so their durations
   summed exceed the wall clock they shared and would report more waiting than the run took. The
   union is what the wall time is split by; a class's own row stays a sum of its calls, which is
   tool-seconds and says so. */
export const unionSeconds = (spans) => {
  const sorted = [...spans].sort((left, right) => left.at - right.at);
  let total = 0;
  let openedAt = null;
  let closesAt = null;
  for (const span of sorted) {
    if (closesAt === null || span.at > closesAt) {
      total += closesAt === null ? 0 : closesAt - openedAt;
      openedAt = span.at;
      closesAt = span.endedAt;
    } else closesAt = Math.max(closesAt, span.endedAt);
  }
  return (closesAt === null ? total : total + closesAt - openedAt) / 1000;
};

/* An advance that follows a record is the flow working as the contract describes; one that follows
   anything else is a poll. The comparison is against the last forge call, not the last call, so a
   `cat` between the two does not turn one into the other. */
const advanceRuns = (calls) => {
  let after = 0;
  let total = 0;
  let lastForge = null;
  for (const call of calls) {
    if (call.class === "forge advance") {
      total += 1;
      if (lastForge?.startsWith("forge record")) after += 1;
    }
    if (call.class.startsWith("forge ")) lastForge = call.class;
  }
  return { total, after };
};

export const runFrom = (path, session, text) => {
  const read = callsIn(text);
  const calls = segmented(read.calls);
  if (!calls.length) return null;
  /* The transcript's own bounds rather than the calls', for the reason callsIn states. */
  const startedAt = Math.min(read.firstAt ?? calls[0].at, calls[0].at);
  const endedAt = read.lastAt;
  const byClass = new Map();
  const refusals = new Map();
  const repeats = new Map();
  const longest = [];
  let toolSeconds = 0;
  let timeouts = 0;
  let unanswered = 0;
  for (const call of calls) {
    toolSeconds += call.wait;
    const was = byClass.get(call.class) ?? { calls: 0, wait: 0 };
    byClass.set(call.class, { calls: was.calls + 1, wait: was.wait + call.wait });
    if (!call.answered) unanswered += 1;
    if (call.name === "Bash") add(repeats, said(call.command));
    if (call.error || REFUSED.test(call.body)) add(refusals, firstLineOf(call.body));
    if (timedOut(call)) timeouts += 1;
    if (call.wait >= LONG_WAIT_MINUTES * 60) {
      longest.push({ minutes: minutes(call.wait), what: said(call.command || call.name).slice(0, 110) });
    }
  }
  const claim = calls.find((call) => call.class === "forge claim");
  const counted = (label) => byClass.get(label)?.calls ?? 0;
  return {
    path,
    session,
    startedAt,
    endedAt,
    brief: read.brief,
    calls: calls.length,
    seconds: (endedAt - startedAt) / 1000,
    waited: unionSeconds(calls),
    toolSeconds,
    unanswered,
    timeouts,
    toFirstClaim: claim ? (claim.at - startedAt) / 1000 : null,
    advance: advanceRuns(calls),
    gates: counted("gate"),
    tests: counted("test"),
    consults: counted("forge codex consult"),
    rechecks: counted("forge codex recheck"),
    verdicts: counted("forge record verdict"),
    byClass,
    refusals,
    repeats: new Map([...repeats].filter(([, many]) => many >= REPEATED)),
    longest,
    phases: foldPhases(calls, startedAt),
  };
};

/* Its brief said so, or it took an issue's lease — the two the marker means, transcripts.mjs. */
const flowRun = (path, session, text) => {
  const run = runFrom(path, session, text);
  if (!run) return null;
  return FLOW_BRIEF.test(run.brief) || run.byClass.has("forge claim") ? run : null;
};

/** Every transcript under the derived root, folded. A file that is not an issue-flow run is
 *  counted rather than dropped: a corpus that shrank because the marker changed reads exactly like
 *  a quiet week. */
export const runsUnder = (root, since) => {
  const runs = [];
  let skipped = 0;
  let outsideWindow = 0;
  let unreadable = 0;
  for (const { session, path } of transcriptsUnder(root)) {
    const text = readTranscript(path);
    if (text === null) {
      unreadable += 1;
      continue;
    }
    /* Guarded per file: the shape is the host's, and one record it changed must cost this reading
       that transcript rather than the corpus. What it cost is printed rather than swallowed. */
    let run = null;
    try {
      run = flowRun(path, session, text);
    } catch {
      unreadable += 1;
      continue;
    }
    if (!run) {
      skipped += 1;
      continue;
    }
    /* The run's own last timestamp, never the file's mtime: the entries are symlinks, so an mtime
       is when the link was made and a rerun would not agree with itself. */
    if (since && run.endedAt < since) {
      outsideWindow += 1;
      continue;
    }
    runs.push(run);
  }
  runs.sort((left, right) => left.startedAt - right.startedAt);
  return { runs, skipped, outsideWindow, unreadable };
};

const mergedClasses = (runs, pick) => {
  const merged = new Map();
  for (const run of runs) {
    for (const [label, held] of pick(run)) {
      const was = merged.get(label) ?? { calls: 0, wait: 0 };
      merged.set(label, { calls: was.calls + held.calls, wait: was.wait + held.wait });
    }
  }
  return [...merged].sort((left, right) => right[1].wait - left[1].wait);
};

const mergedCounts = (runs, pick) => {
  const merged = new Map();
  for (const run of runs) for (const [key, many] of pick(run)) add(merged, key, many);
  return [...merged].sort((left, right) => right[1] - left[1]);
};

export const profileOf = (runs) => {
  const seconds = runs.map((run) => run.seconds);
  const waited = runs.reduce((sum, run) => sum + run.waited, 0);
  const toolSeconds = runs.reduce((sum, run) => sum + run.toolSeconds, 0);
  const whole = runs.reduce((sum, run) => sum + run.seconds, 0);
  /* Over the runs that ENTERED the phase, and the count of them beside it. A median over all runs
     reports a phase most of a window never reached as costing nothing, which is the opposite of
     what it costs the runs that do reach it. */
  const phases = PHASES.map((name, at) => {
    const entered = runs.filter((run) => run.phases[at].calls > 0);
    return {
      name,
      runs: entered.length,
      medianMinutes: minutes(median(entered.map((run) => run.phases[at].seconds))),
      totalMinutes: minutes(runs.reduce((sum, run) => sum + run.phases[at].seconds, 0)),
      medianCalls: median(entered.map((run) => run.phases[at].calls)),
      byClass: mergedClasses(entered, (run) => run.phases[at].byClass).slice(0, 4),
    };
  });
  const per = (pick) => median(runs.map(pick));
  return {
    runs: runs.length,
    from: runs.length ? runs[0].startedAt : null,
    to: runs.length ? Math.max(...runs.map((run) => run.endedAt)) : null,
    totalMinutes: minutes(whole),
    medianMinutes: minutes(median(seconds)),
    longestMinutes: minutes(Math.max(0, ...seconds)),
    waitMinutes: minutes(waited),
    toolMinutes: minutes(toolSeconds),
    modelMinutes: minutes(whole - waited),
    waitShare: share(waited, whole),
    modelShare: share(whole - waited, whole),
    calls: runs.reduce((sum, run) => sum + run.calls, 0),
    medianCalls: per((run) => run.calls),
    unanswered: runs.reduce((sum, run) => sum + run.unanswered, 0),
    timeouts: runs.reduce((sum, run) => sum + run.timeouts, 0),
    toFirstClaim: minutes(median(runs.map((run) => run.toFirstClaim).filter((one) => one !== null))),
    perRun: {
      gate: per((run) => run.gates),
      test: per((run) => run.tests),
      consult: per((run) => run.consults),
      recheck: per((run) => run.rechecks),
      verdict: per((run) => run.verdicts),
      advance: per((run) => run.advance.total),
      advanceAfterRecord: per((run) => run.advance.after),
    },
    phases,
    byClass: mergedClasses(runs, (run) => run.byClass),
    refusals: mergedCounts(runs, (run) => run.refusals),
    repeats: mergedCounts(runs, (run) => run.repeats),
    longest: runs.flatMap((run) => run.longest).sort((left, right) => right.minutes - left.minutes),
  };
};

const capped = (rows, all) => (all ? rows : rows.slice(0, ROWS));
const elided = (rows, all) =>
  (!all && rows.length > ROWS ? [`  (${rows.length - ROWS} more; --json for all)`] : []);

const listing = (title, rows, line, all) =>
  (rows.length ? ["", title, ...capped(rows, all).map(line), ...elided(rows, all)] : []);

const phaseLines = (held) => [
  "",
  `${"phase".padEnd(12)}${"runs".padStart(5)}${"min med".padStart(9)}${"min sum".padStart(9)}`
  + `${"calls med".padStart(11)}  what fills it (calls, wait)`,
  ...held.phases.map((phase) =>
    `${phase.name.padEnd(12)}${String(phase.runs).padStart(5)}${phase.medianMinutes.toFixed(1).padStart(9)}`
    + `${phase.totalMinutes.toFixed(0).padStart(9)}${phase.medianCalls.toFixed(1).padStart(11)}  `
    + phase.byClass.map(([label, one]) => `${label} ${one.calls} ${minutes(one.wait).toFixed(0)}m`).join(" · ")),
];

export const profileLines = (held, all = false) => [
  `wall            ${held.totalMinutes} min in all, median ${held.medianMinutes}/run, longest ${held.longestMinutes}`,
  `where it went   ${held.waitMinutes} min waiting on a tool (${held.waitShare}), `
    + `${held.modelMinutes} min model (${held.modelShare})`,
  `calls           median ${held.medianCalls}/run, ${held.calls} in all, ${held.unanswered} never answered`,
  `to first claim  median ${held.toFirstClaim} min`,
  `per run         ${held.perRun.gate} gate, ${held.perRun.test} test, ${held.perRun.consult} consult, `
    + `${held.perRun.recheck} recheck, ${held.perRun.verdict} verdict, ${held.perRun.advance} advance `
    + `(${held.perRun.advanceAfterRecord} of them after a record)`,
  `timeouts        ${held.timeouts}`,
  ...phaseLines(held),
  ...listing(
    `${"tool-seconds by class".padEnd(28)}${"min".padStart(8)}${"share".padStart(7)}${"calls".padStart(7)}`,
    held.byClass,
    ([label, one]) =>
      `${label.padEnd(28)}${minutes(one.wait).toFixed(1).padStart(8)}`
      + `${share(one.wait, held.toolMinutes * 60).padStart(7)}${String(one.calls).padStart(7)}`,
    all,
  ),
  ...listing("refusals and errors, by first line", held.refusals,
    ([line, many]) => `  ${String(many).padStart(4)}  ${line}`, all),
  ...listing(`commands repeated ${REPEATED}+ times inside one run`, held.repeats,
    ([line, many]) => `  ${String(many).padStart(4)}  ${line.slice(0, 108)}`, all),
  ...listing(`single waits of ${LONG_WAIT_MINUTES} minutes or more`, held.longest,
    (one) => `  ${one.minutes.toFixed(1).padStart(6)} min  ${one.what}`, all),
];

const windowFrom = (since) => {
  if (since === undefined) return null;
  const asked = WINDOW.exec(since)?.groups;
  if (!asked || Number(asked.many) < 1) {
    fail(`stats runs: --since takes a window like \`3d\`, \`12h\` or \`90m\`, not \`${since}\`.`);
  }
  return Date.now() - Number(asked.many) * UNITS[asked.unit];
};

const projectFrom = (given) => {
  if (given === undefined) return process.cwd();
  if (!given.startsWith("/")) {
    fail(`stats runs: --project takes an absolute project directory, not \`${given}\`. `
      + "The transcript root is derived from that path; no transcript is opened by name.");
  }
  return given.replace(/\/+$/u, "") || "/";
};

export const printRuns = (rest) => {
  /* The generic parser keeps any valued flag it is handed, so `--sincee 1d` profiled the whole
     corpus and said nothing: a filter silently dropped is a measurement that is materially false. */
  const wrong = unknownFlag("stats runs", rest, { usage: USAGE });
  if (wrong) fail(wrong);
  const { since, project, json } = flags(rest, "stats runs", ["--json"]);
  const from = windowFrom(since);
  const directory = projectFrom(project);
  const root = join(transcriptBase(), slugFor(directory));
  const { runs, skipped, outsideWindow, unreadable } = runsUnder(root, from);
  const aside = `${skipped} transcript(s) skipped as no issue-flow run`
    + `${outsideWindow ? `, ${outsideWindow} outside the window` : ""}`
    + `${unreadable ? `, ${unreadable} this reading could not parse` : ""}`;
  if (!runs.length) {
    return console.log(`No issue-flow run under ${root}${since ? ` in the last ${since}` : ""}. ${aside}.`
      + `\nThat root is derived from ${directory}; name the checkout the runs were worked in with --project.`);
  }
  const held = profileOf(runs);
  if (json) {
    return console.log(JSON.stringify(
      { root, project: directory, skipped, outsideWindow, unreadable, ...held }, null, 2));
  }
  console.log(`${held.runs} issue-flow run(s)${since ? ` in the last ${since}` : ""}, `
    + `${stamp(held.from)} to ${stamp(held.to)}`);
  console.log(`${root}\n${aside}\n`);
  for (const line of profileLines(held)) console.log(line);
};

const SUBJECTS = { runs: printRuns };

export const stats = (argv) => {
  const [subject, ...rest] = argv;
  /* Both places help can stand on a verb that takes a subject, through the one predicate that
     decides what help is: after the verb, and after the subject. */
  if (wantsHelp(argv) || wantsHelp(rest)) {
    console.log(USAGE);
    process.exit(0);
  }
  if (!subject || !Object.hasOwn(SUBJECTS, subject)) {
    if (subject) console.error(`stats: no subject named ${subject}. There is: runs.\n`);
    console.error(USAGE);
    process.exit(1);
  }
  SUBJECTS[subject](rest);
};

stats.answersHelp = true;
