/* `forge stats runs` — where an issue-flow run's time and rounds go, rerun rather than rewritten.
   Two profiles of this corpus were written by hand as throwaway scripts, which is a measurement
   taken once. What each figure means, and what it deliberately does not: docs/cli/stats.md. */
import {
  DEPLOY,
  EDIT_ROUTES,
  FORGE_ROW,
  GUIDE_INDEX,
  POLL,
  READY_CLASS,
  WAIT,
  WHOLE_SET_CLASS,
  classesFor,
  guidePartOf,
  guideFlowOf,
  helpReadOf,
} from "./corpus/classes.mjs";
import { declaredIn, declaredSaid } from "./corpus/declared.mjs";
import { TABLE } from "./corpus/generations.mjs";
import { actLines, phase7For } from "./corpus/release.mjs";
import { FLOW_BRIEF, LANDING, PRICES, callsIn, markerOf, modelRun, rungRun } from "./corpus/transcripts.mjs";
import { corpusUnder, readTranscript, rootFor } from "./corpus/corpus.mjs";
import {
  conditionLines, countIn, declareLines, foldPhases, helpLine, helpOver, listing, perRung,
  phaseLines, readHeader, readRow, rungLines, shipLine, tokenLines, unrecognisedIn,
} from "./tables.mjs";
import { add, medianOrZero, minutes, share, stamp } from "./figures.mjs";
import { reachOf, reachSaid } from "./marks/reach.mjs";
import { scopeOf } from "./marks/marks.mjs";
import { claimedIn, parkWritersIn, rulingsIn } from "./joined.mjs";
import { refusalIn } from "./corpus/refusals.mjs";
import { PHASES } from "../guides/phases.mjs";
import { FORMS, READ_AS } from "../resolve/handler.mjs";
import { fail } from "../resolve/settings.mjs";
import { canonical } from "../resolve/canonical.mjs";
import { checkoutAt } from "../git/checkout-at.mjs";
import { flags } from "../resolve/flags.mjs";
import { durationOf } from "./window/duration.mjs";

const REPEATED = 3;
const LONG_WAIT_MINUTES = 10;

export const RUNS_USAGE = [
  "Usage: forge stats runs [--since 3d] [--checkout <dir>] [--json]",
  "Where an issue-flow run's time and rounds go, read off the transcripts the harness keeps for a",
  "checkout. Nothing is written, and the tracker is asked only for this project's release model,",
  "which decides what its Phase 7 act is; no issue is read, because this measures the flow and not",
  "the backlog. A transcript with no issue-flow marker in it is skipped and counted as skipped.",
  "",
  "  --since 3d     the window, in d, h or m; the whole corpus unless you say otherwise",
  "  --checkout <dir>  an absolute directory, whose transcript root is derived from its path;",
  "                 the checkout the working directory belongs to unless you say otherwise, so a",
  "                 run from a worktree reads the checkout it was cut from",
  "  --json         the whole table rather than the top rows, for a diff between two weeks",
].join("\n");

/* 143 is the shell's own answer to a killed command; the words alone appear in a log a run was
   reading, and counting those made a transcript that MENTIONED a timeout into one that hit it. */
const timedOut = (call) => /Exit code 143/u.test(call.body) || (call.error && /timed out/iu.test(call.body));

/* Three claims, output being no provenance: the line printed, it names a pair the handler routes, and the call's class is that form — `transcripts.mjs` deciding what ran, so a heredoc is stripped and a mention is no command position, judged where every class is. */
const FORM_SAID = new RegExp(`^${READ_AS} (?<form>\\S+) as forge (?<verb>\\S+)`, "mu");

const formIn = (call) => {
  const said = FORM_SAID.exec(call.body ?? "")?.groups;
  if (!said || FORMS[said.form]?.verb !== said.verb) return null;
  return call.class === `forge ${said.form}` ? said.form : null;
};

const said = (command) => command.replaceAll(/\s+/gu, " ").trim().slice(0, 160);

/* The phase a call sits in, and the segments the markers cut. A marker already passed cannot pull
   the run backwards; every other rule is the marker row's own, so this holds no phase number and
   renumbering a row in `transcripts.mjs` moves the cut with it. `cursor` is where the run stands
   after the call, which parts from where it is booked only on a row declared `only` (ISS-1913). */
