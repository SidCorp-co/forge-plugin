/* The runner, on a scratch checkout of its own: what it runs, what it skips, and the two trees it
   refuses to answer about. A gate aimed at the wrong tree does not fail, it certifies, and a step
   the scoping dropped by mistake reads exactly like a step that passed (ISS-117). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";

import { STEPS, gateSteps } from "../../../tools/gates/steps.mjs";
import { REVIEW } from "../../../tools/gates/timing.mjs";
import { tempRoom } from "../fixtures.mjs";
import { entries, entryDir, entryNames, git, landed, NAMED, passesDir, passesFor, ROOT, RUNNER, run,
  runs, runsFile, scratch, SHELL_ENV, STAMPED, touchedEverywhere, write } from "./gates/scratch.mjs";

/* Seconds no step of this scratch ever takes, over the digest each entry already holds. Without it
   a run that spent every step and then recorded over them leaves the same bytes, since every step
   here is `node -e ""` and passes in the same 0s (ISS-396). */
const PLANTED = 4242;

const plantSeconds = (work) => {
  for (const name of entryNames(work)) {
    const at = join(passesDir(work), name);
    const [digest, , label] = readFileSync(at, "utf8").trim().split(" ");
    writeFileSync(at, `${digest} ${PLANTED}s ${label}\n`);
  }
};

const everyStepRan = (said) => new RegExp(`All ${STEPS.length} gate step\\(s\\) passed`, "u").test(said.stdout);

/* Falling with the table, so cheapest-first is the table read backwards and no run could reach that
   order by accident; the two cheapest share a figure, where a stable sort is watched (ISS-358). */
const COSTS = new Map(STEPS.map((step, nth) => [step.label, Math.max(2, STEPS.length - nth) * 10]));
// One entry stripped to the form written before the record kept seconds, one removed: both no figure.
const LEGACY = STEPS.at(2).label;
const ABSENT = STEPS.at(4).label;

const plantCosts = (work) => {
  for (const name of entryNames(work)) {
    const at = join(passesDir(work), name);
    const [digest, , label] = readFileSync(at, "utf8").trim().split(" ");
    if (label === ABSENT) rmSync(at);
    else writeFileSync(at, label === LEGACY ? `${digest} ${label}\n` : `${digest} ${COSTS.get(label)}s ${label}\n`);
  }
};

const TIMED = STEPS.map((step) => step.label).filter((label) => label !== LEGACY && label !== ABSENT);
const CHEAPEST_FIRST = [...TIMED.slice(-2), ...TIMED.slice(0, -2).reverse(), LEGACY, ABSENT];

const spentIn = (said) => [...said.matchAll(/^=== (\S+) ===$/gmu)].map((one) => one[1]);
const orderBlock = (said) => said.split("=== order:").at(1).split("\n\n")[0].split("\n").slice(1);
const orderedIn = (said) => orderBlock(said).map((line) => line.trim().split(/\s+/u)[0]);

test("-h names the two flags and what the record cannot see", () => {
  const said = run(ROOT.replace(/\/$/u, ""), ["-h"]).stdout;
  for (const one of ["--full", "--anyway", "node_modules", "merge-base", "tree judged",
    "seconds that step took", "one line per green run", "a temporary directory of this run's own",
    "a path no step claims", "leaves the record", "records no pass",
    "decide the order the steps are spent in: cheapest first", "no seconds for",
    "one-minute load", "ceiling that review set", "<label>-files", `${REVIEW.seconds}s on ${REVIEW.on}`,
    "re-runs each of them once, alone", "the gate refuses and names it",
    "has not been shown to be this tree's", "One re-run per case and never a loop",
    "suite-interaction finding", "a step that failed records no pass",
    "A suite-interaction finding files an issue, and refuses nothing",
    "exactly what it would have been with no recurrence in it",
    "comments on that case's issue rather than filing again",
    "searching the backlog for that marker and matching it in a title",
    "An issue somebody has closed or dropped", "does not come back whole files nothing",
    "leaves the run's status alone", "sends no request"]) {
    assert.ok(said.includes(one), `${one} is not in the usage:\n${said}`);
  }
});

