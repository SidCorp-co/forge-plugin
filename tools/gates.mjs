#!/usr/bin/env node
/* The gate `npm run check` is. Eleven steps chained with `&&` ran whole or not at all — ninety
   seconds for a docs typo, and seven delegated runs spent eighty-four minutes on 111 of them
   (ISS-117). This runs the steps a change can reach and skips the ones whose inputs have not moved
   since they passed; what it may not do is pass without having covered the change, so every path
   it cannot place widens the run instead of narrowing it. */
import { spawnSync } from "node:child_process";
import { availableParallelism, loadavg } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { crossTree, gitFiles, uncommittedInShared } from "./checkout.mjs";
import { DEADLINE, DEFAULT_MINUTES, gateDecided, gateStarted, GONE, NO_GATE, said, TERMINAL, waitForSlot, waitForVerdict }
  from "./gates/verdict.mjs";
import { CALL_CEILING_SECONDS } from "../plugin/src/host/call-ceiling.mjs";
import { attribute, attributionLines, CASES_ENV } from "./gates/reporters/isolation.mjs";
import { cheapestFirst, ENTRIES_PER_STEP, ledgerFor, LEDGER_UNSEEN, recordPass, secondsFor } from "./gates/ledger.mjs";
import { PUTS_IT_BACK, said as saidMissing, unresolvedIn } from "../plugin/src/resolve/installed.mjs";
import { DECLINED, heldSaid, LANDING_ENV, outputOf, placeFor, runnersOf, SLOT, treeHeldBy, WAIT } from "./gates/machine.mjs";
import { declinedSaid, LANDING_WAIT_ENV, landingAsked, waitAsLanding } from "./gates/landing/wait.mjs";
import { fileRecurrences, reachedBy, recurrencesIn } from "./gates/recurrence.mjs";
import { deadClaim, escapedClaim, escapedStep, ledgerSaid, readsSaid, severalCauses, stepRead, stepSaid,
  wroteSets } from "./gates/report/said.mjs";
import { spendOf } from "./gates/report/spend.mjs";
import { forgetRoomRefusal, ROOM_ENV, roomRefused } from "../plugin/test/fixtures/room.mjs";
import { editsDerivation, mergeBaseDiff, planFor, unclaimedIn } from "./gates/scope.mjs";
import { parallelRuns } from "../plugin/src/resolve/settings.mjs";
import { argvForTests, DECLARED_READS, gateSteps, launcherOf, TEST_FILE, testWorkers } from "./gates/steps.mjs";
import { failedReads } from "./gates/reads/failed.mjs";
import { auditEnv, claimsJudged, contextOf, manifestsIn, readsDir, recordSets, selectTests, setsFrom,
  stepEscapes, stepSetFrom } from "./gates/reads/sets.mjs";
import { ATTRIBUTION_HELP } from "./gates/help/attribution.mjs";
import { READS_HELP } from "./gates/help/reads.mjs";
import { MACHINE_HELP } from "./gates/help/machine.mjs";
import { gateTmp, leakMessage, roomLeft } from "./gates/stamp-room.mjs";
import { alonePath, casesPath, CEILING_PERCENTILE, REVIEW, fileTimesPath, recordDir, recordRun, roomPath,
  runKey, seriesFile } from "./gates/timing.mjs";

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), "..");

const ANYWAY = "--anyway";
const BASELINE = "--baseline";
const KEY = /^ISS-\d+$/u;