export const segmented = (calls) => {
  const seen = new Set();
  let phase = 0;
  return calls.map((call) => {
    const marker = markerOf(call.class);
    if (marker?.only) return { ...call, phase: marker.phase, cursor: phase };
    if (marker && marker.phase > phase && !seen.has(marker.phase) && phase >= (marker.after ?? 0)) {
      seen.add(marker.phase);
      phase = marker.phase;
    }
    return { ...call, phase, cursor: phase };
  });
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
   anything else is a poll. The comparison is against the last `forge` command, not the last call, so
   a `cat` between the two does not turn one into the other. */
const advanceRuns = (calls) => {
  let after = 0;
  let total = 0;
  let lastForge = null;
  for (const call of calls) {
    if (call.class === "forge advance") {
      total += 1;
      if (lastForge?.startsWith(`${FORGE_ROW}record`)) after += 1;
    }
    if (call.class.startsWith(FORGE_ROW)) lastForge = call.class;
  }
  return { total, after };
};

/* The ship's refusal as it renders when the remote moved under its gate, in the ship's own result or
   in a read of a log file, which the second read of one still is — the promotion to `poll` says the
   turn was wasted, never that the body was. One per run, however often the log was read. */
const REJECTED_PUSH = /stopped at step \d+ \(push to [^)]+\): git push [^\n]*exited \d+\. Rejected means the remote moved/u;
const LOG_READ = /\.log\b/u;
/* Every class a call that read a log can carry: the wait and deploy rows are each carved out of
   others of these, and a line that waits on the ship and tails its log in one call is in it — left
   out, one run's rejected push goes uncounted, which is what this corpus answers 32 for and 31
   without the wait row (ISS-2086, and the deploy row the same way for ISS-1975). */
const READS_A_LOG = new Set(["read", POLL, WAIT, DEPLOY]);
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

/* Where a run first stood in the landing's phase, or -1: the one reader of whether it got there, so
   every way the marker row names counts for every verb reporting it, none holding a narrower list (ISS-1913). */
const landingIn = (calls) => calls.findIndex((call) => call.cursor >= LANDING);

const NOTE = "forge record note";
const NOTE_ORDERS = ["before", "after", "unshipped"];

/* The split the phase table stopped showing once the note row opened no segment: three answers, so a run that wrote one and reached no landing is a reading rather than a gap. The third keeps its key, which `--json` has always printed, and means no landing of any kind. */
const noteOrder = (calls, landing) => {
  const note = calls.findIndex((call) => call.class === NOTE);
  if (note < 0) return null;
  if (landing < 0) return "unshipped";
  return note < landing ? "before" : "after";
};

const editsIn = (calls) => new Map(EDIT_ROUTES.map((route) => {
  const sizes = calls.filter((call) => call.class === route).map((call) => call.size);
  return [route, { calls: sizes.length, sizes }];
}));

export const runFrom = (path, session, text, classes = undefined) => {
  const read = callsIn(text, classes);
  const calls = segmented(read.calls);
  if (!calls.length) return null;
  const landing = landingIn(calls);
  /* The transcript's own bounds rather than the calls', for the reason callsIn states. */
  const startedAt = Math.min(read.firstAt ?? calls[0].at, calls[0].at);
  const endedAt = read.lastAt;
  const byClass = new Map();
  const refusals = new Map();
  const forms = new Map();
  const errors = new Map();
  const repeats = new Map();
  const guideParts = new Map();
  const helpReads = new Map();
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
    if (call.class === "forge guide") add(guideParts, partRead(call));
    /* Off a call this reading classed as one to this CLI, and no other: a declared gate command
       sharing the line takes the class, and a read counted off that call would be a numerator
       standing outside the denominator it is quoted against. */
    const help = call.class.startsWith(FORGE_ROW) ? helpReadOf(call.shell) : null;
    if (help) add(helpReads, help);
    const form = formIn(call);
    if (form) add(forms, form);
    const refusal = refusalIn(call);
    if (refusal) add(refusals, refusal);
    else if (call.error) add(errors, call.class);
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
    rung: rungRun(calls),
    model: modelRun(read.models),
    /* What the API billed this run, counted by the API — the four prices apart, the requests they
       were billed over, and the records that carried no measurement. */
    tokens: read.spent,
    /* `callsIn`'s own three counts, carried onto the run — docs/cli/stats-the-condition.md. */
    compactions: read.compactions,
    apiErrors: read.apiErrors,
    humanPrompts: read.humanPrompts,
    /* What the eval joins a run to its work by; the profile prints neither, so this reads no tracker. */
    issues: claimedIn(calls),
    rulings: rulingsIn(calls),
    parks: parkWritersIn(calls),
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
    /* Both consult classes, summed inside the run: the split is about which phase a call opens,
       and a figure that fell because a class was renamed reads as a run that consulted less. */
    consults: counted("forge codex consult") + counted(WHOLE_SET_CLASS),
    rechecks: counted("forge codex recheck"),
    verdicts: counted("forge record verdict"),
    ships: shipsIn(calls),
    reached: landing >= 0,
    notes: noteOrder(calls, landing),
    edits: editsIn(calls),
    byClass,
    refusals,
    forms,
    errors,
    repeats: new Map([...repeats].filter(([, many]) => many >= REPEATED)),
    guideParts,
    helpReads,
    longest,
    phases: foldPhases(calls, startedAt, endedAt),
  };
};

