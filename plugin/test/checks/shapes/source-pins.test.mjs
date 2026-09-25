/* A case matching a module's own text breaks on a rename that changes no behaviour and passes a
   regression the text still spells; the audit of 2026-09-25 found it in twenty-five files outside
   the rule checkers (ISS-2502). The tree case holds the suite to its standing count; each planted
   case is a route to the source the reading has to follow, or a rule it must leave alone. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { EXEMPT, pinProblems, pinsIn } from "../../../src/checks/shapes/source-pins.mjs";
import { standingOf, standingProblems } from "../../../src/checks/shapes/standing.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const SUITE = join("plugin", "test");
const KEY = "sourcePins";
const AT = "plugin/test/tracker/made-up.test.mjs";

const walked = () => readdirSync(join(ROOT, SUITE), { recursive: true }).map(String)
  .filter((one) => one.endsWith(".mjs"))
  .map((one) => ({ rel: join(SUITE, one), text: readFileSync(join(ROOT, SUITE, one), "utf8") }));

const lines = (text, rel = AT) => pinsIn(text, rel).map(({ line, pattern }) => `${line} ${pattern}`);

test("the suite holds no more source-text pins than its standing count, and no fewer", () => {
  const files = walked();
  assert.ok(files.length > 400, `${files.length} file(s) under ${SUITE}; the walk reaches too little`);
  const problems = pinProblems(files.flatMap((one) => pinsIn(one.text, one.rel)));
  const config = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(standingProblems({ key: KEY, problems, standing: standingOf(config, KEY) }), []);
});

test("a match on a module read through its own URL is named with its line, its pattern and the way out", () => {
  const text = [
    'const source = readFileSync(new URL("../../src/tracker/rest.mjs", import.meta.url), "utf8");',
    "assert.match(source, /await sleep\\(wait\\)/u);",
  ].join("\n");
  assert.deepEqual(lines(text), ["2 /await sleep\\(wait\\)/u"]);
  const [said] = pinProblems(pinsIn(text, AT));
  assert.match(said, /^plugin\/test\/tracker\/made-up\.test\.mjs:2 matches the text of a module under plugin\/src or plugin\/hooks with \/await/u);
  assert.match(said, /Prove the behaviour through the module's public entry point instead/u);
});

test("a path joined from a root constant, a regex's test and a method on the text are each a match", () => {
  const text = [
    'const ROOT = new URL("../../..", import.meta.url).pathname;',
    'const text = readFileSync(join(ROOT, "plugin", "hooks", "gates", "one.mjs"), "utf8");',
    "assert.ok(/freezesSession/u.test(text));",
    'assert.ok(text.includes("heldAndSilent"));',
    'assert.doesNotMatch(readFileSync(join(ROOT, "plugin/src/x.mjs"), "utf8"), /oldName/u);',
  ].join("\n");
  assert.deepEqual(lines(text), ["3 /freezesSession/u", "4 \"heldAndSilent\"", "5 /oldName/u"]);
});

test("a banned module or global is a rule, and an imported local is still a pin", () => {
  const text = [
    'const source = readFileSync(new URL("../../src/tracker/rest.mjs", import.meta.url), "utf8");',
    "assert.doesNotMatch(source, /process\\.env/u);",
    'assert.doesNotMatch(source, /from "node:fs"/u);',
    "assert.match(source, /import \\{ promptFor \\}/u);",
  ].join("\n");
  assert.deepEqual(lines(text), ["4 /import \\{ promptFor \\}/u"]);
});

test("a rule checker's own case, a document, a scratch room and a binding out of scope are not pins", () => {
  const read = 'const source = readFileSync(new URL("../../src/tracker/rest.mjs", import.meta.url), "utf8");\n'
    + "assert.match(source, /sleep/u);\n";
  assert.deepEqual(lines(read, `${EXEMPT}made-up.test.mjs`), []);
  const elsewhere = [
    'const how = readFileSync(join(ROOT, "plugin", "hooks", "how", "one.md"), "utf8");',
    "assert.match(how, /why/u);",
    'const copy = readFileSync(join(room.work, "plugin", "src", "one.mjs"), "utf8");',
    "assert.match(copy, /one/u);",
    'test("a", () => { const said = readFileSync(new URL("../../src/a.mjs", import.meta.url), "utf8"); });',
    'test("b", () => { const said = run().stdout; assert.match(said, /printed/u); });',
  ].join("\n");
  assert.deepEqual(lines(`const ROOT = new URL("../../..", import.meta.url).pathname;\n${elsewhere}`), []);
});
