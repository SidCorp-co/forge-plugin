/* `forge stats runs` — where an issue-flow run's time and rounds go, rerun rather than rewritten.
   Two profiles of this corpus were written by hand as throwaway scripts, which is a measurement
   taken once. What each figure means, and what it deliberately does not: docs/cli/stats.md. */
import {
  FLOW_BRIEF,
  EDIT_ROUTES,
  PHASES,
  POLL,
  UNTIERED,
  callsIn,
  markerOf,
  readTranscript,
  rootFor,
  tierRun,
  transcriptsUnder,
} from "./transcripts.mjs";
import { TIERS } from "../ladder.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags } from "../resolve/flags.mjs";
import { unknownFlag } from "../suggest.mjs";

const ROWS = 10;
const REPEATED = 3;
const LONG_WAIT_MINUTES = 10;
const WINDOW = /^(?<many>\d+)(?<unit>[dhm])$/u;
const UNITS = { d: 86_400_000, h: 3_600_000, m: 60_000 };

export const RUNS_USAGE = [
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
export const stamp = (at) => new Date(at).toISOString().slice(0, 16).replace("T", " ");

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
   the run backwards, the review cannot open before the build has (the plan is consulted before it
   is written, and that consult is the plan's), and the ship call is the last of its phase rather
   than the first of the next. */
const BUILD = 2;
const REVIEW = 3;
const segmented = (calls) => {
  const seen = new Set();
  let phase = 0;
  return calls.map((call) => {
    const marker = markerOf(call.class);
    const early = marker === REVIEW && phase < BUILD;
    if (marker && marker > phase && !seen.has(marker) && !early) {
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

/* The ship's refusal as it renders when the remote moved under its gate, in the ship's own result or
   in a read of a log file, which the second read of one still is — the promotion to `poll` says the
   turn was wasted, never that the body was. One per run, however often the log was read. */
const REJECTED_PUSH = /stopped at step \d+ \(push to [^)]+\): git push [^\n]*exited \d+\. Rejected means the remote moved/u;
const LOG_READ = /\.log\b/u;
const READS_A_LOG = new Set(["read", POLL]);
const reportsShip = (call) =>
  call.class === "ship" || (READS_A_LOG.has(call.class) && LOG_READ.test(call.shell));
const RESUMED = /--from\s+\d/u;

/* The passes a landing took: every ship call, those resumed with --from, and whether a push came
   back rejected. */
const shipsIn = (calls) => {
  const passes = calls.filter((call) => call.class === "ship");
  return {
    passes: passes.length,
    resumed: passes.filter((call) => RESUMED.test(call.shell)).length,
    rejected: calls.some((call) => reportsShip(call) && REJECTED_PUSH.test(call.body)) ? 1 : 0,
  };
};

/* Per route, the calls and what each carried. */
const editsIn = (calls) => new Map(EDIT_ROUTES.map((route) => {
  const sizes = calls.filter((call) => call.class === route).map((call) => call.size);
  return [route, { calls: sizes.length, sizes }];
}));

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
    tier: tierRun(calls),
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
    ships: shipsIn(calls),
    edits: editsIn(calls),
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
    edits: EDIT_ROUTES.map((route) => ({
      route,
      perRun: per((run) => run.edits.get(route).calls),
      medianChars: median(runs.flatMap((run) => run.edits.get(route).sizes)),
    })),
    editCharsPerRun: per((run) => [...run.edits.values()].reduce((sum, one) => sum + one.sizes.reduce((a, b) => a + b, 0), 0)),
    ships: {
      passes: runs.reduce((sum, run) => sum + run.ships.passes, 0),
      perRun: per((run) => run.ships.passes),
      resumed: runs.reduce((sum, run) => sum + run.ships.resumed, 0),
      rejectedRuns: runs.reduce((sum, run) => sum + run.ships.rejected, 0),
    },
    phases,
    tiers: perTier(runs),
    byClass: mergedClasses(runs, (run) => run.byClass),
    refusals: mergedCounts(runs, (run) => run.refusals),
    repeats: mergedCounts(runs, (run) => run.repeats),
    longest: runs.flatMap((run) => run.longest).sort((left, right) => right.minutes - left.minutes),
  };
};

/* One row per tier the ladder has, plus one for the runs that named none: folded into a tier those
   would flatter it, and dropped they would make the rows fail to add up to the corpus. The tiers'
   own order, so the table reads as the ladder and a tier no run reached still has its row saying so
   — a tier absent from a profile is indistinguishable from a tier that costs nothing. */
export const perTier = (runs) => [...TIERS, UNTIERED].map((tier) => {
  const held = runs.filter((run) => run.tier === tier);
  const seconds = held.map((run) => run.seconds);
  return {
    tier,
    runs: held.length,
    medianMinutes: minutes(median(seconds)),
    totalMinutes: minutes(seconds.reduce((sum, one) => sum + one, 0)),
    medianCalls: median(held.map((run) => run.calls)),
    medianConsults: median(held.map((run) => run.consults)),
    medianGates: median(held.map((run) => run.gates)),
  };
});

const TIER_WIDTH = 10;
const tierLines = (held) => [
  "",
  `${"tier".padEnd(TIER_WIDTH)}${"runs".padStart(5)}${"min med".padStart(9)}${"min sum".padStart(9)}`
  + `${"calls med".padStart(11)}${"consults".padStart(10)}${"gates".padStart(7)}`,
  ...held.tiers.map((row) =>
    `${row.tier.padEnd(TIER_WIDTH)}${String(row.runs).padStart(5)}${row.medianMinutes.toFixed(1).padStart(9)}`
    + `${row.totalMinutes.toFixed(0).padStart(9)}${row.medianCalls.toFixed(1).padStart(11)}`
    + `${row.medianConsults.toFixed(1).padStart(10)}${row.medianGates.toFixed(1).padStart(7)}`),
];

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
  `edits           per run ${held.edits.map((one) => `${one.route} ${one.perRun}`).join(", ")} · `
    + `median chars/call ${held.edits.map((one) => `${one.route} ${one.medianChars}`).join(", ")}`,
  `ships           ${held.ships.passes} pass(es), median ${held.ships.perRun}/run, ${held.ships.resumed} resumed with --from, `
    + `a push rejected in ${held.ships.rejectedRuns} run(s)`,
  `timeouts        ${held.timeouts}`,
  ...tierLines(held),
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

/** What a reading passed over, in the words both `stats runs` and `stats eval` say it in. A window
 *  the eval has no notion of counts nothing, so the field is absent rather than zero there. */
export const readingAside = ({ skipped, outsideWindow = 0, unreadable = 0 }) =>
  `${skipped} transcript(s) skipped as no issue-flow run`
  + `${outsideWindow ? `, ${outsideWindow} outside the window` : ""}`
  + `${unreadable ? `, ${unreadable} this reading could not parse` : ""}`;

/** Where the root came from, said once: a reader who sees an empty corpus is looking at a path
 *  derived from a directory rather than named, and `--project` is the whole of the way out. */
export const derivedFrom = (directory) =>
  `\nThat root is derived from ${directory}; name the checkout the runs were worked in with --project.`;

export const projectFrom = (given, verb) => {
  if (given === undefined) return process.cwd();
  if (!given.startsWith("/")) {
    fail(`${verb}: --project takes an absolute project directory, not \`${given}\`. `
      + "The transcript root is derived from that path; no transcript is opened by name.");
  }
  return given.replace(/\/+$/u, "") || "/";
};

export const printRuns = (rest) => {
  /* The generic parser keeps any valued flag it is handed, so `--sincee 1d` profiled the whole
     corpus and said nothing: a filter silently dropped is a measurement that is materially false. */
  const wrong = unknownFlag("stats runs", rest, { usage: RUNS_USAGE });
  if (wrong) fail(wrong);
  const { since, project, json } = flags(rest, "stats runs", ["--json"]);
  const from = windowFrom(since);
  const directory = projectFrom(project, "stats runs");
  const root = rootFor(directory);
  const { runs, skipped, outsideWindow, unreadable } = runsUnder(root, from);
  const aside = readingAside({ skipped, outsideWindow, unreadable });
  if (!runs.length) {
    return console.log(`No issue-flow run under ${root}${since ? ` in the last ${since}` : ""}. ${aside}.`
      + derivedFrom(directory));
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