const flowRun = (path, session, text, classes) => {
  const run = runFrom(path, session, text, classes);
  if (!run) return null;
  /* Either class a claim carries: a run whose only one is the landing checkpoint is a run. */
  return FLOW_BRIEF.test(run.brief) || run.byClass.has("forge claim") || run.byClass.has(READY_CLASS)
    ? run : null;
};

/** Every transcript under the derived root, folded. A file that is not an issue-flow run is
 *  counted rather than dropped: a corpus that shrank because the marker changed reads exactly like
 *  a quiet week. */
export const runsUnder = (root, since, classes = undefined) => {
  const runs = [];
  let skipped = 0;
  let outsideWindow = 0;
  let unreadable = 0;
  const { transcripts, sources } = corpusUnder(root);
  for (const { session, path } of transcripts) {
    const text = readTranscript(path);
    if (text === null) {
      unreadable += 1;
      continue;
    }
    /* Guarded per file: the shape is the host's, and one record it changed must cost this reading
       that transcript rather than the corpus. What it cost is printed rather than swallowed. */
    let run = null;
    try {
      run = flowRun(path, session, text, classes);
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
  return { runs, skipped, outsideWindow, unreadable, sources };
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

/* The key carries the flow a part was rendered for, read off the part's own last line and never off
   this copy's: a call refused or unanswered says so rather than borrow a flow it was not served. */
const partRead = (call) => {
  const part = guidePartOf(call.shell) ?? GUIDE_INDEX;
  const flow = guideFlowOf(call.body);
  return `${part} (${flow ?? "flow unread"})`;
};

/* `again` is runs that read it more than once, not the extra reads: a run that read one text three
   times is one run that had to go back, whatever it did the third time. One fold for both tables of
   a read, so the two columns cannot come to mean different things. */
const mergedReads = (runs, pick) => {
  const merged = new Map();
  for (const run of runs) {
    for (const [key, many] of pick(run)) {
      const was = merged.get(key) ?? { calls: 0, runs: 0, again: 0 };
      merged.set(key, { calls: was.calls + many, runs: was.runs + 1, again: was.again + (many > 1 ? 1 : 0) });
    }
  }
  return [...merged].sort((left, right) => right[1].calls - left[1].calls);
};

/* Over the runs holding a measured request and never over every run handed here: a transcript the
   host wrote no usage into is an absent measurement, not a run that spent nothing, and a run in the
   denominator that cannot be in the numerator understates every price. Numerator and denominator are
   that one population on all three readings — a median over those runs, their own sums, and those
   sums over the requests they were billed over. */
const tokensOver = (runs) => {
  const measured = runs.filter((run) => run.tokens.requests > 0);
  const requests = measured.reduce((sum, run) => sum + run.tokens.requests, 0);
  const summed = (name) => measured.reduce((sum, run) => sum + run.tokens[name], 0);
  const each = (pick) => Object.fromEntries(Object.keys(PRICES).map((name) => [name, pick(name)]));
  return {
    runs: measured.length,
    unmeasuredRuns: runs.length - measured.length,
    requests,
    unmeasured: runs.reduce((sum, run) => sum + run.tokens.unmeasured, 0),
    total: each(summed),
    perRun: each((name) => (measured.length ? medianOrZero(measured.map((run) => run.tokens[name])) : null)),
    perRequest: each((name) => (requests ? summed(name) / requests : null)),
  };
};

/* What `compactSummary`/`apiError`/`isHumanPrompt` in transcripts.mjs count, folded over a window:
   a run's condition apart from its spend, and apart from a call this plugin issued or refused —
   `tables.mjs`'s `conditionLines` prints it and states the reason. `runs.length` is the population
   all three are counted over; where it is empty there is nothing to count and the figure is
   unavailable, never the zero a run with nothing wrong with it would also print —
   docs/cli/stats-the-condition.md. `humanPrompts.named` is every run a real human turn showed up
   inside, by the issue it claimed or its session where it claimed none. */
const conditionOver = (runs) => ({
  compactions: runs.length ? {
    met: runs.reduce((sum, run) => sum + run.compactions, 0),
    runs: runs.filter((run) => run.compactions > 0).length,
  } : { met: null, runs: null },
  apiErrors: runs.length ? runs.reduce((sum, run) => sum + run.apiErrors, 0) : null,
  humanPrompts: runs.length ? {
    met: runs.reduce((sum, run) => sum + run.humanPrompts, 0),
    runs: runs.filter((run) => run.humanPrompts > 0).length,
    named: runs.filter((run) => run.humanPrompts > 0)
      .map((run) => ({ ref: run.issues[0] ?? run.session, prompts: run.humanPrompts })),
  } : { met: null, runs: null, named: [] },
});

export const profileOf = (runs, declared = null, act = null) => {
  const seconds = runs.map((run) => run.seconds);
  const byClass = mergedClasses(runs, (run) => run.byClass);
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
      medianMinutes: minutes(medianOrZero(entered.map((run) => run.phases[at].seconds))),
      totalMinutes: minutes(runs.reduce((sum, run) => sum + run.phases[at].seconds, 0)),
      medianCalls: medianOrZero(entered.map((run) => run.phases[at].calls)),
      byClass: mergedClasses(entered, (run) => run.phases[at].byClass).slice(0, 4),
    };
  });
  const per = (pick) => medianOrZero(runs.map(pick));
  return {
    runs: runs.length,
    /* What classed these calls, in the two halves `MOVED_AT` in classes.mjs accounts for, carried so
       that a stored reading standing as a before window is compared row by row only where both
       halves of it agree with this one's. */
    table: TABLE,
    declares: declaredSaid(declared),
    /* The answer the release model gave and never its own word, for the reason `ACTS` in
       corpus/release.mjs carries. `releaseSaid` holds only what the key cannot — which word this
       CLI did not recognise — and is read beside it rather than compared (ISS-1975). */
    release: act?.key ?? null,
    releaseSaid: act?.said ?? null,
    /* Both bounds over every run and neither off the list's order: this reader is handed a window
       ordered by each run's end, so the first of them is the earliest to finish and not the earliest
       to begin. Read as the start of the span, that bound excluded a run that began before it and
       ended inside it — which is a window's own member, and the one place these bounds are read back
       as a span rather than printed (ISS-1987). */
    from: runs.length ? Math.min(...runs.map((run) => run.startedAt)) : null,
    to: runs.length ? Math.max(...runs.map((run) => run.endedAt)) : null,
    totalMinutes: minutes(whole),
    medianMinutes: minutes(medianOrZero(seconds)),
    longestMinutes: minutes(Math.max(0, ...seconds)),
    waitMinutes: minutes(waited),
    toolMinutes: minutes(toolSeconds),
    modelMinutes: minutes(whole - waited),
    waitShare: share(waited, whole),
    modelShare: share(whole - waited, whole),
    calls: runs.reduce((sum, run) => sum + run.calls, 0),
    medianCalls: per((run) => run.calls),
    tokens: tokensOver(runs),
    condition: conditionOver(runs),
    unanswered: runs.reduce((sum, run) => sum + run.unanswered, 0),
    timeouts: runs.reduce((sum, run) => sum + run.timeouts, 0),
    toFirstClaim: minutes(medianOrZero(runs.map((run) => run.toFirstClaim).filter((one) => one !== null))),
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
      medianChars: medianOrZero(runs.flatMap((run) => run.edits.get(route).sizes)),
    })),
    editCharsPerRun: per((run) => [...run.edits.values()].reduce((sum, one) => sum + one.sizes.reduce((a, b) => a + b, 0), 0)),
    ships: {
      passes: runs.reduce((sum, run) => sum + run.ships.passes, 0),
      perRun: per((run) => run.ships.passes),
      resumed: runs.reduce((sum, run) => sum + run.ships.resumed, 0),
      rejectedRuns: runs.reduce((sum, run) => sum + run.ships.rejected, 0),
    },
    notes: Object.fromEntries(NOTE_ORDERS.map((one) =>
      [one, runs.filter((run) => run.notes === one).length])),
    phases,
    rungs: perRung(runs),
    byClass,
    unrecognised: unrecognisedIn(byClass, declared),
    refusals: mergedCounts(runs, (run) => run.refusals),
    forms: mergedCounts(runs, (run) => run.forms),
    errors: mergedCounts(runs, (run) => run.errors),
    repeats: mergedCounts(runs, (run) => run.repeats),
    guideParts: mergedReads(runs, (run) => run.guideParts),
    helpReads: mergedReads(runs, (run) => run.helpReads),
    help: helpOver(runs, byClass),
    longest: runs.flatMap((run) => run.longest).sort((left, right) => right.minutes - left.minutes),
  };
};

