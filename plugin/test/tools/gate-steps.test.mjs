/* The rules nothing else can catch: total coverage of the suite, and the shapes of table the
   runner is refused outright rather than handed (ISS-117). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { EVERYTHING, gateSteps, STEPS, TEST_FILE, WHOLE_TREE_TESTS } from "../../../tools/gates/steps.mjs";
import { derivationFiles, planFor, under } from "../../../tools/gates/scope.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const tracked = () =>
  execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((one) => TEST_FILE.test(one));

const filesOf = (steps, label) => steps.find((step) => step.label === label).argv.slice(2);

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
  const labels = STEPS.map((step) => step.label);
  const otherwise = {
    check: "this runner",
    test: "the whole suite at once, which test:tree and test split between them",
    version: "npm's own hook on a version bump",
    "sync:skills": "the writer sync:skills:check gates; running it would edit the tree",
  };
  for (const name of Object.keys(scripts)) {
    assert.ok(labels.includes(name) || otherwise[name],
      `npm script ${name} is in no gate step and tools/gates/steps.mjs does not say why`);
  }
  for (const name of Object.keys(otherwise)) {
    assert.ok(scripts[name], `${name} is exempted here as ${otherwise[name]} and package.json has no such script`);
  }
});

// Every relative specifier counts, not the one form the runner's own modules happen to use.
test("the runner's own modules are found through every relative import form", () => {
  const room = mkdtempSync(join(tmpdir(), "derivation-"));
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
