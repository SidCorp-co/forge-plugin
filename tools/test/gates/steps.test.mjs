/* The rules nothing else can catch: total coverage of the suite, and the shapes of table the
   runner is refused outright rather than handed (ISS-117). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { argvForTests, EVERYTHING, gateSteps, launcherOf, STEPS, TEST_FILE, testWorkers,
  WHOLE_TREE_TESTS } from "../../gates/steps.mjs";
import { derivationFiles, planFor, under } from "../../gates/scope.mjs";
import { escapesIn, stepEscapes } from "../../gates/reads/sets.mjs";
import { tempRoom } from "../../../plugin/test/fixtures.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const tracked = () =>
  execFileSync("git", ["-C", ROOT, "ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((one) => TEST_FILE.test(one));

const filesOf = (steps, label) => steps.find((step) => step.label === label).argv.filter((one) => TEST_FILE.test(one));

/* The rule the two-way split exists to keep: a file in neither half is a test nobody runs, and it
   reads exactly like a suite that passed. */
test("every test file git reports runs in exactly one step", () => {
  const found = tracked();
  assert.ok(found.length >= 50, `${found.length} test file(s) found; the selector matches nothing`);
  const steps = gateSteps(found);
  const tree = filesOf(steps, "test:tree");
  const rest = filesOf(steps, "test");
  assert.deepEqual([...tree, ...rest].sort(), [...found].sort());
  assert.deepEqual(tree.filter((one) => rest.includes(one)), []);
});

test("a step declaring no reads is refused, and the refusal names it", () => {
  STEPS.push({ label: "unread", reads: [] });
  try {
    assert.throws(() => gateSteps(tracked()), /step unread declares no reads/u);
  } finally {
    STEPS.pop();
  }
});

test("a claimed whole-tree read git reports nothing under is refused rather than dropped", () => {
  const gone = WHOLE_TREE_TESTS[0];
  const short = tracked().filter((one) => !under(one, gone));
  assert.throws(() => gateSteps(short), new RegExp(`git reports no test file at ${gone}`, "u"));
});

/* A claim by directory rather than by name, because the half that runs the rest declares it does
   not read `docs/`: a fourth document test named into it would skip on a docs-only edit. */
test("a document test added under checks/docs joins the half that reads the whole tree", () => {
  const found = [...tracked(), "plugin/test/checks/docs/a-fourth.test.mjs"];
  assert.ok(filesOf(gateSteps(found), "test:tree").includes("plugin/test/checks/docs/a-fourth.test.mjs"));
  for (const one of tracked().filter((path) => path.startsWith("plugin/test/checks/docs/"))) {
    assert.ok(filesOf(gateSteps(tracked()), "test:tree").includes(one), `${one} runs in the narrow half`);
  }
});

test("a test step whose half is empty is refused, because it would pass having run nothing", () => {
  assert.throws(() => gateSteps(WHOLE_TREE_TESTS), /step test matches no test file/u);
});

/* Both directions of ISS-1613, which reversed ISS-917's criterion 24: a case for the default alone
   would pass against a derivation that had been deleted. */
test("a test step spends the whole machine where this box declares no runs", () => {
  assert.equal(testWorkers({ cores: 6, declared: { value: null, from: "plugin" } }), 6);
});

test("the runs a box declares divide the cores its test step spends", () => {
  assert.equal(testWorkers({ cores: 6, declared: { value: 2, from: "project" } }), 3);
  assert.equal(testWorkers({ cores: 6, declared: { value: 4, from: "project" } }), 1);
});

test("a declaration above the core count still leaves a worker to run the step", () => {
  assert.equal(testWorkers({ cores: 6, declared: { value: 12, from: "project" } }), 1);
});

test("every test step spends the number this box's own declaration derives", () => {
  for (const step of gateSteps(tracked()).filter((one) => one.tests)) {
    assert.ok(step.argv.includes(`--test-concurrency=${testWorkers()}`),
      `${step.label} sizes its concurrency by something other than the declared runs: ${step.argv.slice(0, 4).join(" ")}`);
  }
});

/* Every step spends the npm script of its own name, so a renamed script is a red step rather than
   a silently missing one — and package.json stays the only place a command line is written. */
test("each script step names a script package.json defines", () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  for (const step of STEPS.filter((one) => !one.tests)) {
    assert.ok(scripts[step.label], `no npm script named ${step.label}, which the gate spends by name`);
  }
});

/* The other direction, which the runner's own refusals cannot reach: a gate script with no step in
   the table is not a red step, it is a check that stopped running, and the tree stays green. */
