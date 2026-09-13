#!/usr/bin/env node
/* The gate `npm run check` is. Eleven steps chained with `&&` ran whole or not at all — ninety
   seconds for a docs typo, and seven delegated runs spent eighty-four minutes on 111 of them
   (ISS-117). This runs the steps a change can reach and skips the ones whose inputs have not moved
   since they passed; what it may not do is pass without having covered the change, so every path
   it cannot place widens the run instead of narrowing it. */
import { spawnSync } from "node:child_process";
import { availableParallelism, loadavg } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { crossTree, gitFiles, uncommittedInShared } from "./checkout.mjs";
import { DEADLINE, DEFAULT_MINUTES, gateDecided, gateStarted, GONE, NO_GATE, said, TERMINAL, waitForVerdict }
  from "./gate-verdict.mjs";
import { attribute, attributionLines, CASES_ENV } from "./gates/isolation.mjs";
import { cheapestFirst, ENTRIES_PER_STEP, ledgerFor, LEDGER_UNSEEN, recordPass, secondsFor } from "./gates/ledger.mjs";
import { PUTS_IT_BACK, said as saidMissing, unresolvedIn } from "../plugin/src/resolve/installed.mjs";
import { DECLINED, placeFor, RAISE, runnersOf, WAIT } from "./gates/machine.mjs";
import { fileRecurrences, reachedBy, recurrencesIn } from "./gates/recurrence.mjs";
import { editsDerivation, mergeBaseDiff, planFor, unclaimedIn } from "./gates/scope.mjs";
import { gateSteps, TEST_FILE } from "./gates/steps.mjs";
import { gateTmp, leakMessage, roomLeft } from "./gates/stamp-room.mjs";
import { alonePath, casesPath, CEILING_SECONDS, REVIEW, fileTimesPath, recordDir, recordRun, seriesFile } from "./gates/timing.mjs";

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), "..");
const ANYWAY = "--anyway";

