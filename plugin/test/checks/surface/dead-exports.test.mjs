/* The same module took two exports nobody imported five commits after a review had removed three,
   every gate green throughout (ISS-114). The tree case is the rule; the planted ones are each a graph
   the rule has to read the right way round, and would go green with the checker deleted. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { deadExportProblems, deadExports, exporting, harnessLoads } from "../../../src/checks/surface/dead-exports.mjs";
import { hookRoots } from "../../../src/checks/surface/eager-load.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const SKIPPED = new Set(["node_modules", ".git"]);

/* An importer anywhere in the repository keeps a name alive, so the walk is the whole tree. */
const walked = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((one) => {
  if (one.isDirectory()) return SKIPPED.has(one.name) ? [] : walked(join(dir, one.name));
  return /\.(?:mjs|js)$/u.test(one.name) ? [relative(ROOT, join(ROOT, dir, one.name))] : [];
});

const tree = () => new Map(walked(".").map((one) => [one, readFileSync(join(ROOT, one), "utf8")]));

const found = (files, loaded = []) => deadExports(files, { exporter: exporting, loaded });
const names = (files, loaded) => found(files, loaded).map(({ where, line, name }) => `${where}:${line} ${name}`).sort();
const planted = (entries) => new Map(Object.entries(entries));

test("no name exported from plugin/src or plugin/hooks goes unimported anywhere in the repository", () => {
  const files = tree();
  const exporters = [...files.keys()].filter(exporting);
  assert.ok(exporters.length >= 200, `${exporters.length} exporting module(s) walked; the selector matches too little`);
  const registration = readFileSync(join(ROOT, "plugin", "hooks", "hooks.json"), "utf8");
  const { roots } = hookRoots(registration, [...files.keys()]);
  assert.deepEqual(deadExportProblems(found(files, harnessLoads(files, roots))), []);
});

test("an export nothing imports is named by file, line and name, with what to do instead", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const used = 1;\n\nexport const unused = 2;\n",
    "plugin/src/reader.mjs": 'import { used } from "./m.mjs";\n',
  });
  const said = deadExportProblems(found(files));
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /^plugin\/src\/m\.mjs:3 exports `unused`, and no file in the repository imports it\./u);
  assert.match(said[0], /Drop the `export` keyword/u, "the refusal names the first way out");
  assert.match(said[0], /import it in the module that was meant to read it/u, "and the second");
});

test("every declarator of one exported declaration is an export of its own", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const used = f(1, 2), unused = [3, 4],\n  { deep: also } = {};\nexport const after = 5;\n",
    "plugin/src/reader.mjs": 'import { used, after } from "./m.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/m.mjs:1 also", "plugin/src/m.mjs:1 unused"]);
});

test("a nested pattern holding a default is read whole, and a regex after return exports nothing", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const { nested: { used = 1, unused } } = { nested: {} };\n"
      + "const f = () => { return /export const ghost = 1/u; };\nf();\n",
    "plugin/src/reader.mjs": 'import { used } from "./m.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/m.mjs:1 unused"]);
});

test("a test is an importer, and so is a file outside plugin and tools", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const pinned = 1;\nexport const packaged = 2;\n",
    "plugin/test/m.test.mjs": 'import { pinned } from "../src/m.mjs";\n',
    "packages/tool/use.js": 'import { packaged as held } from "../../plugin/src/m.mjs";\n',
  });
  assert.deepEqual(names(files), []);
});

test("the hooks' imported directories are held to the rule and the vendored copy is not", () => {
  const files = planted({
    "plugin/hooks/_hook.mjs": "export const harness = 1;\n",
    "plugin/hooks/gates/one.mjs": "export const gated = 1;\n",
    "plugin/hooks/entries/one.mjs": "export const entered = 1;\n",
    "plugin/hooks/vendor/copy.mjs": "export const vendored = 1;\n",
  });
  assert.deepEqual(names(files), [
    "plugin/hooks/_hook.mjs:1 harness",
    "plugin/hooks/entries/one.mjs:1 entered",
    "plugin/hooks/gates/one.mjs:1 gated",
  ]);
});