test("every script this repository gates with has a step, or is named as spent otherwise", () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const spendsItsScript = STEPS.filter((step) => !step.tests).map((step) => step.label);
  const otherwise = {
    check: "this runner",
    test: "the whole suite in one command, which the two test steps spend by file instead",
    version: "npm's own hook on a version bump",
    "sync:skills": "the writer sync:skills:check gates; running it would edit the tree",
    "generate:spec": "the writer check:spec gates, which a landing runs at a merged head rather than here",
  };
  for (const name of Object.keys(scripts)) {
    assert.ok(spendsItsScript.includes(name) || otherwise[name],
      `npm script ${name} is in no gate step and tools/gates/steps.mjs does not say why`);
  }
  for (const name of Object.keys(otherwise)) {
    assert.ok(scripts[name], `${name} is exempted here as ${otherwise[name]} and package.json has no such script`);
  }
});

// Every relative specifier counts, not the one form the runner's own modules happen to use.
test("the runner's own modules are found through every relative import form", () => {
  const room = tempRoom("derivation-");
  try {
    writeFileSync(join(room, "runner.mjs"), 'import "./bare.mjs";\nexport { one } from "./named.mjs";\n'
      + 'const late = () => import("./dynamic.mjs");\nexport const two = late;\n');
    for (const one of ["bare.mjs", "named.mjs", "dynamic.mjs"]) writeFileSync(join(room, one), "export const one = 1;\n");
    assert.deepEqual(derivationFiles(join(room, "runner.mjs"), room),
      ["bare.mjs", "dynamic.mjs", "named.mjs", "runner.mjs"]);
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

test("`.` claims the top-level files and no path below them", () => {
  assert.equal(under("package.json", "."), true);
  assert.equal(under("plugin/src/cli.mjs", "."), false);
  assert.equal(under("plugin", "plugin"), true);
  assert.equal(under("plugins/other.mjs", "plugin"), false);
});

/* Containment alone reads a walk of the root as inside `.`, which claims the files at that level and
   nothing under them: a ceiling answers for it anyway, keeping the walk in its own entry, and a step
   whose digest keys on the claim alone answers for nothing below (ISS-1911). */
test("a step claiming `.` has claimed the root's own level, and nothing that reaches below it", () => {
  const set = (key, one) => ({ paths: new Set(), dirs: new Set(), trees: new Set(), whole: new Set(),
    [key]: new Set([one]) });
  for (const key of ["paths", "dirs", "trees", "whole"]) {
    for (const one of [".", "docs"]) {
      assert.deepEqual(escapesIn(set(key, one), ["."]), [], `a ceiling answers for a ${key} of ${one}`);
    }
    assert.deepEqual(stepEscapes(set(key, "docs"), ["docs"]), [], `a claim naming docs covers its ${key}`);
  }
  for (const one of [".", "docs"]) assert.deepEqual(stepEscapes(set("paths", one), ["."]), []);
  assert.deepEqual(stepEscapes(set("dirs", "."), ["."]), [], "the names beside the files it claims");
  assert.deepEqual(stepEscapes(set("dirs", "docs"), ["."]), [{ kind: "listing", one: "docs" }]);
  assert.deepEqual(stepEscapes(set("trees", "."), ["."]), [{ kind: "walk", one: "." }]);
  assert.deepEqual(stepEscapes(set("whole", "docs"), ["."]), [{ kind: "content", one: "docs" }]);
});

/* A step reading everything must not swallow the widening: a new top-level directory has to arrive
   as a path no step claims, or the table decides in silence that nothing reads it. */
test("a new top-level directory belongs to no step", () => {
  const steps = STEPS.map((step) => ({ ...step }));
  assert.equal(planFor(steps, ["newdir/one.mjs"]).full, true);
  assert.equal(planFor(steps, ["docs/one.md"]).full, false);
  /* `eslint .` walks every root its config does not ignore, so a source file the table would
     otherwise place under a documents-only step still has to reach the lint step. */
  for (const path of ["root.mjs", "docs/one.mjs"]) {
    const reached = planFor(steps, [path]).steps.filter((step) => step.run).map((step) => step.label);
    assert.ok(reached.includes("lint"), `${path} reaches ${reached.join(", ")} and not lint`);
  }
  for (const name of EVERYTHING) {
    assert.ok(steps.some((step) => step.reads.includes(name)), `${name} is in EVERYTHING and no step reads it`);
  }
});

/* Each was measured to be read by a step that declared it nowhere, so a change to it skipped that
   step and the step's banked pass covered it either way (ISS-1911). */
test("each path a script step reads puts that step in the run", () => {
  const steps = STEPS.map((step) => ({ ...step }));
  for (const [path, label] of [["plugin/src/suggest.mjs", "check:skill-boundaries"],
    ["plugin/src/prose.mjs", "check:skill-figures"], [".gitignore", "check:spec"],
    ["plugin/src/markdown.mjs", "check:vi-goldens"]]) {
    const reached = planFor(steps, [path]).steps.filter((step) => step.run).map((step) => step.label);
    assert.ok(reached.includes(label), `${path} reaches ${reached.join(", ")} and not ${label}`);
  }
});

/* The ledger keys every step's digest on the root manifests, so the scope has to reach every step
   with them; one below the root is a path like any other, and reaches the steps that claim it (ISS-2564). */
test("a root manifest puts every step in the run, and one below the root only the steps claiming it", () => {
  const steps = STEPS.map((step) => ({ ...step }));
  for (const path of ["package.json", "package-lock.json"]) {
    const unreached = planFor(steps, [path]).steps.filter((step) => !step.run).map((step) => step.label);
    assert.deepEqual(unreached, [], `${path} leaves ${unreached.join(", ")} out of the run`);
  }
  const nested = planFor(steps, ["plugin/package.json"]).steps;
  assert.equal(nested.find((step) => step.label === "check:package").run, false);
  assert.equal(nested.find((step) => step.label === "check:dup").run, true);
});

/* Narrowing `reads` is the mistake the per-file selection may not make, and a test file in the
   launcher would key every record on which files happened to run beside it (ISS-654). */
test("a test step narrowed to fewer files keeps its reads, and its launcher names no test file", () => {
  const step = gateSteps(tracked()).find((one) => one.tests === "rest");
  const one = step.files[0];
  const narrowed = { ...step, files: [one], argv: argvForTests([one]) };
  assert.deepEqual(narrowed.reads, step.reads);
  assert.deepEqual(launcherOf(narrowed), launcherOf(step));
  assert.deepEqual(launcherOf(step).filter((each) => TEST_FILE.test(each)), []);
  assert.deepEqual(narrowed.argv.filter((each) => TEST_FILE.test(each)), [one]);
});

/* The key every per-file read set is stored under is digested off the launcher, so one naming the tree it
   stands in left every worktree spending all 290 test files off a record it shares and cannot read (ISS-1763). */
test("a launcher names a file of this tree by its repository path and content, and the tree nowhere", () => {
  const launcher = launcherOf(gateSteps(tracked()).find((one) => one.tests === "rest"));
  assert.deepEqual(launcher.filter((one) => one.includes(ROOT)), []);
  const reporters = launcher.filter((one) => one.includes("tools/gates/"));
  assert.equal(reporters.length, 2, `the launcher names ${reporters.length} file(s) of this tree`);
  for (const one of reporters) {
    assert.match(one, /^--test-reporter=tools\/gates\/reporters\/[\w.-]+\.mjs@[0-9a-f]{12}$/u);
  }
});

const treeWith = (at, name, text) => {
  const tree = join(at, name);
  mkdirSync(join(tree, "tools", "gates", "reporters"), { recursive: true });
  writeFileSync(join(tree, "tools", "gates", "reporters", "file-times.mjs"), text);
  return tree;
};

const stepIn = (tree, rel = "tools/gates/reporters/file-times.mjs") => ({
  files: ["plugin/test/one.test.mjs"],
  argv: [process.execPath, "--test", "--test-concurrency=3", `--test-reporter=${join(tree, rel)}`,
    "--test-reporter-destination=stdout", "plugin/test/one.test.mjs"],
});

const digestOf = (text) => createHash("sha256").update(text).digest("hex").slice(0, 12);

test("a launcher keeps every token naming no file of its tree, and gives the one that does its path and content", () => {
  const at = tempRoom("gate-launcher-");
  try {
    const launcher = launcherOf(stepIn(treeWith(at, "checkout", "the reporter\n")), join(at, "checkout"));
    assert.deepEqual(launcher, [process.execPath, "--test", "--test-concurrency=3",
      `--test-reporter=tools/gates/reporters/file-times.mjs@${digestOf("the reporter\n")}`,
      "--test-reporter-destination=stdout"]);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The two trees a wave really runs in: one commit, one content, and an argv differing in nothing but the
   root it is spelt from. Dropping that root alone would be worse than the cost it saves — a reporter one
   tree really changed, or a second file of the same bytes, would key as the one the record answers for. */
test("two trees of one content key alike, and a reporter differing in content or in path keys apart", () => {
  const at = tempRoom("gate-launcher-");
  try {
    const checkout = treeWith(at, "checkout", "the reporter\n");
    const worktree = treeWith(at, "worktree", "the reporter\n");
    assert.deepEqual(launcherOf(stepIn(worktree), worktree), launcherOf(stepIn(checkout), checkout));
    writeFileSync(join(worktree, "tools", "gates", "reporters", "other.mjs"), "the reporter\n");
    assert.notDeepEqual(launcherOf(stepIn(worktree, "tools/gates/reporters/other.mjs"), worktree),
      launcherOf(stepIn(checkout), checkout), "the same bytes at another repository path");
    writeFileSync(join(worktree, "tools", "gates", "reporters", "file-times.mjs"), "the reporter, moved\n");
    assert.notDeepEqual(launcherOf(stepIn(worktree), worktree),
      launcherOf(stepIn(checkout), checkout), "other bytes at the same repository path");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("every test step's declared files are exactly the test files on its own command line", () => {
  for (const step of gateSteps(tracked()).filter((one) => one.tests)) {
    assert.deepEqual(step.files, step.argv.filter((one) => TEST_FILE.test(one)), step.label);
  }
});