const USAGE = `Usage: node tools/gates.mjs [--full] [${ANYWAY}]

Every check this repository gates a change with, stopping at the first failure. It is what
\`npm run check\` runs; each step is still the npm script of its own name, spent by hand.

Runs only the steps the diff can reach, and prints what it skipped and why. The diff is against
the merge-base with the default branch, so committing does not empty it. A changed path no step
claims widens the run to everything rather than guessing, and so does a change to the runner or
its own modules.

Widening is half of it. A run that cannot place every changed path in a step leaves the record's
digests unread as well, because no step's digest is keyed on a path no step reads, so the widening
would be handed straight back. Three ways it cannot: a path no step claims, no merge base to diff
against, and a listing git refused. Each of those says which it was, spends every step and
records no pass. A diff that succeeded and came back empty is none of them, and keeps the record.

A test step that fails says which cases did, and then re-runs each of them once, alone, at this same
head, under a temporary directory of that re-run's own. A case the re-run reproduces is this tree's:
the gate refuses and names it, rather than naming the step and leaving a run to guess. A case it does
not reproduce has not been shown to be this tree's, and the gate carries on — that is all one re-run
can say, and it says no more: a starved process and an interaction between cases both answer this
way. One re-run per case and never a loop, because a tree failure retried into green is the one
thing this may not do. A case the previous attribution of that step named at this same digest is said
to be a suite-interaction finding instead. Whichever way its cases went,
a step that failed records no pass — cases passing one at a time are not the suite passing — so the
next invocation spends it whole, and a run that re-ran anything prints neither the line a clean run
prints nor a figure of its own.

**A suite-interaction finding files an issue, and refuses nothing.** Ruled on 2026-09-09 (ISS-925)
between four readings, three of which refuse: a case that fails in company and passes alone twice at
one content gets an owner on this project's backlog, and the landing proceeds. The exit status of
every step and of the whole run is exactly what it would have been with no recurrence in it, which
is what the re-run's own ruling settles and this changes no part of. The issue carries the case, its
file, this step, the digest, both attributions' times and that it passed alone at each, so that
nobody has to read the middle of this log to work it; the verdict block names the issue beside the
case, for the same reason.

A finding is the case's whole file and its whole name, and no more, digested into a marker the title
carries: **a second recurrence of one case comments on that case's issue rather than filing again**,
found by searching the backlog for that marker and matching it in a title, never by a count kept
here. A renamed case or a moved file is a new finding. An issue somebody has closed or dropped
answers nothing — a finding that came back past a close is filed again and the body names the
settled one — and a live issue is preferred over a settled one where both are there. A lookup that
does not come back whole files nothing and says so, because a page that came back short is a ceiling
and not an absence. A filing that cannot be made at all — no credential, no network, a checkout
without this plugin's own CLI — prints why, prints the body, prints the one command that files it by
hand, and leaves the run's status alone: a gate that cannot reach the tracker may not become a gate
that refuses. A run with nothing to file reaches none of this and sends no request.

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
context and never as proof: the figure a run is judged against is the one the last gate review measured,
said with the load it measured under — ${REVIEW.seconds}s on ${REVIEW.on} (${REVIEW.issue}) — and a whole run
over the ceiling that review set, ${CEILING_SECONDS}s, is said to be. Beside the runs, a test step leaves
<label>-files: one line per test file with the seconds node measured on it, longest first, which is
what the next review reads the suite's growth off.

${LEDGER_UNSEEN}

Every step runs under a temporary directory of this run's own, and a step that leaves the plugin's
hook stamps in it is failed: on a developer's machine that directory is the room every hook reaps
before every stamp, and a suite that fills it is a cost no green can show.

Before any of that, before the table and before the first step, it counts the gates of this checkout
already running and declines where they have reached the number this project declares — one number,
${RAISE}, absent which nothing is counted and nothing declines. A decline exits ${DECLINED}
rather than 1, names each gate it counted and the tree that gate is judging, records no pass and no
figure, and says no verdict about this tree: a run that spent twenty-five minutes and then reported
the tree is what this exists to stop, and a refusal costing the caller a step has already lost the
argument.

What it counts is gates, not load. Four whole runs of this gate at one-minute loads of 5.6, 5.9,
10.5 and 24.7 did not order by whether they passed (ISS-917), and three whole gates at once, at load
27, were all green. What it counts them off is the process table: a gate is a node process running a
runner of one of this checkout's worktrees, and the order is the kernel's own start time for each,
which is fixed before either gate runs a line. A file left behind would have to be reclaimed when
its holder is killed, and reclaiming a shared name is a race two gates can both win.

The ceiling is advisory and not mutual exclusion. A gate becomes countable when the shell
\`npm run check\` spawned execs node, so two gates starting inside that window — milliseconds, and
only ever a gate's own fork-to-exec — can both admit themselves; the cost of that is one extra gate
on a box measured to carry three with no loss. Not counted at all: a gate of another checkout, a
build of another project, a gate belonging to another user, and every gate on a machine whose
process table cannot be read, which declines nobody. Only the process running a runner is counted,
never one that merely names its path, because a run declined for somebody's \`grep\` costs a wave a
round.

Test concurrency is untouched by the number and stays the whole core count. Measured here over 175
files and 2368 cases: the same work took 276s at 3 workers, 223s at 6, 228s at 12 and 231s at 18, so
sizing a lone gate down by the declared number would cost it a quarter to save a crowded box a
thirtieth — and the crowded box has no deficit to recover, three whole gates at once having finished
in 726s against 789s for the same three taken in turn.

A run in the shared checkout is refused while that checkout holds uncommitted paths: more than one
session stands there, so the result would be about a tree none of them owns. A worktree is never
refused — its uncommitted work is the point of it.

  --full     every step, whatever the diff or the ledger says
  ${ANYWAY}   gate the shared checkout as it stands, uncommitted paths and all. The run names
             them when it starts and says again at the end that it used this, so a result reached
             this way cannot be mistaken for a clean one.
  ${WAIT} [M]  wait for the verdict of a gate of this tree instead of running one, up to M
             minutes (${DEFAULT_MINUTES} where none is given), and exit on that verdict

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
wait attaches to a run it did not start. A wait runs no gate and judges no tree, so it is refused
beside --full and ${ANYWAY}, and the uncommitted paths of a shared checkout do not refuse it.

The tree judged is the one this copy of the runner sits in, never the one you stand in, so a run of
another checkout's copy is refused rather than answered about that checkout. Both verdict lines
name the tree, because a wrong-tree gate does not fail — it certifies.`;

const argv = process.argv.slice(2);

if (argv.includes("-h") || argv.includes("--help")) {
  console.log(USAGE);
  process.exit(0);
}

const full = argv.includes("--full");
const allowDirty = argv.includes(ANYWAY);
const waiting = argv.includes(WAIT);
/* The value after the flag and only where it is one: `--wait --full` names no minutes, and reading
   the next token blindly would swallow the flag whose refusal is below. */
const after = argv[argv.indexOf(WAIT) + 1];
const patience = waiting && after !== undefined && !after.startsWith("-") ? after : null;
const unknown = argv.filter((one) => one !== "--full" && one !== ANYWAY && one !== WAIT && one !== patience);

if (unknown.length > 0) {
  console.error(`No such option: ${unknown.join(" ")}\n\n${USAGE}`);
  process.exit(1);
}

