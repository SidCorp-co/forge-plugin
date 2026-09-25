/* An export only tests import proves a path the product never takes: `promptFor` beside the
   `openingFor` production sends, and the `forget*` resets (ISS-2502). `dead-exports.mjs` counts a
   test as a caller, so this reads the same graph without the tests. The tree case holds the
   repository to its standing count; the planted ones are each a graph read the right way round. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { CHECKERS, isTest, testOnlyExports, testOnlyProblems } from "../../../src/checks/shapes/test-only.mjs";
import { standingOf, standingProblems } from "../../../src/checks/shapes/standing.mjs";
import { harnessLoads } from "../../../src/checks/surface/dead-exports.mjs";
import { hookRoots } from "../../../src/checks/surface/eager-load.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const SKIPPED = new Set(["node_modules", ".git"]);
const KEY = "testOnlyExports";

/* A production importer anywhere in the repository keeps a name alive, so the walk is the whole tree. */
const walked = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((one) => {
  if (one.isDirectory()) return SKIPPED.has(one.name) ? [] : walked(join(dir, one.name));
  return /\.(?:mjs|js)$/u.test(one.name) ? [relative(ROOT, join(ROOT, dir, one.name))] : [];
});

const names = (entries) => testOnlyExports(new Map(Object.entries(entries)))
  .map(({ where, line, name }) => `${where}:${line} ${name}`).sort();

test("the repository holds no more test-only exports than its standing count, and no fewer", () => {
  const files = new Map(walked(".").map((one) => [one, readFileSync(join(ROOT, one), "utf8")]));
  assert.ok([...files.keys()].filter(isTest).length > 400, "the walk reaches too few test files");
  const { roots } = hookRoots(readFileSync(join(ROOT, "plugin", "hooks", "hooks.json"), "utf8"), [...files.keys()]);
  const problems = testOnlyProblems(testOnlyExports(files, { loaded: harnessLoads(files, roots) }));
  const config = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(standingProblems({ key: KEY, problems, standing: standingOf(config, KEY) }), []);
});

test("an export only a test imports is named by file, line and name, with the production caller to go through", () => {
  const found = testOnlyExports(new Map(Object.entries({
    "plugin/src/m.mjs": "export const sent = 1;\n\nexport const twin = 2;\n",
    "plugin/src/caller.mjs": 'import { sent } from "./m.mjs";\nexport const out = sent;\n',
    "plugin/test/m.test.mjs": 'import { sent, twin } from "../src/m.mjs";\n',
    "tools/use.mjs": 'import { out } from "../plugin/src/caller.mjs";\n',
  })));
  const said = testOnlyProblems(found);
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /^plugin\/src\/m\.mjs:3 exports `twin`, and every file importing it is a test/u);
  assert.match(said[0], /Prove the behaviour through the production caller the export should go through/u);
});

test("a name its own module reads, one nothing imports and a checker's own export are not test-only", () => {
  assert.deepEqual(names({
    "plugin/src/m.mjs": "export const unit = (x) => x;\nexport const run = () => unit(1);\nexport const nobody = 3;\n",
    [`${CHECKERS}rule.mjs`]: "export const rule = () => [];\n",
    "plugin/test/m.test.mjs": 'import { unit, run } from "../src/m.mjs";\nimport { rule } from "../src/checks/rule.mjs";\n',
    "tools/use.mjs": 'import { run } from "../plugin/src/m.mjs";\n',
  }), []);
});

test("a re-export only tests reach through is named at the barrel's clause, its source being reached by the barrel", () => {
  assert.deepEqual(names({
    "plugin/src/m.mjs": "export const deep = 1;\nexport const used = 2;\n",
    "plugin/hooks/_hook.mjs": 'export { deep, used } from "../src/m.mjs";\n',
    "plugin/hooks/gate.mjs": 'import { used } from "./_hook.mjs";\nused;\n',
    "plugin/test/hook.test.mjs": 'import { deep } from "../hooks/_hook.mjs";\n',
  }), ["plugin/hooks/_hook.mjs:1 deep"]);
});