const USAGE = `Usage: node tools/gates.mjs [${BASELINE} [ISS-nn]] [--full] [${ANYWAY}] [${WAIT} [${SLOT}] [M]]

Every check this repository gates a change with, stopping at the first failure. It is what
\`npm run check\` runs; each step is still the npm script of its own name, spent by hand.

Runs only the steps the diff can reach, and prints what it skipped and why. The diff is against
the merge-base with the default branch, so committing does not empty it. A changed path no step
claims widens the run to everything rather than guessing, and so does a change to the runner or
its own modules. The root package.json and its lock file reach every step, a dependency being
something any step can break, and every step's digest is keyed on them.

Widening is half of it. A run that cannot place every changed path in a step leaves the record's
digests unread as well, because no step's digest is keyed on a path no step reads, so the widening
would be handed straight back. Three ways it cannot: a path no step claims, no merge base to diff
against, and a listing git refused. Each of those says which it was, spends every step and
records no pass. A diff that succeeded and came back empty is none of them, and keeps the record.

${ATTRIBUTION_HELP}

${READS_HELP}

Past that, a step whose inputs are byte for byte what one of its recorded passes covered is skipped
and says which digest matched. Only passes are recorded, so a red step is red again next time. The
record lives under the common git directory, so a worktree's pass counts for the checkout's re-run
of the same tree, and carries the seconds that step took when it passed.

No digest is trusted at all while a package this project declares does not resolve under
node_modules. A dangling install moves no tracked file and no manifest, so every entry of the record
still matches and the step whose tooling is gone is skipped rather than run — the one break that
stops a gate is the one its record is blind to. The run names the package and what puts it back,
spends every step it planned, and records no pass while it stands.

The record is keyed by the step and the content together, one entry per pair, so a second worktree
gating other content adds an entry beside this tree's instead of replacing it: that is what makes
the sharing survive a wave of runs that disagree about the tree. What bounds the store is stated
where it is enforced — one step keeps its ${ENTRIES_PER_STEP} newest contents, and a pass past that
evicts its oldest, which costs the tree that held it one re-run of that step and no green it should
not have.

Those seconds decide the order the steps are spent in: cheapest first, so a tree that is going to be
rejected is told about its cheapest failure rather than made to wait behind an expensive step, and a
re-run after a fix pays the cheap steps and stops. A step the record holds no seconds for — never
recorded, or recorded before the record kept them — is spent after every step that has them, and the
order this prints says so beside it. Which steps are spent and what each answers are untouched; the
step table stays a hand-written list and nothing is written back into it. --full orders the same way,
spending every step whatever the digests say and reading the seconds beside them for the order alone.

Beside it, one line per green run: the whole run's seconds and how many of the table's steps it
actually spent. Only a run that spent every step measures this gate, which is what --full is for, so
the count is part of the record, and a change is read between two of those runs of the same size and
no others, however many scoped runs sit between them. A scoped figure is printed and named and never
subtracted. This says what it recorded; the release is the one place that prints the change.

Each line also carries the machine's one-minute load and its core count when the run started, as
context and never as proof. The last gate review's own figure stays beside every line as a dated
anchor — ${REVIEW.seconds}s on ${REVIEW.on} (${REVIEW.issue}), said with the load it measured under —
but what a whole run is judged against is this ledger's own population: the ${Math.round(CEILING_PERCENTILE * 100)}th
percentile of the whole runs it already holds on the same table, recorded before this one, and a run
over it is said to be, named with the population it was drawn over and the date. Beside the runs, a test step leaves
<label>-files: one line per test file with the seconds node measured on it, longest first, which is
what the next review reads the suite's growth off.

${LEDGER_UNSEEN}

Every step runs under a temporary directory of this run's own, and a step that leaves the plugin's
hook stamps in it is failed: on a developer's machine that directory is the room every hook reaps
before every stamp, and a suite that fills it is a cost no green can show.

${MACHINE_HELP}

A run in the shared checkout is refused while that checkout holds uncommitted paths: more than one
session stands there, so the result would be about a tree none of them owns. A worktree is never
refused — its uncommitted work is the point of it.

  ${BASELINE} [ISS-nn]  a run's Phase 0 baseline, and the only route to one here. Where a ship
             published a whole-tree result for this clean head it spends no step and prints the
             write that cites it; where none is published it runs the gate as a bare call does,
             record and all, and prints the write to record. A dirty tree is refused. The one wait
             it takes is ${WAIT} ${SLOT} [M], which waits for a place and then measures in the
             same call; ${WAIT} for a verdict is refused beside it
  --full     every step, whatever the diff or the ledger says. It proves a tree independently
             and is never the baseline route: it trusts no record, so a clean head spends all of it
  ${ANYWAY}   gate the shared checkout as it stands, uncommitted paths and all. The run names
             them when it starts and says again at the end that it used this, so a result reached
             this way cannot be mistaken for a clean one.
  ${WAIT} [M]  wait for the verdict of a gate of this tree instead of running one, up to M
             minutes (${DEFAULT_MINUTES} where none is given, which is the most a call can hold:
             one may live ${CALL_CEILING_SECONDS}s, and an M past that is refused), and exit on
             that verdict
  ${WAIT} ${SLOT} [M]  wait for a place at the ceiling this project declares instead of declining for
             want of one, and exit 0 once a gate started then would not be declined

Every exit past the tree it judges prints one line beginning \`${TERMINAL}\` and writes the same line
to a record beside the ledger — the verdict, the steps spent of the table, the head and the pid — so
nothing here has to be grepped for and no run has to invent a token to grep for. ${WAIT} reads that
record and never a log, and never a process's exit code either. It answers a verdict already written
at once, since the common case after a resume is a gate that finished while the run was elsewhere;
waits on a notification for one a running gate has yet to write; and tells apart the three states a
log with no verdict in it cannot. Each of those three has its own exit code, past every code a run of
this gate uses: ${GONE} a gate that exited having written no verdict, which is a failure and not a
pass; ${DEADLINE} this wait's own deadline with the gate still running; ${NO_GATE} no gate of this
tree having ever written one, answered at once rather than waited out. A verdict exits with the
status the gate itself exited with. The line names the pid that wrote it and how long ago, because a
wait attaches to a run it did not start. One further line is written before the wait blocks, naming
the tree and the deadline, so a result carrying that line alone is one where no answer was observed
and a run holding it knows to wait again rather than to go looking. The deadline's own line carries
what the newest whole gates recorded here took, which is what says whether one more wait reaches the
verdict. A wait runs no gate and judges no tree, so it is refused
beside --full and ${ANYWAY}, and the uncommitted paths of a shared checkout do not refuse it.

${WAIT} ${SLOT} is that same wait pointed at the other thing a run here waits on. A run declined for
the ceiling has no gate of its own — the decline happens before the table, the record and the first
step — so there is no verdict of this tree coming and the subject above has nothing to read. This one
reads the process table instead: it exits 0 once a gate started then would not be declined, naming
the command that gates, and ${DEADLINE} at its own deadline, naming the pid still holding the place.
That is a code no run of this gate exits with, so a caller can tell a tree that never ran from one
that ran and was red, which is the confusion a run improvises around (ISS-1345). It reserves nothing:
the ceiling is advisory, so the place it reports free is the place any gate may take. Waiting is
asked for and never assumed — a bare invocation still declines at ${DECLINED}, because a gate that
blocked by default would hide the contention this project sizes with the number above.

The tree judged is the one this copy of the runner sits in, never the one you stand in, so a run of
another checkout's copy is refused rather than answered about that checkout. Both verdict lines
name the tree, because a wrong-tree gate does not fail — it certifies.`;