const profileLines = (held, all = false) => [
  ...actLines(held.release, held.releaseSaid),
  `wall            ${held.totalMinutes} min in all, median ${held.medianMinutes}/run, longest ${held.longestMinutes}`,
  `where it went   ${held.waitMinutes} min waiting on a tool (${held.waitShare}), `
    + `${held.modelMinutes} min model (${held.modelShare})`,
  `calls           median ${held.medianCalls}/run, ${held.calls} in all, ${held.unanswered} never answered`,
  helpLine(held),
  ...tokenLines(held.tokens),
  `to first claim  median ${held.toFirstClaim} min`,
  `per run         ${countIn(held, "gate", held.perRun.gate)} gate, ${countIn(held, "test", held.perRun.test)} test, `
    + `${held.perRun.consult} consult, `
    + `${held.perRun.recheck} recheck, ${held.perRun.verdict} verdict, ${held.perRun.advance} advance `
    + `(${held.perRun.advanceAfterRecord} of them after a record)`,
  `edits           per run ${held.edits.map((one) => `${one.route} ${one.perRun}`).join(", ")} · `
    + `median chars/call ${held.edits.map((one) => `${one.route} ${one.medianChars}`).join(", ")}`,
  shipLine(held),
  `notes           ${held.notes.before} posted before the landing, ${held.notes.after} after it, `
    + `${held.notes.unshipped} in a run that never reached it`,
  ...declareLines(held),
  `timeouts        ${held.timeouts}`,
  `other errors    ${held.errors.reduce((sum, [, many]) => sum + many, 0)} non-zero exit(s) refused by no rule of this plugin`
    + `${held.errors.length ? `: ${held.errors.map(([label, many]) => `${label} ${many}`).join(", ")}` : ""}`,
  ...conditionLines(held.condition, held.runs, all),
  ...rungLines(held),
  ...phaseLines(held),
  ...listing(
    `${"tool-seconds by class".padEnd(28)}${"min".padStart(8)}${"share".padStart(7)}${"calls".padStart(7)}`,
    held.byClass,
    ([label, one]) =>
      `${label.padEnd(28)}${minutes(one.wait).toFixed(1).padStart(8)}`
      + `${share(one.wait, held.toolMinutes * 60).padStart(7)}${String(one.calls).padStart(7)}`,
    all,
  ),
  ...listing("refusals this plugin wrote, by the line naming the rule", held.refusals,
    ([line, many]) => `  ${String(many).padStart(4)}  ${line}`, all),
  /* Beside the refusals, the two answering one question together: a form is a word a run reached for and got, a refusal one it reached for and did not. */
  ...listing("handled forms performed, by the word typed", held.forms,
    ([form, many]) => `  ${String(many).padStart(4)}  ${form}`, all),
  ...listing(`commands repeated ${REPEATED}+ times inside one run`, held.repeats,
    ([line, many]) => `  ${String(many).padStart(4)}  ${line.slice(0, 108)}`, all),
  ...listing(readHeader("guide parts read"), held.guideParts, readRow, all),
  ...listing(readHeader("help read, by the verb"), held.helpReads, readRow, all),
  ...listing(`single waits of ${LONG_WAIT_MINUTES} minutes or more`, held.longest,
    (one) => `  ${one.minutes.toFixed(1).padStart(6)} min  ${one.what}`, all),
];