if (waiting && (full || allowDirty)) {
  const other = full ? "--full" : ANYWAY;
  console.error(`${WAIT} runs no gate — it reads the verdict of one this tree already has — so ${other} `
    + `has nothing here to act on.`);
  console.error(`Wait for the verdict: node tools/gates.mjs ${WAIT}${patience ? ` ${patience}` : ""}`);
  console.error(`Or run the gate:      npm run check -- ${other}`);
  process.exit(1);
}

const minutes = patience === null ? DEFAULT_MINUTES : Number(patience);

if (waiting && !(minutes > 0)) {
  console.error(`${WAIT} takes the minutes to wait for a verdict, not \`${patience}\`.`);
  console.error(`Wait ${DEFAULT_MINUTES} minutes: node tools/gates.mjs ${WAIT}`);
  process.exit(1);
}

const elsewhere = crossTree(ROOT);

if (elsewhere) {
  console.error(`This is ${ROOT}'s gate and you are standing in ${elsewhere}, whose own copy is the`);
  console.error(`one that judges it. A gate aimed at the wrong tree does not fail, it certifies:`);
  console.error(`  node ${resolve(elsewhere, "tools", "gates.mjs")}`);
  process.exit(1);
}

/* Before the checkout is judged for its uncommitted paths, which is a rule about running a gate:
   this runs none, and a wait refused for a tree two sessions are writing would leave the verdict
   they are waiting for unreadable. */
if (waiting) process.exit(await waitForVerdict(ROOT, { minutes }));

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
const finish = (code, verdict, figures = {}) => {
  if (dirty.length > 0 && allowDirty) console.log(`\n${banner}`);
  console.log(said(gateDecided(ROOT, opened, { verdict, code, ...figures })));
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
   this run's alone and no live session's hooks are mixed into it. It removes itself at exit. */
const scratch = gateTmp();

/* Before the table, the record and the first step, because a refusal that cost the caller a step has
   already lost the argument. It says nothing about the tree and records nothing of it. */
const place = placeFor(runnersOf(ROOT));

if (place.declined) {
  console.error(`\nThis gate declined the machine and judged nothing.`);
  console.error(`${place.ahead.length} gate(s) of this checkout are already running, and this project `
    + `carries ${place.declared.value} run(s) at once  ← ${place.declared.from}`);
  for (const one of place.ahead) console.error(`  pid ${one.pid}  gating ${one.tree}`);
  console.error(`No step ran and nothing was recorded, so nothing here judges ${ROOT}.`);
  console.error(`Wait for one of those to finish, or raise ${RAISE} above `
    + `${place.declared.value}.`);
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

const scoped = () => {
  const diff = mergeBaseDiff(ROOT);
  /* Not knowing what changed is not knowing that nothing did. The record answers for the paths a
     step reads, and this run never learned which of them moved. */
  if (diff.error) {
    return { full: true, reason: diff.error, ...unreadable(diff.error, `Gate with --full, or give this tree a base it shares with the default branch.`) };
  }
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
    console.log(`${ledger.dir}\n${LEDGER_UNSEEN}`);
    planned = ledger.entries.filter((step) => !step.green);
  }
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
const record = recordDir(ROOT);
const unproved = [];
const owned = [];

const testEnv = (step) => step.tests
  ? { GATE_FILE_TIMES: fileTimesPath(record, step.label), [CASES_ENV]: casesPath(scratch, step.label) }
  : {};

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
  const at = Date.now();
  const env = { ...process.env, TMPDIR: scratch, ...testEnv(step) };
  const { status, error } = spawnSync(step.argv[0], step.argv.slice(1), { cwd: ROOT, env, stdio: "inherit" });
  const took = Math.round((Date.now() - at) / 1000);
  const failed = Boolean(error) || status !== 0;
  console.log(`\n--- ${step.label}: ${took}s`);
  if (failed) {
    /* A step of thousands of cases that refuses on three of them says which three, and whether
       re-running each once, alone, at this head reproduces any of them (ISS-907). */
    const said = step.tests && !error ? attribute(step, {
      root: ROOT, scratch, cases: casesPath(scratch, step.label),
      record: alonePath(record, step.label), say: console.log,
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
      finish(status ?? 1, "failed", { step: step.label });
    }
  }
  /* Before the pass is recorded, or the ledger holds a step green that left the machine dirtier. */
  const leak = roomLeft(scratch);
  if (leak) {
    console.error(`\nGate failed: ${step.label} — the tree judged: ${ROOT}\n${leakMessage(leak)}`);
    for (const line of ownedLines()) console.error(line);
    finish(1, "failed", { step: step.label });
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