test("a named re-export takes the name from its source, and the barrel's own copy needs an importer", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const a = 1;\nexport const b = 2;\n",
    "plugin/src/barrel.mjs": 'const c = 3;\nexport { a, b as bee } from "./m.mjs";\nexport { c };\n',
    "plugin/src/reader.mjs": 'import { bee } from "./barrel.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/barrel.mjs:2 a", "plugin/src/barrel.mjs:3 c"]);
});

test("a star re-export is the barrel exporting every name of its source, found at the star's line", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const a = 1;\nexport const b = 2;\nexport default a;\n",
    "plugin/src/inner.mjs": 'export * from "./m.mjs";\n',
    "plugin/src/barrel.mjs": '// the outer one\nexport * from "./inner.mjs";\n',
    "plugin/src/reader.mjs": 'import { a } from "./barrel.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/barrel.mjs:2 b", "plugin/src/m.mjs:3 default"]);
});

test("a namespace re-export is one name of the barrel's, found there when nothing imports it", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const a = 1;\n",
    "plugin/src/barrel.mjs": 'export * as all from "./m.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/barrel.mjs:1 all"]);
});

test("a default export is taken by a default import, and a namespace takes every name", () => {
  const files = planted({
    "plugin/src/d.mjs": "export default function held() {}\nexport const beside = 1;\n",
    "plugin/src/n.mjs": "export const one = 1;\nexport class Two {}\n",
    "plugin/src/reader.mjs": 'import held from "./d.mjs";\nimport * as all from "./n.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/d.mjs:2 beside"]);
});

test("a module reached by a dynamic import or a path in a string gives up the names its reader spells", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n",
    "plugin/src/lazy.mjs": 'const { a } = await import("./m.mjs");\n',
    "plugin/test/by-path.test.mjs": 'const at = new URL("../src/m.mjs", import.meta.url);\nconst held = (await import(at)).b;\n',
  });
  assert.deepEqual(names(files), ["plugin/src/m.mjs:3 c"]);
});

test("an import written in a comment or a string is no importer", () => {
  const files = planted({
    "plugin/src/m.mjs": "export const a = 1;\n",
    "plugin/src/prose.mjs": '// import { a } from "./m.mjs";\nexport const said = \'import { a } from "./m.mjs"\';\n',
    "plugin/test/prose.test.mjs": 'import { said } from "../src/prose.mjs";\n',
  });
  assert.deepEqual(names(files), ["plugin/src/m.mjs:1 a"]);
});

const REGISTRATION = JSON.stringify({
  hooks: { PreToolUse: [{ hooks: [{ command: 'node "${CLAUDE_PLUGIN_ROOT}"/hooks/gate.mjs pre one' }] }] },
});

test("the harness reads run off every registered gate, and says so when it stops reading it", () => {
  const files = planted({
    "plugin/hooks/gate.mjs": "",
    "plugin/hooks/_hook.mjs": "export const alone = async (file) => { const gate = await import(file); await gate.run(1); };\n",
    "plugin/hooks/gates/one.mjs": "export const run = () => {};\n",
    "plugin/hooks/entries/one.mjs": 'import { alone } from "../_hook.mjs";\n',
  });
  const { roots } = hookRoots(REGISTRATION, [...files.keys()]);
  assert.deepEqual(roots, ["plugin/hooks/gate.mjs", "plugin/hooks/gates/one.mjs"]);
  assert.deepEqual(names(files, harnessLoads(files, roots)), []);
  assert.deepEqual(names(files), ["plugin/hooks/gates/one.mjs:1 run"], "the edge came from the registration");
  const moved = new Map(files).set("plugin/hooks/_hook.mjs", "export const alone = (gate) => gate.decide(1);\n");
  assert.throws(() => harnessLoads(moved, roots), /no longer reads `\.run\(` off a gate/u);
});