export const windowFrom = (since, verb = "stats runs") => {
  if (since === undefined) return null;
  return Date.now() - durationOf(since, verb, "--since");
};

/** What a reading passed over, in the words both `stats runs` and `stats eval` say it in. A window
 *  the eval has no notion of counts nothing, so the field is absent rather than zero there. */
export const readingAside = ({ skipped, outsideWindow = 0, unreadable = 0 }) =>
  `${skipped} transcript(s) skipped as no issue-flow run`
  + `${outsideWindow ? `, ${outsideWindow} outside the window` : ""}`
  + `${unreadable ? `, ${unreadable} this reading could not parse` : ""}`;

/** Where the roots came from, said once: a reader who sees an empty corpus is looking at paths derived from a directory rather than named, and `--checkout` is the whole of the way out. */
export const derivedFrom = (directory) =>
  `\nThose roots are derived from ${directory}; name the checkout the runs were worked in with --checkout.`;

/** Every place the reading was taken from, with what each held: a reader who finds depth missing cannot act on one root, and the two differ in whether the system sweeps them. */
export const sourceLines = (sources) => sources.map((one) =>
  `${one.path}  ${one.transcripts} transcript(s), ${one.taken} counted here`
  + `${one.temporary ? "  — a temporary filesystem, swept on reboot and between" : ""}`);

