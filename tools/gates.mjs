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
import { editsDerivation, mergeBaseDiff, planFor } from "./gates/scope.mjs";
import { gateSteps, TEST_FILE } from "./gates/steps.mjs";

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

Past that, a step whose inputs are byte for byte what they were when it last passed is skipped and
says which digest matched. Only passes are recorded, so a red step is red again next time. The
record lives under the common git directory, so a worktree's pass counts for the checkout's re-run
of the same tree.

${LEDGER_UNSEEN}

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

if (dirty.length > 0 && !allowDirty) {
  console.error(`${ROOT} is the checkout every session shares and it holds ${dirty.length} `
    + `uncommitted path(s), so a gate run here judges a tree nobody owns:`);
  for (const one of dirty) console.error(`    ${one}`);
  console.error(`Gate from a worktree of your own: node tools/run.mjs start <ISS-nn>`);
  console.error(`Or gate this tree as it stands, said out loud: npm run check -- ${ANYWAY}`);
  process.exit(1);
}

const banner = `gating ${ROOT} with ${dirty.length} uncommitted path(s), asked for with ${ANYWAY}`;
if (dirty.length > 0) console.log(`\n${banner}`);

/* Every exit past the banner, not the green one alone: the run that stops at a failing step is the
   one whose reader most needs to know it was told about a tree two sessions were writing. */
const finish = (code) => {
  if (dirty.length > 0) console.log(`\n${banner}`);
  process.exit(code);
};

const files = gitFiles(ROOT);

/* A table this file cannot use is a broken gate, not a failing step: it is refused before anything
   runs, so nothing reads as covered by a step the runner never had. */
const built = () => {
  try {
    return gateSteps(files.filter((one) => TEST_FILE.test(one)));
  } catch (error) {
    console.error(`This gate has no runnable step table: ${error.message}`);
    return finish(1);
  }
};

const steps = built();

const scoped = () => {
  const diff = mergeBaseDiff(ROOT);
  if (diff.error) return { full: true, reason: diff.error };
  if (diff.changed.length === 0) return { full: true, reason: `nothing differs from ${diff.branch}` };
  const own = editsDerivation(diff.changed, SELF, ROOT);
  if (own) return { full: true, reason: `${own} decides what a run may skip` };
  console.log(`\n=== scope: ${diff.changed.length} path(s) since ${diff.base.slice(0, 7)} on ${diff.branch} ===`);
  const plan = planFor(steps, diff.changed);
  if (plan.full) return plan;
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
  ledger = ledgerFor(planned, { root: ROOT, files, runner: SELF });
  const green = ledger.entries.filter((step) => step.green);
  console.log(`\n=== ledger: ${green.length} of ${ledger.entries.length} step(s) green already ===`);
  for (const step of green) console.log(`skip ${step.label.padEnd(22)} digest ${step.digest}`);
  console.log(`${ledger.dir}\n${LEDGER_UNSEEN}`);
  planned = ledger.entries.filter((step) => !step.green);
}

const started = Date.now();

for (const step of planned) {
  console.log(`\n=== ${step.label} ===`);
  const at = Date.now();
  const { status, error } = spawnSync(step.argv[0], step.argv.slice(1), { cwd: ROOT, stdio: "inherit" });
  console.log(`\n--- ${step.label}: ${Math.round((Date.now() - at) / 1000)}s`);
  if (error || status !== 0) {
    console.error(`\nGate failed: ${step.label}${error ? ` (${error.message})` : ""} — the tree judged: ${ROOT}`);
    finish(status ?? 1);
  }
  if (ledger) recordPass(ledger.dir, step);
}

const elapsed = Math.round((Date.now() - started) / 1000);
const held = ledger?.entries.filter((step) => step.green).length ?? 0;
const spared = held > 0 ? ` (${held} the ledger already held)` : "";
console.log(`\nAll ${planned.length} gate step(s) passed in ${elapsed}s${spared} — the tree judged: ${ROOT}`);
finish(0);
