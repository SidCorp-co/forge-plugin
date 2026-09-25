/* The plugin's source runs in repositories it cannot see, and `tools/` is this one repository's own furniture — the gate's step table, its content-keyed ledger, the ship. A module under plugin/src reaching into it would derive the plugin's behaviour from a checkout that will not be there, and the direction is not symmetric: the ship imports the plugin on purpose, so only this way is a defect. Nothing enforces the direction but this case (CLAUDE.md, docs/two-levels.md). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const TOOLS = join(ROOT, "tools") + sep;
const PLUGIN = join(ROOT, "plugin") + sep;
const LEDGER = "gate-ledger";

const tracked = (glob) => execFileSync("git", ["-C", ROOT, "ls-files", glob], { cwd: ROOT, encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

/* Both spellings the tree uses, static and dynamic; a specifier built from a variable is none this can read. */
const SPECIFIER = /from\s+"([^"\n]+)"|import\(\s*"([^"\n]+)"\s*\)/gu;

const relativeImports = (rel, text) => [...String(text).matchAll(SPECIFIER)]
  .map((found) => found[1] ?? found[2])
  .filter((one) => one.startsWith("."))
  .map((one) => resolve(dirname(join(ROOT, rel)), one));

const reachesTools = (rel, text) => relativeImports(rel, text).filter((one) => one.startsWith(TOOLS));

/* A URL read off the module's own location, which a climb out of plugin/ and back in reaches as an import does. */
const URL_SPECIFIER = /new URL\(\s*"([^"\n]+)"\s*,\s*import\.meta\.url\s*\)/gu;

/* Walked a segment at a time from the module's own directory, as a copy of plugin/ standing alone
   would walk it: a specifier that goes above plugin/ at any point resolves there only where the
   directory beside the copy happens to be called what this checkout calls it (C-02). */
const climbsOut = (rel, one) => {
  let depth = dirname(rel).split("/").length - 1;
  for (const segment of one.split("/")) {
    if (segment === "..") depth -= 1;
    else if (segment !== "." && segment !== "") depth += 1;
    if (depth < 0) return true;
  }
  return false;
};

const specifiersOf = (text, pattern) => [...String(text).matchAll(pattern)]
  .map((found) => found[1] ?? found[2]).filter((one) => one.startsWith("."));

/** Each import that climbs above plugin/, and each URL that climbs above it and comes back in by name. */
const leavesPlugin = (rel, text) => [
  ...specifiersOf(text, SPECIFIER).filter((one) => climbsOut(rel, one)),
  ...specifiersOf(text, URL_SPECIFIER).filter((one) => climbsOut(rel, one)
    && resolve(dirname(join(ROOT, rel)), one).startsWith(PLUGIN)),
];

test("no module under plugin/src imports or reads a file under this repository's own tools directory", () => {
  const sources = tracked("plugin/src").filter((one) => one.endsWith(".mjs"));
  assert.ok(sources.length > 100, `the sweep found ${sources.length} sources, so its selector reaches the tree`);
  const reaching = sources
    .map((rel) => ({ rel, into: reachesTools(rel, readFileSync(join(ROOT, rel), "utf8")) }))
    .filter((one) => one.into.length);
  assert.deepEqual(reaching.map((one) => `${one.rel} -> ${one.into.join(", ")}`), [],
    "a module here importing tools/ would ship behaviour that resolves in no other checkout");
  const naming = sources.filter((rel) => readFileSync(join(ROOT, rel), "utf8").includes(LEDGER));
  assert.deepEqual(naming, [],
    `the gate's record is keyed on content and names no commit, so ${LEDGER} is a word plugin/src has no use for`);
});

/* Every module under plugin/test ships in the installed copy, which is plugin/ with nothing beside it
   (C-02): one import past plugin/ there and that module cannot load at all (ISS-2535, ISS-2537). */