test("a docs-only change runs the steps that read docs and no others", () => {
  const { at, work } = scratch("scoped");
  try {
    landed(work, "docs/two.md", "a second document\n");
    const first = run(work);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /run {2}test:tree/u, first.stdout);
    assert.match(first.stdout, /skip check:dup\s+nothing it reads changed/u, first.stdout);
    assert.ok(!first.stdout.includes("=== check:dup ==="), `a step nothing reached was spent:\n${first.stdout}`);
    assert.match(first.stdout, new RegExp(`the tree judged: ${work}`, "u"), first.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a path no step claims widens the run, and says which path", () => {
  const { at, work } = scratch("stranger");
  try {
    landed(work, "newdir/one.mjs", "export const one = 1;\n");
    const said = run(work).stdout;
    assert.match(said, /the full gate — newdir\/one\.mjs belongs to no gate step/u, said);
    assert.match(said, /=== check:dup ===/u, said);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The widening is only half a guard while the record is read after it: no step keys a digest on a
   path no step claims, so every step the widening added comes straight back green and the run
   spends nothing. The case above cannot see it — a scratch checkout's record is empty (ISS-396). */
test("a path no step claims leaves the record unread, and that run records no pass", () => {
  const { at, work } = scratch("stranger-record");
  try {
    touchedEverywhere(work, "one");
    assert.equal(run(work).status, 0);
    assert.equal(entryNames(work).length, STEPS.length, "the record does not answer for every step yet");
    plantSeconds(work);
    const held = entries(work);

    landed(work, "newdir/one.mjs", "export const one = 1;\n");
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, /=== ledger: digests not read — no step claims newdir\/one\.mjs/u, said.stdout);
    assert.match(said.stdout, /Claim the path in tools\/gates\/steps\.mjs/u, said.stdout);
    assert.ok(!said.stdout.includes("green already"), `the record was read:\n${said.stdout}`);
    assert.ok(everyStepRan(said), said.stdout);
    assert.deepEqual(entries(work), held, "a run the record could not vouch for wrote to it");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The derivation return comes first, so a diff holding both would carry no marker if the search
   for one sat inside planFor: the first run spends everything for the derivation's sake and the
   second is handed it all back, with the unclaimed path covered by neither. */
test("a diff holding a runner module and a path no step claims leaves the record unread on every run", () => {
  const { at, work } = scratch("mixed");
  try {
    touchedEverywhere(work, "one");
    assert.equal(run(work).status, 0);
    landed(work, join("tools", "gates", "scope.mjs"),
      `${readFileSync(join(ROOT, "tools", "gates", "scope.mjs"), "utf8")}\n`);
    landed(work, "newdir/one.mjs", "export const one = 1;\n");

    const first = run(work);
    assert.ok(everyStepRan(first), first.stdout);
    const again = run(work);
    assert.match(again.stdout, /the full gate — tools\/gates\/scope\.mjs decides what a run may skip/u, again.stdout);
    assert.match(again.stdout, /=== ledger: digests not read — no step claims newdir\/one\.mjs/u, again.stdout);
    assert.ok(everyStepRan(again), again.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

// No answer about what changed is not the answer that nothing did, and the record can vouch for
// neither: it covers what the steps read, and this run never learned which of those paths moved.
test("a run that can compute no merge base leaves the record unread", () => {
  const { at, work } = scratch("orphan");
  try {
    touchedEverywhere(work, "one");
    assert.equal(run(work).status, 0);
    plantSeconds(work);
    const held = entries(work);

    git(work, "checkout", "--orphan", "alone");
    git(work, "commit", "-m", "no history shared with master");
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, /the full gate — no merge base between HEAD and master/u, said.stdout);
    assert.match(said.stdout, /=== ledger: digests not read — no merge base between HEAD and master/u, said.stdout);
    assert.ok(everyStepRan(said), said.stdout);
    assert.deepEqual(entries(work), held, "a run the record could not vouch for wrote to it");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* `gitOut` answers null for a command that failed and `lines(null)` is `[]`, so a listing git
   would not give reads as a tree where nothing moved — and that is the one widening allowed to
   keep the record. A git on PATH refusing one subcommand is the only way to watch this fire. */
test("a listing git refuses is not read as a tree where nothing moved", () => {
  const { at, work } = scratch("refused");
  try {
    touchedEverywhere(work, "one");
    assert.equal(run(work).status, 0);
    plantSeconds(work);
    const held = entries(work);

    const bin = join(at, "bin");
    mkdirSync(bin, { recursive: true });
    const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
    writeFileSync(join(bin, "git"), `#!/bin/sh\nif [ "$1" = "diff" ]; then exit 1; fi\nexec ${real} "$@"\n`);
    chmodSync(join(bin, "git"), 0o755);
    const said = spawnSync(process.execPath, [join(work, RUNNER)],
      { cwd: work, encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, /=== ledger: digests not read — git diff --name-only \S+ was refused/u, said.stdout);
    assert.ok(everyStepRan(said), said.stdout);
    assert.deepEqual(entries(work), held, "a run the record could not vouch for wrote to it");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The widening the record keeps, and the reason the three above are told apart from it rather than
   from `full`: this is the re-run every landed commit makes, and opening the record here spends
   the whole gate on all of them. */
test("a run widened because nothing differs from the branch still reads the record", () => {
  const { at, work } = scratch("settled");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    git(work, "checkout", "master");
    git(work, "merge", "work");

    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, /the full gate — nothing differs from master/u, said.stdout);
    assert.match(said.stdout, /=== ledger: [1-9]\d* of \d+ step\(s\) green already ===/u, said.stdout);
    assert.match(said.stdout, /skip lint {19}digest [0-9a-f]{12}/u, said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a change to what decides the scoping widens the run", () => {
  const { at, work } = scratch("derivation");
  try {
    landed(work, join("tools", "gates", "scope.mjs"), `${readFileSync(join(ROOT, "tools", "gates", "scope.mjs"), "utf8")}\n`);
    const said = run(work).stdout;
    assert.match(said, /the full gate — tools\/gates\/scope\.mjs decides what a run may skip/u, said);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a step whose inputs have not moved since it passed is skipped by digest, and one that moved is run", () => {
  const { at, work } = scratch("ledger");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    const again = run(work);
    assert.match(again.stdout, /=== ledger: \d+ of \d+ step\(s\) green already ===/u, again.stdout);
    assert.match(again.stdout, /skip lint {19}digest [0-9a-f]{12}/u, again.stdout);
    assert.match(again.stdout, /All 0 gate step\(s\) passed/u, again.stdout);

    landed(work, "plugin/src/two.mjs", "export const two = 22;\n");
    const moved = run(work);
    assert.match(moved.stdout, /=== lint ===/u, moved.stdout);
    assert.equal(moved.status, 0, moved.stdout + moved.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The suite executes files of this repository, so a mode alone decides a verdict: a digest over the
   bytes would schedule the step and then hand it the last pass's answer. */
test("a mode change alone is not a step the record calls green", () => {
  const { at, work } = scratch("mode");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    chmodSync(join(work, "plugin/src/two.mjs"), 0o755);
    git(work, "add", "-A");
    git(work, "commit", "-m", "made it executable");
    const said = run(work);
    assert.match(said.stdout, /=== lint ===/u, said.stdout);
    assert.ok(!said.stdout.includes("skip lint "), `the record answered for a mode it never hashed:\n${said.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

// A digest reading a gitlink as absent holds one answer across every revision of the submodule.
test("a gitlink is refused rather than hashed as absent", () => {
  const { at, work } = scratch("gitlink");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    const sha = git(work, "rev-parse", "HEAD").stdout.trim();
    git(work, "update-index", "--add", "--cacheinfo", `160000,${sha},plugin/sub`);
    mkdirSync(join(work, "plugin", "sub"), { recursive: true });
    git(work, "commit", "-m", "the submodule");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, /cannot read its own record: git reports \S+\/plugin\/sub as a file/u, said.stderr);
    assert.match(said.stderr, /--full/u, said.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a red step records nothing, and the failing verdict names the tree", () => {
  const { at, work } = scratch("red", "lint");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: lint — the tree judged: ${work}`, "u"), said.stderr);
    assert.deepEqual(passesFor(work, "lint"), [], "a step that failed was recorded as passed");
    assert.deepEqual(passesFor(work, "test"), [], "a step the run never reached was recorded as passed");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a step that leaves hook stamps in the temp root it was handed is refused, and records nothing", () => {
  const { at, work } = scratch("stamps", null, "lint");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: lint — the tree judged: ${work}`, "u"), said.stderr);
    assert.match(said.stderr, new RegExp(`left 1 hook stamp\\(s\\) in \\S+/${STAMPED}`, "u"), said.stderr);
    assert.match(said.stderr, /plugin\/test\/fixtures\.mjs/u, said.stderr);
    assert.deepEqual(passesFor(work, "lint"), [], "a step that filled a stamp room was recorded as passed");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("--full runs every step whatever the diff and the record say", () => {
  const { at, work } = scratch("full");
  try {
    landed(work, "docs/two.md", "a second document\n");
    assert.equal(run(work).status, 0);
    const held = entries(work);
    const said = run(work, ["--full"]);
    assert.ok(!said.stdout.includes("=== ledger:"), `--full read the record:\n${said.stdout}`);
    for (const step of STEPS) assert.ok(said.stdout.includes(`=== ${step.label} ===`), `${step.label} did not run`);
    assert.deepEqual(entries(work), held, "a --full run wrote a pass, and it is the run that trusts none of them");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The table's order was written by hand and the record already knew what each step costs, so a tree
   about to fail a one-second step waited behind an eight-minute one to hear it (ISS-358). */
test("the steps are spent cheapest first by the record, a step with no figure last, under --full too", () => {
  const { at, work } = scratch("order");
  try {
    touchedEverywhere(work, "one");
    assert.equal(run(work).status, 0);
    assert.equal(entryNames(work).length, STEPS.length, "the record does not answer for every step yet");
    plantCosts(work);

    /* --full first: it records no pass, so the planted figures survive it for the scoped run below. */
    const whole = run(work, ["--full"]);
    assert.equal(whole.status, 0, whole.stdout + whole.stderr);
    assert.deepEqual(spentIn(whole.stdout), CHEAPEST_FIRST, `--full spent the table's order:\n${whole.stdout}`);

    touchedEverywhere(work, "two");
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.deepEqual(spentIn(said.stdout), CHEAPEST_FIRST, `the steps were spent in another order:\n${said.stdout}`);
    // The block a reader is given before the wait, against what the run then did with it.
    assert.deepEqual(orderedIn(said.stdout), CHEAPEST_FIRST, `the order printed is not the order spent:\n${said.stdout}`);
    for (const label of [LEGACY, ABSENT]) {
      const line = orderBlock(said.stdout).find((one) => one.trim().split(/\s+/u)[0] === label);
      assert.match(line, /no figure recorded, so last/u, `${label} has no figure and the run does not say so`);
    }
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* Ordering is about which spent step goes first, and what these widenings withhold trust from is the
   digests, which decide whether a step is spent at all — so the seconds are still read here. */
test("a run that may not read the digests is ordered by the seconds all the same", () => {
  const { at, work } = scratch("order-unread");
  try {
    touchedEverywhere(work, "one");
    assert.equal(run(work).status, 0);
    plantCosts(work);
    const held = entries(work);

    landed(work, "newdir/one.mjs", "export const one = 1;\n");
    const said = run(work);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, /=== ledger: digests not read — no step claims newdir\/one\.mjs/u, said.stdout);
    assert.deepEqual(spentIn(said.stdout), CHEAPEST_FIRST, `a widened run spent the table's order:\n${said.stdout}`);
    assert.deepEqual(entries(work), held, "a run the record could not vouch for wrote to it");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* More than one session stands in the shared checkout, so its uncommitted paths may be another
   agent's. A worktree is the opposite case: its uncommitted work is the point of having one. */
test("the dirty shared checkout is refused, --anyway gates it and says so at both ends", () => {
  const { at, work } = scratch("dirty");
  try {
    landed(work, "docs/two.md", "a second document\n");
    write(work, "docs/three.md", "not committed\n");
    const refused = run(work);
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stderr, /docs\/three\.md/u, refused.stderr);
    assert.match(refused.stderr, /node tools\/run\.mjs start <ISS-nn>/u, refused.stderr);

    const anyway = run(work, ["--anyway"]);
    assert.equal(anyway.status, 0, anyway.stdout + anyway.stderr);
    const banners = anyway.stdout.match(/asked for with --anyway/gu) ?? [];
    assert.equal(banners.length, 2, `the opt-in is named ${banners.length} time(s), not at both ends`);
    // A count is not the paths, and the run's reader is the one who has to recognise them as theirs.
    assert.match(anyway.stdout.split("=== scope:")[0], /asked for with --anyway\n {4}docs\/three\.md/u, anyway.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a worktree is never refused for its uncommitted paths", () => {
  const { at, work } = scratch("worktree");
  try {
    const tree = join(at, "wt");
    git(work, "worktree", "add", tree, "-b", "other");
    write(tree, "docs/three.md", "not committed\n");
    const said = spawnSync(process.execPath, [join(tree, RUNNER)], { cwd: tree, encoding: "utf8" });
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, new RegExp(`the tree judged: ${tree}`, "u"), said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("another tree's copy of the runner is refused rather than answered about that tree", () => {
  const { at, work } = scratch("cross");
  try {
    const tree = join(at, "wt");
    git(work, "worktree", "add", tree, "-b", "other");
    const said = run(work, [], tree);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`standing in ${tree}`, "u"), said.stderr);
    assert.match(said.stderr, new RegExp(`node ${join(tree, RUNNER)}`, "u"), said.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The gate measured the whole run and every step and the process took both with it, so the question
   "has this gate grown" had nothing to subtract and the first review of it would have had to plant
   its own baseline by hand (ISS-166). */
test("a pass records the seconds it took, the skip line says them, and an older entry still passes", () => {
  const { at, work } = scratch("seconds");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    const [at] = passesFor(work, "lint");
    const entry = readFileSync(at, "utf8").trim();
    assert.match(entry, /^[0-9a-f]{12} \d+s lint$/u, `the pass carries no seconds: ${entry}`);

    const again = run(work);
    assert.match(again.stdout, /skip lint {19}digest [0-9a-f]{12}, \d+s when it passed/u, again.stdout);

    // The form written before seconds were kept: it names a pass, and reading it as a miss re-runs
    // every step in the repository the day the release lands.
    writeFileSync(at, `${entry.replace(/ \d+s /u, " ")}\n`);
    const older = run(work);
    assert.match(older.stdout, /skip lint {19}digest [0-9a-f]{12}, passing before this record kept seconds/u,
      `an entry without seconds read as a miss:\n${older.stdout}`);
    assert.ok(!older.stdout.includes("=== lint ==="), `the step ran anyway:\n${older.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a green run records its whole-run seconds and how many steps it spent; a red run records none", () => {
  const { at, work } = scratch("series");
  try {
    landed(work, "docs/two.md", "a second document\n");
    const scoped = run(work);
    assert.equal(scoped.status, 0, scoped.stdout + scoped.stderr);
    assert.equal(runs(work).length, 1, `one green run left ${runs(work).length} figure(s)`);
    assert.match(runs(work)[0], new RegExp(`^\\S+ \\d+s 3/${STEPS.length} load \\d+\\.\\d\\d/\\d+$`, "u"), runs(work)[0]);
    /* What it wrote and nothing the record now says: the comparison has one reader, the release,
       and the gate printing it too is the second surface the issue exists to remove. Anchored at
       both ends, so a clause about an earlier run is a failure rather than a longer pass. */
    const receipts = scoped.stdout.split("\n").filter((one) => one.startsWith("recorded:"));
    assert.equal(receipts.length, 1, `the gate printed ${receipts.length} timing line(s):\n${scoped.stdout}`);
    assert.match(receipts[0],
      new RegExp(`^recorded: \\d+s over 3 of ${STEPS.length} step\\(s\\) on \\d{4}-\\d\\d-\\d\\d, load \\d+\\.\\d on \\d+ core\\(s\\) — \\S+/runs$`, "u"),
      receipts[0]);

    /* One test file that spends its time before its first case and after its last: both halves are
       the file's cost, and the per-file record has to carry them (ISS-736). */
    landed(work, "plugin/test/tools/slow.test.mjs", "import { after, test } from \"node:test\";\n"
      + "await new Promise((wake) => setTimeout(wake, 300));\ntest(\"slow\", () => {});\n"
      + "after(async () => { await new Promise((wake) => setTimeout(wake, 300)); });\n");
    const whole = run(work, ["--full"]);
    assert.equal(whole.status, 0, whole.stdout + whole.stderr);
    assert.equal(runs(work).length, 2, "a --full run left no figure, and it is the comparable one");
    assert.match(runs(work)[1], new RegExp(`^\\S+ \\d+s ${STEPS.length}/${STEPS.length} load \\d+\\.\\d\\d/\\d+$`, "u"), runs(work)[1]);

    assert.ok(existsSync(join(entryDir(work), "test-files")),
      `the test step left no per-file record; the ledger holds ${entryNames(work).join(", ")}:\n${whole.stdout}`);
    const costs = readFileSync(join(entryDir(work), "test-files"), "utf8").trim().split("\n");
    const seconds = costs.map((one) => Number(one.split(" ")[0].slice(0, -1)));
    assert.deepEqual(seconds, [...seconds].sort((one, other) => other - one), `not longest first:\n${costs.join("\n")}`);
    assert.match(costs[0], /^\d+\.\ds plugin\/test\/tools\/slow\.test\.mjs$/u, `the slow file is not the first line:\n${costs.join("\n")}`);
    assert.ok(seconds[0] >= 0.6, `the file's setup and teardown are not in its ${seconds[0]}s`);
    assert.equal(costs.length, 2, `one line per file the step ran:\n${costs.join("\n")}`);
    assert.ok(existsSync(join(entryDir(work), "test-tree-files")), "the whole-tree step left no per-file record");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a test step runs on every core with node's own reporter, the per-file one and the failing-case one", () => {
  const [tree, rest] = gateSteps([...NAMED, "plugin/test/tools/one.test.mjs"]).filter((step) => step.tests);
  const ours = (name) => `--test-reporter=${join(ROOT, "tools", "gates", name)}`;
  for (const step of [tree, rest]) {
    const flags = step.argv.slice(2, 9);
    assert.deepEqual(flags, [`--test-concurrency=${availableParallelism()}`,
      `--test-reporter=${process.stdout.isTTY ? "spec" : "tap"}`, "--test-reporter-destination=stdout",
      ours("file-times.mjs"), "--test-reporter-destination=stdout",
      ours("isolation.mjs"), "--test-reporter-destination=stdout"], step.label);
    assert.ok(step.argv.slice(9).every((one) => one.endsWith(".test.mjs")), `the files follow the flags: ${step.argv.join(" ")}`);
  }
});

test("a per-file record that cannot be written is said, and the passing step stays green", () => {
  const at = tempRoom("file-times-");
  write(at, "one.test.mjs", "import test from \"node:test\";\ntest(\"one\", () => {});\n");
  const argv = gateSteps([...NAMED, "plugin/test/tools/one.test.mjs"]).find((step) => step.label === "test").argv;
  const flags = argv.slice(1, 7);
  const said = spawnSync(process.execPath, [...flags, "one.test.mjs"],
    { cwd: at, encoding: "utf8", env: { ...SHELL_ENV, GATE_FILE_TIMES: at } });
  assert.equal(said.status, 0, said.stdout + said.stderr);
  assert.match(said.stdout, /# the per-file seconds could not be recorded at \S+: EISDIR/u, said.stdout);
  rmSync(at, { recursive: true, force: true });
});

test("a run whose step failed leaves no figure", () => {
  const { at, work } = scratch("no-figure", "lint");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 1);
    assert.ok(!existsSync(runsFile(work)), "the seconds spent reaching a failure were recorded as a run");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