const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(USAGE);
  process.exit(0);
}

const full = argv.includes("--full");
const baselining = argv.includes(BASELINE);
const keyAt = argv.indexOf(BASELINE) + 1;
const baselineKey = baselining && KEY.test(argv[keyAt] ?? "") ? argv[keyAt] : null;
const allowDirty = argv.includes(ANYWAY);
const waiting = argv.includes(WAIT);
const mark = argv.indexOf(WAIT);
/* The subject and then the minutes, each read only where it is there and each spent by its position
   rather than by its text: `--wait --full` names neither, reading the next token blindly would
   swallow the flag whose refusal is below, and a token matched by value would let a second copy of
   it anywhere on the line pass as this one. */
const subject = waiting && argv[mark + 1] === SLOT ? SLOT : null;
const minutesAt = mark + (subject === null ? 1 : 2);
const after = waiting ? argv[minutesAt] : undefined;
const patience = after !== undefined && !after.startsWith("-") ? after : null;
const taken = new Set([mark, subject === null ? -1 : mark + 1, patience === null ? -1 : minutesAt,
  baselineKey === null ? -1 : keyAt]);
const unknown = argv.filter((one, at) => !taken.has(at) && one !== "--full" && one !== ANYWAY
  && one !== BASELINE);
const waitCall = `${WAIT}${subject === null ? "" : ` ${subject}`}`;
const waitedOn = subject === SLOT ? "place" : "verdict";

if (unknown.length > 0) {
  console.error(`No such option: ${unknown.join(" ")}\n\n${USAGE}`);
  process.exit(1);
}

const verdictWait = waiting && subject !== SLOT;

if (baselining && (full || verdictWait || allowDirty)) {
  const { besideSaid } = await import("./gates/baseline.mjs");
  console.error(besideSaid(full ? "--full" : verdictWait ? WAIT : ANYWAY, baselineKey));
  process.exit(1);
}

