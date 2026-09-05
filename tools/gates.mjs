#!/usr/bin/env node
/* The gate `npm run check` is. Eleven steps chained with `&&` ran whole or not at all — ninety
   seconds for a docs typo, and seven delegated runs spent eighty-four minutes on 111 of them
   (ISS-117). This runs the steps a change can reach and skips the ones whose inputs have not moved
   since they passed; what it may not do is pass without having covered the change, so every path
   it cannot place widens the run instead of narrowing it. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { crossTree, gitFiles, uncommittedInShared } from "./checkout.mjs";
import { ledgerFor, LEDGER_UNSEEN, recordPass } from "./gates/ledger.mjs";
import { editsDerivation, mergeBaseDiff, planFor, unclaimedIn } from "./gates/scope.mjs";
import { gateSteps, TEST_FILE } from "./gates/steps.mjs";
import { gateTmp, leakMessage, roomLeft } from "./gates/stamp-room.mjs";
import { recordDir, recordRun, seriesFile } from "./gates/timing.mjs";

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

Widening is half of it. A run that cannot place every changed path in a step leaves the record
unread as well, because no step's digest is keyed on a path no step reads, so the widening would
be handed straight back. Three ways it cannot: a path no step claims, no merge base to diff
against, and a listing git refused. Each of those says which it was, spends every step and
records no pass. A diff that succeeded and came back empty is none of them, and keeps the record.

Past that, a step whose inputs are byte for byte what they were when it last passed is skipped and
says which digest matched. Only passes are recorded, so a red step is red again next time. The
record lives under the common git directory, so a worktree's pass counts for the checkout's re-run
of the same tree, and carries the seconds that step took when it passed.

Beside it, one line per green run: the whole run's seconds and how many of the table's steps it
actually spent. Only a run that spent every step measures this gate, which is what --full is for, so
the count is part of the record, and a change is read between two of those runs of the same size and
no others, however many scoped runs sit between them. A scoped figure is printed and named and never
subtracted. This says what it recorded; the release is the one place that prints the change.

${LEDGER_UNSEEN}

Every step runs under a temporary directory of this run's own, and a step that leaves the plugin's
hook stamps in it is failed: on a developer's machine that directory is the room every hook reaps
before every stamp, and a suite that fills it is a cost no green can show.

A run in the shared checkout is refused while that checkout holds uncommitted paths: more than one
session stands there, so the result would be about a tree none of them owns. A worktree is never
refused — its uncommitted work is the point of it.

  --full     every step, whatever the diff or the ledger says
  ${ANYWAY}   gate the shared checkout as it stands, uncommitted paths and all. The run names
             them when it starts and says again at the end that it used this, so a result reached
             this way cannot be mistaken for a clean one.

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
const unknown = argv.filter((one) => one !== "--full" && one !== ANYWAY);

if (unknown.length > 0) {
  console.error(`No such option: ${unknown.join(" ")}\n\n${USAGE}`);
  process.exit(1);
}

const elsewhere = crossTree(ROOT);

if (elsewhere) {
  console.error(`This is ${ROOT}'s gate and you are standing in ${elsewhere}, whose own copy is the`);
  console.error(`one that judges it. A gate aimed at the wrong tree does not fail, it certifies:`);
  console.error(`  node ${resolve(elsewhere, "tools", "gates.mjs")}`);
  process.exit(1);
}

const dirty = uncommittedInShared(ROOT);
const listed = (say) => {
  for (const one of dirty) say(`    ${one}`);
};

if (dirty.length > 0 && !allowDirty) {
  console.error(`${ROOT} is the checkout every session shares and it holds ${dirty.length} `
    + `uncommitted path(s), so a gate run here judges a tree nobody owns:`);
  listed((line) => console.error(line));
  console.error(`Gate from a worktree of your own: node tools/run.mjs start <ISS-nn>`);
  console.error(`Or gate this tree as it stands, said out loud: npm run check -- ${ANYWAY}`);
  process.exit(1);
}

const banner = `gating ${ROOT} with ${dirty.length} uncommitted path(s), asked for with ${ANYWAY}`;

if (dirty.length > 0) {
  console.log(`\n${banner}`);
  listed((line) => console.log(line));
}

/* Every step runs under this and not under the machine's temp root, so what a step leaves there is
   this run's alone and no live session's hooks are mixed into it. It removes itself at exit. */
const scratch = gateTmp();

/* Every exit past the banner, not the green one alone: the run that stops at a failing step is the
   one whose reader most needs to know it was told about a tree two sessions were writing. */
const finish = (code) => {
  if (dirty.length > 0) console.log(`\n${banner}`);
  process.exit(code);
};

const files = gitFiles(ROOT);

/* A gate that cannot build its table or read its record is broken, not red: it refuses before
   anything runs, so nothing reads as covered by a step the runner never had. */
const orRefuse = (what, build) => {
  try {
    return build();
  } catch (error) {
    console.error(`This gate ${what}: ${error.message}`);
    return finish(1);
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
  const plan = scoped();
  if (plan.full) console.log(`\n=== scope: the full gate — ${plan.reason} ===`);
  else planned = plan.steps.filter((step) => step.run);
  if (plan.unread) {
    console.log(`\n=== ledger: not read — ${plan.unread} ===`);
    console.log(`Every step runs and this run records no pass. ${plan.act}`);
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

const started = Date.now();

for (const step of planned) {
  console.log(`\n=== ${step.label} ===`);
  const at = Date.now();
  const env = { ...process.env, TMPDIR: scratch };
  const { status, error } = spawnSync(step.argv[0], step.argv.slice(1), { cwd: ROOT, env, stdio: "inherit" });
  const took = Math.round((Date.now() - at) / 1000);
  console.log(`\n--- ${step.label}: ${took}s`);
  if (error || status !== 0) {
    console.error(`\nGate failed: ${step.label}${error ? ` (${error.message})` : ""} — the tree judged: ${ROOT}`);
    finish(status ?? 1);
  }
  /* Before the pass is recorded, or the ledger holds a step green that left the machine dirtier. */
  const leak = roomLeft(scratch);
  if (leak) {
    console.error(`\nGate failed: ${step.label} — the tree judged: ${ROOT}\n${leakMessage(leak)}`);
    finish(1);
  }
  if (ledger) recordPass(ledger.dir, step, took);
}

const elapsed = Math.round((Date.now() - started) / 1000);
const held = ledger?.entries.filter((step) => step.green).length ?? 0;
const spared = held > 0 ? ` (${held} the ledger already held)` : "";
console.log(`\nAll ${planned.length} gate step(s) passed in ${elapsed}s${spared} — the tree judged: ${ROOT}`);

/* Past the verdict, and only on the green one: a figure a red run left would be the seconds spent
   reaching a failure. The directory is resolved here rather than taken off the ledger, which --full
   never builds — and a --full run is the one producing a figure this gate can be compared by.
   What it wrote and not what the record now says: the comparison has one reader, the release, and a
   second place to look for it is a second thing to remember to read. Said and not refused, too — every
   step has already passed, and a tree that cannot be timed is still a tree this gate answered for. */
try {
  const dir = recordDir(ROOT);
  const figure = recordRun(dir, { seconds: elapsed, ran: planned.length, total: steps.length });
  console.log(`recorded: ${figure} — ${seriesFile(dir)}`);
} catch (error) {
  console.error(`This gate passed and could not record how long it took: ${error.message}`);
}

finish(0);
