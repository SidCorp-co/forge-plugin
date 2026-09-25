/* An assertion that passes whichever way the code went reads in a green suite exactly like one that
   guards something, and the audit of 2026-09-25 found three shapes of it with nothing refusing the
   next (ISS-2502). The tree case holds the suite to its standing count; each planted case is a shape
   the rule has to read, or an exemption it must not. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { vacuousIn, vacuousProblems } from "../../../src/checks/shapes/vacuous.mjs";
import { standingOf, standingProblems } from "../../../src/checks/shapes/standing.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const SUITE = join("plugin", "test");
const KEY = "vacuousAssertions";

const walked = () => readdirSync(join(ROOT, SUITE), { recursive: true }).map(String)
  .filter((one) => one.endsWith(".mjs"))
  .map((one) => ({ rel: join(SUITE, one), text: readFileSync(join(ROOT, SUITE, one), "utf8") }));

const planted = (text) => vacuousIn(text, "plugin/test/made-up.test.mjs");
const lines = (text) => planted(text).map(({ line, shape }) => `${line} ${shape}`);

test("the suite holds no more vacuous assertions than its standing count, and no fewer", () => {
  const files = walked();
  assert.ok(files.length > 400, `${files.length} file(s) under ${SUITE}; the walk reaches too little`);
  assert.ok(files.some((one) => one.rel === "plugin/test/tracker/rest.test.mjs"), "a nested file is not reached");
  const problems = vacuousProblems(files.flatMap((one) => vacuousIn(one.text, one.rel)));
  const config = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(standingProblems({ key: KEY, problems, standing: standingOf(config, KEY) }), []);
});

test("a disjunction a truthiness assert takes whole is named, grouped or not, with what to write instead", () => {
  const found = planted("assert.ok(a || b);\nassert((a || b), \"m\");\n");
  assert.deepEqual(found.map(({ line, shape }) => `${line} ${shape}`), ["1 disjunction", "2 disjunction"]);
  const said = vacuousProblems(found);
  assert.match(said[0], /^plugin\/test\/made-up\.test\.mjs:1 holds a disjunction inside a truthiness assert, /u);
  assert.match(said[0], /Instead, assert the one outcome the contract names/u);
});

test("a disjunction inside a callback, under a negation or in a comparison is not one the assert takes", () => {
  assert.deepEqual(lines("assert.ok(xs.some((x) => x.a || x.b));\nassert.ok(!(a || b));\nassert.equal(a || b, 1);\n"), []);
});

test("a truthiness assert on a stream or on what a child-running call answered is named", () => {
  const text = [
    'const gate = (command) => { const run = spawnSync("node", [command]); return run.stdout; };',
    'const out = gate("x");',
    "assert.ok(out);",
    'const run = spawnSync("node", ["y"]);',
    "assert.ok(run.stdout, \"it printed\");",
  ].join("\n");
  assert.deepEqual(lines(text), ["3 output", "5 output"]);
  assert.match(vacuousProblems(planted(text))[0], /the exit status, and the line the command was meant to print/u);
});

test("a truthiness assert on a found row, a regex match or a chain's last link is a precondition, not an output", () => {
  const text = [
    'const bare = (verb) => spawnSync("node", [verb]);',
    "const row = rows.find((one) => one.id === 1);",
    "assert.ok(row);",
    "const said = WROTE.exec(out);",
    "assert.ok(said);",
    'const line = bare("doctor").stdout.split("\\n").find(Boolean);',
    "assert.ok(line);",
  ].join("\n");
  assert.deepEqual(lines(text), []);
});

test("an assert inside a loop over an empty array is named, and one over an array the file fills is not", () => {
  const text = [
    "const STANDING = [];",
    "for (const one of STANDING) {",
    "  assert.ok(one.issue);",
    "}",
    "[].forEach((one) => assert.equal(one, 1));",
    "const held = [];",
    "held.push(1);",
    "for (const one of held) assert.ok(one);",
  ].join("\n");
  assert.deepEqual(lines(text), ["2 empty", "5 empty"]);
  assert.match(vacuousProblems(planted(text))[0], /assert the array's own length where empty is the contract/u);
});