/** The checkout the working directory belongs to, which is the one the ship reads its marks against:
 *  a worktree's own path slugs to a root no transcript sits under (ISS-2094). Said on standard error
 *  where it moved, since a figure that moved because the root did is not a figure that moved, and
 *  standard output under `--json` is one document. No checkout at all leaves the directory as it is. */
const standingIn = (verb) => {
  const here = process.cwd();
  const repository = checkoutAt(here)?.repository ?? null;
  if (repository === null || repository === canonical(here)) return here;
  console.error(`${verb}: reading the checkout ${repository}, which the working directory ${here} `
    + "belongs to; --checkout names another.");
  return repository;
};

export const checkoutFrom = (given, verb) => {
  if (given === undefined) return standingIn(verb);
  if (!given.startsWith("/")) {
    fail(`${verb}: --checkout takes an absolute directory, not \`${given}\`. `
      + "The transcript root is derived from that path; no transcript is opened by name.");
  }
  return given.replace(/\/+$/u, "") || "/";
};

export const printRuns = async (rest) => {
  /* `--sincee 1d` profiled the whole corpus and said nothing before the parser read this text: a
     filter silently dropped is a measurement that is materially false. */
  const { since, checkout, json } = flags(rest, "stats runs", ["--json"], { usage: RUNS_USAGE });
  const from = windowFrom(since);
  const directory = checkoutFrom(checkout, "stats runs");
  const root = rootFor(directory);
  const declared = declaredIn(directory);
  const act = await phase7For(directory);
  const { runs, skipped, outsideWindow, unreadable, sources } = runsUnder(root, from, classesFor(declared, act));
  const aside = readingAside({ skipped, outsideWindow, unreadable });
  const held = profileOf(runs, declared, act);
  const reach = since === undefined ? reachOf(scopeOf(directory), held.from) : null;
  if (json) {
    return console.log(JSON.stringify(
      { root, sources, project: directory, skipped, outsideWindow, unreadable, ...(reach ? { reach } : {}), ...held },
      null, 2));
  }
  if (!runs.length) {
    return console.log(`No issue-flow run for this project${since ? ` in the last ${since}` : ""}. ${aside}.\n`
      + `${sourceLines(sources).join("\n")}`
      + derivedFrom(directory));
  }
  console.log(`${held.runs} issue-flow run(s)${since ? ` in the last ${since}` : ""}, `
    + `${stamp(held.from)} to ${stamp(held.to)}`);
  console.log(`${sourceLines(sources).join("\n")}\n${aside}`
    + `${reach ? `\n${reachSaid(reach, sources)}` : ""}\n`);
  for (const line of profileLines(held)) console.log(line);
  return null;
};