if (waiting && (full || allowDirty)) {
  const other = full ? "--full" : ANYWAY;
  console.error(`${waitCall} runs no gate — it ${subject === SLOT
    ? "waits for a place at the ceiling this checkout declares"
    : "reads the verdict of one this tree already has"} — so ${other} has nothing here to act on.`);
  console.error(`Wait for the ${waitedOn}: node tools/gates.mjs ${waitCall}`);
  console.error(`Or run the gate:      npm run check -- ${other}`);
  process.exit(1);
}

const minutes = patience === null ? DEFAULT_MINUTES : Number(patience);

if (waiting && !(minutes > 0)) {
  console.error(`${waitCall} takes the minutes to wait for a ${waitedOn}, not \`${patience}\`.`);
  console.error(`Wait ${DEFAULT_MINUTES} minutes: node tools/gates.mjs ${waitCall}`);
  process.exit(1);
}

/* Refused and not taken: past what a call can hold the host ends it before the wait can answer, no route here holds one longer — `forge hooks --how polling` refuses a backgrounded loop with the rest — and thirty minutes of it defaulted to cost 310 of 4,102 wall minutes over 54 runs (ISS-1889). Against what a call can hold and not against the ceiling itself, a deadline of exactly the ceiling starting after this process does and the host arriving first. Here and not in the wait, the ceiling being the host's rather than the tree's: a caller under another host still gets the deadline it passes those functions. */
if (waiting && minutes > DEFAULT_MINUTES) {
  console.error(`${waitCall} ${patience} is ${Math.round(minutes * 60)}s and the most a call can hold is `
    + `${DEFAULT_MINUTES * 60}s of the ${CALL_CEILING_SECONDS}s it may live, so the host would end this one `
    + `before the wait could answer.`);
  console.error(`Wait ${DEFAULT_MINUTES} minutes in a call that returns, as often as it takes: `
    + `node tools/gates.mjs ${waitCall}`);
  process.exit(1);
}

/* Read once and then taken out of the environment every step inherits: a gate a step starts is never a landing's. What
   other gates read is this process's own entry in the table, which the removal leaves as it was started. */
const asked = landingAsked();

if (asked.refused) {
  console.error(`${asked.refused}\nNo step ran and nothing was recorded. land-ready sets both: node tools/run.mjs land-ready -h`);
  process.exit(1);
}

delete process.env[LANDING_ENV];
delete process.env[LANDING_WAIT_ENV];

const elsewhere = crossTree(ROOT);

if (elsewhere) {
  console.error(`This is ${ROOT}'s gate and you are standing in ${elsewhere}, whose own copy is the`);
  console.error(`one that judges it. A gate aimed at the wrong tree does not fail, it certifies:`);
  console.error(`  node ${resolve(elsewhere, "tools", "gates.mjs")}`);
  process.exit(1);
}

/* After the wrong-tree guard, because the head it reads is the caller's: a citation printed for the tree
   the caller stands in, by the gate of another, is the certificate that guard exists to refuse. */
if (baselining) {
  const { baselineAfterPlace, takeBaseline } = await import("./gates/baseline.mjs");
  if (waiting) process.exit(await baselineAfterPlace(ROOT, baselineKey, { minutes }));
  const code = takeBaseline(baselineKey);
  if (code !== null) process.exit(code);
}

/* Before the checkout is judged for its uncommitted paths, which is a rule about running a gate:
   this runs none, and a wait refused for a tree two sessions are writing would leave the verdict
   they are waiting for unreadable. */
if (waiting) {
  process.exit(subject === SLOT
    ? await waitForSlot(ROOT, { minutes })
    : await waitForVerdict(ROOT, { minutes }));
}

const ours = runnersOf(ROOT);

/* Before the start record, because the later of two gates over one tree writing a line there is what a wait reading
   that record would be handed in place of the earlier gate's verdict (ISS-1705). */
const holder = treeHeldBy(ROOT, ours);

if (holder !== null) {
  console.error(heldSaid(ROOT, holder, { output: outputOf(holder.pid), seconds: DEFAULT_MINUTES * 60 }));
  process.exit(DECLINED);
}

const dirty = uncommittedInShared(ROOT);
const listed = (say) => {
  for (const one of dirty) say(`    ${one}`);
};
const banner = `gating ${ROOT} with ${dirty.length} uncommitted path(s), asked for with ${ANYWAY}`;

/* Written before the first step and before the refusal below, so every exit from here on has a
   record to decide: a run that reached this tree and left no verdict is one a waiter cannot tell
   from a crash. */
const opened = gateStarted(ROOT, { full });

/* Every exit past the banner, not the green one alone: the run that stops at a failing step is the
   one whose reader most needs to know it was told about a tree two sessions were writing. */