test("no module under plugin/test imports past plugin/, or climbs out of it and back in", () => {
  const modules = tracked("plugin/test").filter((one) => /\.m?js$/u.test(one));
  assert.ok(modules.includes("plugin/test/fixtures.mjs") && modules.length > 400,
    `the sweep found ${modules.length} test modules, so its selector reaches the suite`);
  const leaving = modules
    .map((rel) => ({ rel, into: leavesPlugin(rel, readFileSync(join(ROOT, rel), "utf8")) }))
    .filter((one) => one.into.length);
  assert.deepEqual(leaving.map((one) => `${one.rel} -> ${one.into.join(", ")}`), [],
    "a test module importing past plugin/ resolves in no installed copy: a test of this repository's "
    + "tools/ goes under tools/test/, and a plugin test takes what it needs from plugin/src");
});

/* Planted through a helper, so this file's own text carries no specifier the sweep above would read. */
const importing = (one) => `import { x } from ${JSON.stringify(one)};`;
const reading = (one) => `const at = new URL(${JSON.stringify(one)}, import.meta.url);`;

test("the test-module reader finds an import leaving plugin/, and passes one that stays inside", () => {
  const at = "plugin/test/fixtures.mjs";
  assert.deepEqual(leavesPlugin(at, importing("../../tools/room.mjs")), ["../../tools/room.mjs"],
    "a specifier escaping plugin/ is found");
  assert.deepEqual(leavesPlugin(at, importing("./fixtures/room.mjs")), [],
    "and one resolving inside plugin/ is no finding");
  assert.deepEqual(leavesPlugin("plugin/test/run/one.test.mjs", importing("../../src/flow/landing/checkpoint.mjs")), [],
    "nor is one that climbs to plugin/ itself and no further");
});

test("the test-module reader finds a climb out of plugin/ and back in by the directory's name", () => {
  const at = "plugin/test/run/landing/one.test.mjs";
  const back = "../../../../plugin/src/flow/landing/checkpoint.mjs";
  assert.deepEqual(leavesPlugin(at, importing(back)), [back], "an import that comes back in is still found");
  assert.deepEqual(leavesPlugin(at, reading("../../../../plugin/src/flow/landing/")),
    ["../../../../plugin/src/flow/landing/"], "and so is a URL read that does");
  assert.deepEqual(leavesPlugin(at, reading("../../../src/flow/landing/")), [],
    "while the same URL spelled inside plugin/ is none");
  assert.deepEqual(leavesPlugin(at, reading("../../../../")), [],
    "and a URL naming the repository root, which a whole-tree check reads on purpose, is no finding here");
});

/* Watched failing: the reader over a module that does reach, and over the sibling that does not, so
   a selector matching nothing cannot pass as a clean tree. */
test("the reader finds a specifier that reaches tools, and leaves the plugin's own tools tree alone", () => {
  const at = "plugin/src/flow/record/record.mjs";
  assert.deepEqual(reachesTools(at, importing("../../../../tools/gates/green.mjs")),
    [join(ROOT, "tools", "gates", "green.mjs")], "a specifier escaping into tools/ is found");
  assert.deepEqual(reachesTools(at, importing("../../tools/plugin-copy.mjs")), [],
    "and plugin/src/tools, which is the plugin's own, is no finding");
  assert.deepEqual(reachesTools(at, importing("node:path")), [], "nor is a bare specifier");
  assert.deepEqual(reachesTools(at, `const said = "tools/gates/steps.mjs claims it";`), [],
    "and prose naming a path is not an import, this being a check on what a module loads");
});

/* The direction, stated as a case rather than as prose: the ship is what publishes the baseline the
   plugin reads back, so it imports the plugin and the plugin must not import it. */
test("the ship imports the plugin, which is the direction this boundary allows", () => {
  const ship = readFileSync(join(ROOT, "tools", "run", "publish.mjs"), "utf8");
  assert.match(ship, /from "\.\.\/\.\.\/plugin\/src\/flow\/earned\/published\.mjs"/u,
    "the publish reads the store through the plugin, so the record's shape has one owner");
  assert.match(ship, /from "\.\.\/gates\/green\.mjs"/u,
    "and reads the gate's record here, where the ledger belongs");
});
