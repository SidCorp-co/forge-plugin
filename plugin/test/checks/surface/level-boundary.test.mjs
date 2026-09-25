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

const leavesPlugin = (rel, text) => relativeImports(rel, text).filter((one) => !one.startsWith(PLUGIN));

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

/* The harness every test file loads ships in the installed copy, which is plugin/ with nothing beside
   it (C-02): one import past plugin/ there and no test in that copy can load at all (ISS-2535). */
test("the shared test fixtures import nothing outside plugin/", () => {
  const fixtures = [...tracked("plugin/test/fixtures.mjs"), ...tracked("plugin/test/fixtures")]
    .filter((one) => one.endsWith(".mjs"));
  assert.ok(fixtures.includes("plugin/test/fixtures.mjs") && fixtures.length > 5,
    `the sweep found ${fixtures.length} fixture modules, so its selector reaches the harness`);
  const leaving = fixtures
    .map((rel) => ({ rel, into: leavesPlugin(rel, readFileSync(join(ROOT, rel), "utf8")) }))
    .filter((one) => one.into.length);
  assert.deepEqual(leaving.map((one) => `${one.rel} -> ${one.into.join(", ")}`), [],
    "a fixture importing past plugin/ resolves in no installed copy; move what it needs under plugin/test/fixtures/");
});

test("the fixture reader finds an import leaving plugin/, and passes one that stays inside", () => {
  const at = "plugin/test/fixtures.mjs";
  assert.deepEqual(leavesPlugin(at, `import { madeIn } from "../../tools/room.mjs";`),
    [join(ROOT, "tools", "room.mjs")], "a specifier escaping plugin/ is found");
  assert.deepEqual(leavesPlugin(at, `import { madeIn } from "./fixtures/room.mjs";`), [],
    "and one resolving inside plugin/ is no finding");
});

/* Watched failing: the reader over a module that does reach, and over the sibling that does not, so
   a selector matching nothing cannot pass as a clean tree. */
test("the reader finds a specifier that reaches tools, and leaves the plugin's own tools tree alone", () => {
  const at = "plugin/src/flow/record/record.mjs";
  assert.deepEqual(reachesTools(at, `import { greenHeld } from "../../../../tools/gates/green.mjs";`),
    [join(ROOT, "tools", "gates", "green.mjs")], "a specifier escaping into tools/ is found");
  assert.deepEqual(reachesTools(at, `import { pluginCopy } from "../../tools/plugin-copy.mjs";`), [],
    "and plugin/src/tools, which is the plugin's own, is no finding");
  assert.deepEqual(reachesTools(at, `import { x } from "node:path";`), [], "nor is a bare specifier");
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