/* Filled as the steps are spent and read by every exit past this tree, the refusals before the first
   step included, which is why they stand above the call that reads them rather than beside the loop. */
const spentFiles = [];
let unitless = 0;
const spent = () => (spentFiles.length > 0 || unitless > 0 ? { files: spentFiles, unitless } : {});

const finish = (code, verdict, figures = {}) => {
  if (dirty.length > 0 && allowDirty) console.log(`\n${banner}`);
  console.log(said(gateDecided(ROOT, opened, { verdict, code, ...spent(), ...figures })));
  process.exit(code);
};

if (dirty.length > 0 && !allowDirty) {
  console.error(`${ROOT} is the checkout every session shares and it holds ${dirty.length} `
    + `uncommitted path(s), so a gate run here judges a tree nobody owns:`);
  listed((line) => console.error(line));
  console.error(`Gate from a worktree of your own: node tools/run.mjs start <ISS-nn>`);
  console.error(`Or gate this tree as it stands, said out loud: npm run check -- ${ANYWAY}`);
  finish(1, "refused");
}

if (dirty.length > 0) {
  console.log(`\n${banner}`);
  listed((line) => console.log(line));
}

/* Every step runs under this and not under the machine's temp root, so what a step leaves there is
   this run's alone and no live session's hooks are mixed into it. It removes itself at exit. A
   machine that will not give it one is said in the same words a fixture's refusal uses (ISS-1611). */
let scratch;
try {
  scratch = gateTmp();
} catch (refusal) {
  console.error(`\n${refusal.message}`);
  console.error(`No step ran and nothing was recorded, so nothing here judges ${ROOT}.`);
  finish(1, "refused");
}

/* Before the table, the record and the first step, because a refusal that cost the caller a step has
   already lost the argument. It says nothing about the tree and records nothing of it. */
const place = placeFor(ours);

if (place.declined && asked.landing?.minutes) {
  if (!await waitAsLanding(ROOT, asked.landing, { ours })) finish(DECLINED, "declined");
} else if (place.declined) {
  const { baselineWaitCall } = baselining ? await import("./gates/baseline.mjs") : {};
  console.error(declinedSaid(place, ROOT, baselining
    ? `Wait for a place and take the baseline in the same call: node tools/gates.mjs ${baselineWaitCall(baselineKey)}`
    : undefined));
  finish(DECLINED, "declined");
}

const files = gitFiles(ROOT);

/* A gate that cannot build its table or read its record is broken, not red: it refuses before
   anything runs, so nothing reads as covered by a step the runner never had. */
const orRefuse = (what, build) => {
  try {
    return build();
  } catch (error) {
    console.error(`This gate ${what}: ${error.message}`);
    return finish(1, "refused");
  }
};

const steps = orRefuse("has no runnable step table",
  () => gateSteps(files.filter((one) => TEST_FILE.test(one))));

/* Each widening this run may not then trust the record through, with its own why and its own way
   out. Not `full` itself: an empty diff widens too, and that is the re-run the record exists for. */
const unreadable = (why, act) => ({ unread: why, act });

/* The paths the diff named, null where no diff was read at all. A run that never learned what changed
   says nothing about reach rather than reporting a reach of nought, which reads as a run that spent
   everything for nothing when it is a run that cannot tell. */
let changed = null;

const scoped = () => {
  const diff = mergeBaseDiff(ROOT);
  /* Not knowing what changed is not knowing that nothing did. The record answers for the paths a
     step reads, and this run never learned which of them moved. */
  if (diff.error) {
    return { full: true, reason: diff.error, ...unreadable(diff.error, `Gate with --full, or give this tree a base it shares with the default branch.`) };
  }
  changed = diff.changed;
  if (diff.changed.length === 0) return { full: true, reason: `nothing differs from ${diff.branch}` };
  /* Before the return below and not inside planFor, which that return never reaches: a diff holding
     both a runner-module edit and an unclaimed path would carry no marker, and its second run would
     be handed back every step the first one widened to. */
  const stranger = unclaimedIn(steps, diff.changed);
  const past = stranger
    ? unreadable(`no step claims ${stranger}, so no digest here covers it`, `Claim the path in tools/gates/steps.mjs.`)
    : {};
  const own = editsDerivation(diff.changed, SELF, ROOT);
  if (own) return { full: true, reason: `${own} decides what a run may skip`, ...past };
  console.log(`\n=== scope: ${diff.changed.length} path(s) since ${diff.base.slice(0, 7)} on ${diff.branch} ===`);
  const plan = planFor(steps, diff.changed);
  if (plan.full) return { ...plan, ...past };
  for (const step of plan.steps) {
    console.log(`${step.run ? "run " : "skip"} ${step.label.padEnd(22)} ${step.reason ?? "nothing it reads changed"}`);
  }
  return plan;
};

