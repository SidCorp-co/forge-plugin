/* The rules nothing else can catch: total coverage of the suite, and the shapes of table the
   runner is refused outright rather than handed (ISS-117). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { EVERYTHING, gateSteps, STEPS, TEST_FILE, WHOLE_TREE_TESTS } from "../../../tools/gates/steps.mjs";
import { planFor, under } from "../../../tools/gates/scope.mjs";

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

test("a named whole-tree test git does not report is refused rather than dropped", () => {
  const short = tracked().filter((one) => one !== WHOLE_TREE_TESTS[0]);
  assert.throws(() => gateSteps(short), new RegExp(`git reports no ${WHOLE_TREE_TESTS[0]}`, "u"));
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
  for (const name of EVERYTHING) {
    assert.ok(steps.some((step) => step.reads.includes(name)), `${name} is in EVERYTHING and no step reads it`);
  }
});
