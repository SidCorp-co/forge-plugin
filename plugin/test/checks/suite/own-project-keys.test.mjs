/* Where this suite gets the project keys a case hands a room, and where this repository does not
   keep them. The configuration is this machine's record of the project (ISS-1403), so a tracked file
   stating the same keys is a second store that drifts from the first `forge doctor --set` and fails
   nothing while it does — which is what ISS-2055 removed. Both halves are checked here because the
   file came back the moment a case wanted realistic keys and reached for the nearest copy. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { OWN } from "../../fixtures/own-keys.mjs";
import { PROJECT } from "../../../src/tracker/filing/plugin-defect.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const SUITE = join("plugin", "test");
// The tests of this repository's scripts, outside plugin/ so the plugin travels alone (ISS-2537).
const TOOLS_SUITE = join("tools", "test");
const COMMITTED = ".forge.json";

/* The one place that answers, whose keys are the suite's own declaration and not a reading of this
   box: a case wanting a project shaped like this one imports it rather than composing a second. */
const ONE_SOURCE = join(SUITE, "fixtures", "own-keys.mjs");

const under = (dir) => readdirSync(join(ROOT, dir), { recursive: true })
  .map((one) => join(dir, String(one))).filter((one) => one.endsWith(".mjs"));

/* Judged by whether the path being built is THIS repository's root, never by which call the name
   sits in: a read through a local path constant escapes any rule written about the read, and an
   inline `join(room, ...)` into a scratch checkout would be refused by one. Two forms name the root
   and both are refused — a path resolving there from the file's own directory, and the bare name
   beside a climb to it, each judged over the whole statement. One composed out of a value no
   reading here can see is not caught, which is why the case above asks whether the file is there. */
/* The bare name is a path only where something composes one out of it, so a grep pattern and an
   array of words are not paths; and it is THIS root only where what it is joined to climbs there. */
const COMPOSES_A_PATH = /\b(?:join|resolve|URL)\s*\(|`/u;
const CLIMBS_TO_THE_ROOT = /\b(?:ROOT|REPO|REPOSITORY|HERE)\b|"\.\."|'\.\.'/u;

const namesTheRoot = (file, said) => {
  for (const found of said.matchAll(/"([^"]*\.forge\.json)"|'([^']*\.forge\.json)'|`([^`]*\.forge\.json)`/gu)) {
    const named = found[1] ?? found[2] ?? found[3];
    if (named === COMMITTED) {
      if (COMPOSES_A_PATH.test(said) && CLIMBS_TO_THE_ROOT.test(said)) return named;
      continue;
    }
    if (resolve(dirname(join(ROOT, file)), named) === join(ROOT, COMMITTED)) return named;
  }
  return null;
};

/* By statement and not by line: a `join` wrapped across three lines puts the name on a line holding
   neither the call nor the root, and a rule reading one line at a time takes it. */
const statementsIn = (text) => {
  const said = [];
  let at = 0;
  for (const part of text.split(";")) {
    said.push({ text: part, line: text.slice(0, at).split("\n").length });
    at += part.length + 1;
  }
  return said;
};

const rootReadsIn = (file, text) => statementsIn(text)
  .map((one) => ({ ...one, said: namesTheRoot(file, one.text) }))
  .filter((one) => one.said !== null)
  .map((one) => `${file}:${one.line}: ${one.text.trim().replace(/\s+/gu, " ")}`);

test("this repository carries no committed project file, its keys being this machine's record", () => {
  assert.equal(existsSync(join(ROOT, COMMITTED)), false,
    `${COMMITTED} is standing at this repository's root again. Nothing reads a key out of it, so it `
    + "states this project's configuration to a reader and answers for none of it: the keys are in "
    + "this machine's record of the project, which `forge doctor` prints with its path. Remove the "
    + "file; `forge doctor --adopt` is for a project that still keeps one.");
});

test("no case names a path to a project file at this repository's root", () => {
  const files = [...under(SUITE), ...under(TOOLS_SUITE)];
  assert.ok(files.length > 200, `${files.length} files under ${SUITE} and ${TOOLS_SUITE}, so this walk is not the suite's`);
  assert.ok(files.includes(join(TOOLS_SUITE, "run", "run-fixtures.mjs")), "the tests of tools/ are not reached");
  const reaching = files.flatMap((one) => rootReadsIn(one, readFileSync(join(ROOT, one), "utf8")));
  assert.deepEqual(reaching, [], `import OWN from ${ONE_SOURCE} instead: this repository tracks no `
    + `${COMMITTED} for a case to read, and a case composing its own answer to where this tree's `
    + "project comes from is the second store ISS-2055 removed, one level down. A case that means to "
    + `write a ${COMMITTED} into a room it made is untouched by this — only reading one is refused.`);
});

/* The one key of that declaration the product also holds. It is typed in both places because the
   suite cannot import the product's copy early enough — the module graph behind it loads the shape
   reader, which `tools/test/run/run-fixtures.mjs` may only load after it has moved
   `XDG_CONFIG_HOME` — so the two are held together here instead of resolved. */
test("the slug the suite declares is the slug the product files this repository's defects under", () => {
  assert.equal(OWN.slug, PROJECT, `${ONE_SOURCE} and plugin/src/tracker/filing/plugin-defect.mjs `
    + "disagree about this project's slug, so a case standing a room in for this checkout resolves a "
    + "project the product would not call its own. Make the declaration match the product.");
});