let planned = steps;
let ledger;

if (!full) {
  let plan = scoped();
  /* Merged into whichever widening `scoped` reached, its own included: a broken install is the one
     input the digests cannot hold, so the record answers for no step while it stands. */
  const missing = orRefuse("cannot read the packages this project declares", () => unresolvedIn(ROOT))?.missing ?? [];
  if (missing.length > 0) {
    plan = { ...plan, ...unreadable(`${saidMissing(missing)} does not resolve under node_modules, `
      + `so no digest here covers the step that needs it`, `Run \`${PUTS_IT_BACK}\`.`) };
  }
  if (plan.full) console.log(`\n=== scope: the full gate — ${plan.reason} ===`);
  else planned = plan.steps.filter((step) => step.run);
  if (plan.unread) {
    console.log(`\n=== ledger: digests not read — ${plan.unread} ===`);
    console.log(`Every step runs and this run records no pass; the seconds beside them are read for the order. ${plan.act}`);
  } else {
    ledger = orRefuse("cannot read its own record", () => ledgerFor(planned, { root: ROOT, files, runner: SELF }));
    const green = ledger.entries.filter((step) => step.green);
    console.log(`\n=== ledger: ${green.length} of ${ledger.entries.length} step(s) green already ===`);
    for (const step of green) {
      console.log(`skip ${step.label.padEnd(22)} digest ${step.digest}`
        + (step.took === null ? ", passing before this record kept seconds" : `, ${step.took}s when it passed`));
    }
    for (const step of ledger.entries.filter((one) => !one.green)) console.log(ledgerSaid(step));
    console.log(`${ledger.dir}\n${LEDGER_UNSEEN}`);
    planned = ledger.entries.filter((step) => !step.green);
  }
}

/* Inside a step the diff already reaches, the unit is the file, and only a file this content has a
   recorded set for is held back. A step left with nothing to spend is not spent at all, and passes
   here: every file it holds was answered for at this content, which is the whole of its claim. */
if (ledger) {
  const dir = readsDir(recordDir(ROOT));
  const answered = [];
  planned = planned.flatMap((step) => {
    if (!step.tests) return [step];
    const { spend, kept, unknown, closures } = selectTests(dir, step.files, { root: ROOT, context: contextOf(launcherOf(step)) });
    answered.push({ step, kept, spend, unknown });
    const carried = { known: step.files.length, held: kept.map((each) => each.file), closures };
    if (kept.length === 0) return [{ ...step, ...carried }];
    if (spend.length > 0) return [{ ...step, ...carried, files: spend, argv: argvForTests(spend), narrowed: true }];
    recordPass(ledger.dir, step, null);
    return [];
  });
  for (const line of answered.flatMap((one) => readsSaid(one))) console.log(line);
}

/* Every arrival at the loop is ordered by the same read, the two trusting no digest included: what they
   withhold trust from decides whether a step is spent, and this only which spent step goes first. */
planned = orRefuse("cannot read the seconds its steps last took", () => cheapestFirst(secondsFor(ROOT, planned)));

if (planned.length > 0) {
  console.log(`\n=== order: ${planned.length} step(s), cheapest first by the seconds recorded ===`);
  for (const step of planned) {
    console.log(`  ${step.label.padEnd(22)} `
      + (step.seconds === null ? "no figure recorded, so last" : `${step.seconds}s when it last passed`));
  }
}

const started = Date.now();
const [load] = loadavg();
const cores = availableParallelism();
const declared = parallelRuns();
const workers = testWorkers({ cores, declared });
if (planned.some((step) => step.tests)) {
  console.log(`\n=== ${workers} test worker(s) of ${cores} core(s)`
    + `${declared.value === null ? ", this box having declared no runs" : `, ${declared.value} run(s) declared in ${declared.from}`} ===`);
}
const record = recordDir(ROOT);
const mine = runKey(ROOT);
const unproved = [];
const owned = [];

const readsOut = (label) => resolve(scratch, "gate-reads", label.replace(/[^\w.-]+/gu, "-"));

