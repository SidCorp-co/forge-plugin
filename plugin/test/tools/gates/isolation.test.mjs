/* What a failing case is written down as and re-run by. The unit is node's, not ours: a pattern
   naming a nested leaf alone selects nothing, so the two cases at the end are what the runner's
   whole choice of unit rests on and they fail if node's selection ever changes (ISS-907). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { argvFor, casesFrom, CASES_ENV, HUMAN_REPORTER, patternFor } from "../../../../tools/gates/isolation.mjs";
import { tempRoom } from "../../fixtures.mjs";

const REPORTER = join(process.cwd(), "tools", "gates", "isolation.mjs");

const NESTED = `import test from "node:test";
test("outer (the enclosing one)", async (t) => {
  await t.test("inner leaf", () => { throw new Error("boom"); });
});
test("flat and green", () => {});
`;

// Without it a `node --test` spawned from a test file runs as this suite's child and spends no file.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT"));

const ran = (room, argv, env = {}) =>
  spawnSync(process.execPath, argv, { cwd: room, encoding: "utf8", env: { ...ENV, ...env } });

const withNested = (name) => {
  const room = tempRoom(name);
  writeFileSync(join(room, "nested.test.mjs"), NESTED);
  return room;
};

const reported = (room, ...files) => {
  const at = join(room, "failed");
  ran(room, ["--test", "--test-concurrency=1", `--test-reporter=${REPORTER}`,
    "--test-reporter-destination=stdout", ...files], { [CASES_ENV]: at });
  return { at, said: readFileSync(at, "utf8") };
};

test("a name holding regex metacharacters is escaped and anchored, so it selects itself alone", () => {
  assert.equal(patternFor("a (dense) write, on the $clock"),
    "^a \\(dense\\) write, on the \\$clock$");
  assert.equal(patternFor("plain name"), "^plain name$");
});

test("a case is re-run with one concurrency, node's own reporter and nothing that writes a record", () => {
  const argv = argvFor({ file: "plugin/test/one.test.mjs", name: "the case", whole: false, inside: [] });
  assert.deepEqual(argv, [process.execPath, "--test", "--test-concurrency=1",
    `--test-reporter=${HUMAN_REPORTER}`, "--test-reporter-destination=stdout",
    "--test-name-pattern=^the case$", "plugin/test/one.test.mjs"]);
});

test("a case whose name is its own file is re-run as the whole file, with no pattern", () => {
  const argv = argvFor({ file: "plugin/test/one.test.mjs", name: "plugin/test/one.test.mjs", whole: true, inside: [] });
  assert.ok(!argv.some((one) => one.startsWith("--test-name-pattern")), argv.join(" "));
  assert.equal(argv.at(-1), "plugin/test/one.test.mjs");
});

test("a step that named no case reads back as nothing to attribute, not as a step with nothing wrong", () => {
  const room = tempRoom("isolation-none-");
  try {
    assert.equal(casesFrom(join(room, "never-written")), null);
    writeFileSync(join(room, "counted-only"), JSON.stringify({ passed: 4, failed: 0 }));
    assert.equal(casesFrom(join(room, "counted-only")), null);
    writeFileSync(join(room, "torn"), "{not json");
    assert.equal(casesFrom(join(room, "torn")), null);
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

/* A record cut short declares more failures than it holds, and attributing the survivor would let
   the case that was lost through unread — so the count is compared and the step refused instead. */
test("a record holding fewer cases than it declares is refused rather than partly attributed", () => {
  const room = tempRoom("isolation-truncated-");
  const one = { file: "plugin/test/one.test.mjs", name: "the case that survived", whole: false, inside: [] };
  try {
    writeFileSync(join(room, "short"), `${JSON.stringify({ passed: 4, failed: 2 })}\n${JSON.stringify(one)}`);
    assert.equal(casesFrom(join(room, "short")), null);
    writeFileSync(join(room, "shapeless"), `${JSON.stringify({ passed: 4, failed: 1 })}\n${JSON.stringify({ file: 7 })}`);
    assert.equal(casesFrom(join(room, "shapeless")), null);
    writeFileSync(join(room, "whole"), `${JSON.stringify({ passed: 4, failed: 1 })}\n${JSON.stringify(one)}`);
    assert.equal(casesFrom(join(room, "whole")).cases.length, 1);
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

test("a nested failure is written down as its enclosing test, carrying the leaf that failed", () => {
  const room = withNested("isolation-nested-");
  try {
    const { at } = reported(room, "nested.test.mjs");
    const found = casesFrom(at);
    assert.equal(found.cases.length, 1, JSON.stringify(found));
    assert.equal(found.cases[0].name, "outer (the enclosing one)");
    assert.deepEqual(found.cases[0].inside, ["inner leaf"]);
    assert.equal(found.cases[0].whole, false);
    assert.equal(found.counted.passed, 1, "the flat green one, the enclosing failure not counted as a pass");
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

test("a file that fails to load is written down as itself, so its re-run is the whole file", () => {
  const room = tempRoom("isolation-unloadable-");
  try {
    writeFileSync(join(room, "broken.test.mjs"), "import nothing from \"no-such-module-at-all\";\n");
    const found = casesFrom(reported(room, "broken.test.mjs").at);
    assert.equal(found.cases.length, 1, JSON.stringify(found));
    assert.equal(found.cases[0].whole, true, JSON.stringify(found.cases[0]));
    assert.ok(!argvFor(found.cases[0]).some((one) => one.startsWith("--test-name-pattern")));
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

test("node runs a nested case when its enclosing test is the pattern, which is why that is the unit", () => {
  const room = withNested("isolation-selects-");
  try {
    const said = ran(room, ["--test", "--test-reporter=tap", "--test-reporter-destination=stdout",
      `--test-name-pattern=${patternFor("outer (the enclosing one)")}`, "nested.test.mjs"]);
    assert.match(said.stdout, /inner leaf/u, said.stdout);
    assert.equal(said.status, 1, "the enclosing pattern reached the failing leaf");
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

test("node runs nothing when a nested leaf's own name is the pattern, so a leaf may not be the unit", () => {
  const room = withNested("isolation-leaf-");
  try {
    const said = ran(room, ["--test", "--test-reporter=tap", "--test-reporter-destination=stdout",
      `--test-name-pattern=${patternFor("inner leaf")}`, "nested.test.mjs"]);
    assert.equal(said.status, 0, `a leaf-only pattern selected something: ${said.stdout}`);
    assert.match(said.stdout, /# fail 0/u, said.stdout);
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});