/* Audited whichever kind it is: a test step to key each file on what it read, a script step because
   its declaration is the only claim anything holds it to and nothing held it to that (ISS-1911). */
const stepEnv = (step) => ({
  ...auditEnv(readsOut(step.label), ROOT),
  ...(step.tests
    ? { GATE_FILE_TIMES: fileTimesPath(record, step.label), [CASES_ENV]: casesPath(scratch, step.label),
        [ROOM_ENV]: roomPath(record, step.label, mine) }
    : {}),
});

/* Every exit past an attribution says what its findings reached, the leak refusal included: a key
   printed only in the middle of a 2500-second log is the state ISS-925 exists to leave. */
const ownedLines = () => owned.map((each) =>
  `  ${each.step}  ${each.one.file}  ${each.one.name}${reachedBy(owned, each)}`);

/* Why a step is being refused, in one clause between the label and the tree. Empty for a step no
   case can be named in, whose refusal is then the one it printed before any of this existed. */
const because = (step, said, error) => {
  if (said) return ` — ${said.tree.length} of ${said.judged.length} case(s) reproduced alone`;
  return step.tests && !error ? ` — no failing case was named, so none was re-run` : "";
};

for (const step of planned) {
  console.log(`\n=== ${step.label} ===`);
  const spend = spendOf(step, { record, changed });
  const at = Date.now();
  const env = { ...process.env, TMPDIR: scratch, ...stepEnv(step) };
  /* Before the step and again once it has passed, so the only note left standing is a refusal this
     run exited on or one a killed gate abandoned — as a killed gate abandons its temp root. */
  if (step.tests) forgetRoomRefusal(roomPath(record, step.label, mine));
  const { status, error } = spawnSync(step.argv[0], step.argv.slice(1), { cwd: ROOT, env, stdio: "inherit" });
  const took = Math.round((Date.now() - at) / 1000);
  const failed = Boolean(error) || status !== 0;
  if (spend === null) unitless += 1;
  else spentFiles.push({ step: step.label, spent: spend.spent, known: spend.known });
  console.log(`\n${stepSaid(step.label, took, spend)}`);
  if (failed) {
    /* Before the attribution, which would spend a re-run per case on a machine that has no room to
       give one: a step whose fixture was refused its room judged nothing about the tree (ISS-1611). */
    const refused = step.tests ? roomRefused(roomPath(record, step.label, mine)) : null;
    if (refused) {
      console.error(`\nGate failed: ${step.label} — the machine refused a fixture its temporary room `
        + `${refused.times} time(s), so this step judged nothing about the tree: ${ROOT}`);
      console.error(refused.said);
      for (const line of ownedLines()) console.error(line);
      finish(status ?? 1, "failed", { step: step.label });
    }
    /* A step of thousands of cases that refuses on three of them says which three, and whether
       re-running each once, alone, at this head reproduces any of them (ISS-907). */
    const said = step.tests && !error ? attribute(step, {
      root: ROOT, scratch, cases: casesPath(scratch, step.label),
      record: alonePath(record, step.label), say: console.log,
      audited: (room) => auditEnv(join(room, "gate-reads"), ROOT),
    }) : null;
    if (said) for (const line of attributionLines(said)) console.log(line);
    /* Before the branch below and not inside it: a recurrence beside a case that reproduced is a
       finding too, and the run that refuses for the second still owes the first an owner. */
    const again = said ? recurrencesIn(said, step) : [];
    if (again.length > 0) {
      const asked = await fileRecurrences(again);
      for (const line of asked.lines) console.log(line);
      owned.push(...asked.named);
    }
    if (said && said.tree.length === 0) unproved.push(...said.quiet.map((one) => ({ step: step.label, one })));
    else {
      console.error(`\nGate failed: ${step.label}${error ? ` (${error.message})` : ""}`
        + `${because(step, said, error)} — the tree judged: ${ROOT}`);
      for (const each of said?.tree ?? []) console.error(`  ${each.one.file}  ${each.one.name}`);
      for (const line of ownedLines()) console.error(line);
      finish(status ?? 1, "failed", { step: step.label, ...(said ? failedReads(readsOut(step.label), ROOT, said.tree) : {}) });
    }
  }
  if (step.tests) forgetRoomRefusal(roomPath(record, step.label, mine));
  /* Before the pass is recorded, or the ledger holds a step green that left the machine dirtier. */
  const leak = roomLeft(scratch);
  if (leak) {
    console.error(`\nGate failed: ${step.label} — the tree judged: ${ROOT}\n${leakMessage(leak)}`);
    for (const line of ownedLines()) console.error(line);
    finish(1, "failed", { step: step.label });
  }
  /* What the audit saw, before the pass, since the pass is keyed on the sets this writes. The
     declarations are judged whichever way the step went — a ceiling its own evidence contradicts is
     the tree's and not this step's, and the files it covers were spent either way — while only a
     step that passed writes an entry or a pass. */
  /* A script step has no file unit, so what it read is judged against its own declaration and the
     refusal is the step's. Only a step that passed reaches this, a failed one having refused above. */
  if (!step.tests) {
    const set = stepSetFrom(readsOut(step.label), ROOT);
    const escapes = stepEscapes(set, step.reads);
    if (escapes.length === 0) console.log(stepRead(step, set));
    else {
      console.error(`\nGate failed: ${step.label} — the tree judged: ${ROOT}`);
      console.error(escapedStep(step, escapes));
      for (const line of ownedLines()) console.error(line);
      finish(1, "failed", { step: step.label });
    }
  }
  if (step.tests) {
    const manifests = manifestsIn(files);
    const sets = setsFrom(readsOut(step.label), ROOT);
    const { dead, escaped, several } = claimsJudged(sets, { manifests, declared: DECLARED_READS });
    if (!failed) {
      const { wrote, declared } = recordSets(readsDir(record), sets, {
        root: ROOT, context: contextOf(launcherOf(step)), manifests, tracked: files,
        declared: DECLARED_READS, escaped,
      });
      console.log(wroteSets({ files: step.files.length, wrote, declared: declared.length }));
    }
    for (const one of dead) console.log(deadClaim(one));
    for (const one of several) for (const line of severalCauses(one)) console.log(line);
    if (escaped.length > 0) {
      console.error(`\nGate failed: ${step.label} — the tree judged: ${ROOT}`);
      for (const one of escaped) console.error(escapedClaim(one));
      for (const line of ownedLines()) console.error(line);
      finish(1, "failed", { step: step.label });
    }
  }
  if (ledger && !failed) recordPass(ledger.dir, step, took);
}

const elapsed = Math.round((Date.now() - started) / 1000);
const held = ledger?.entries.filter((step) => step.green).length ?? 0;
const spared = held > 0 ? ` (${held} the ledger already held)` : "";

/* Not the line a clean run prints, and no figure either: this run refused nothing and proved less
   than the one it is about to be compared with, so neither may read as the other (ISS-907). */
if (unproved.length > 0) {
  console.log(`\n${planned.length} gate step(s) ran in ${elapsed}s and this is not a clean pass `
    + `— the tree judged: ${ROOT}`);
  console.log(`${unproved.length} case(s) failed in a step and were not reproduced alone:`);
  for (const each of unproved) {
    console.log(`  ${each.step}  ${each.one.file}  ${each.one.name}${reachedBy(owned, each)}`);
  }
  console.log(`No pass is recorded for the step(s) they were in, so the next invocation on this `
    + `content spends each of them whole: cases passing one at a time are not the suite passing. `
    + `No whole-run figure is recorded either — seconds spent re-running cases measure neither this `
    + `gate nor this tree.`);
  finish(0, "unproved", { seconds: elapsed, ran: planned.length, total: steps.length });
}

console.log(`\nAll ${planned.length} gate step(s) passed in ${elapsed}s${spared} — the tree judged: ${ROOT}`);

/* Past the verdict, and only on the green one: a figure a red run left would be the seconds spent
   reaching a failure. The directory is resolved here rather than taken off the ledger, which --full
   never builds — and a --full run is the one producing a figure this gate can be compared by.
   What it wrote and not what the record now says: the comparison has one reader, the release, and a
   second place to look for it is a second thing to remember to read. Said and not refused, too — every
   step has already passed, and a tree that cannot be timed is still a tree this gate answered for. */
try {
  const dir = recordDir(ROOT);
  const figure = recordRun(dir, { seconds: elapsed, ran: planned.length, total: steps.length, load, cores });
  console.log(`recorded: ${figure} — ${seriesFile(dir)}`);
} catch (error) {
  console.error(`This gate passed and could not record how long it took: ${error.message}`);
}

finish(0, "pass", { seconds: elapsed, ran: planned.length, total: steps.length });
