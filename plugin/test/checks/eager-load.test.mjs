/* A checker whose population is derived from one file's text looks exactly like a clean repository
   when the derivation stops matching, so what the walk reaches is asserted before anything is
   asserted about the tree. The mutation cases below are the ones that would go green if the checker
   were deleted: each is a graph this CLI could have and the rule refuses (ISS-1775). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  graphOf,
  importsIn,
  problems,
  reachedFrom,
  takesFrom,
  verbModules,
} from "../../src/checks/eager-load.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const ENTRY = "plugin/src/cli.mjs";
const TABLE = "plugin/src/commands.mjs";

const walked = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((one) =>
  (one.isDirectory()
    ? walked(join(dir, one.name))
    : (/\.(mjs|js)$/u.test(one.name) ? [relative(ROOT, join(ROOT, dir, one.name))] : [])));

const FILES = ["plugin/src", "plugin/hooks", "tools"].flatMap((one) => walked(one));
const read = (one) => readFileSync(join(ROOT, one), "utf8");
const EDGES = graphOf(ROOT, FILES);
const VERBS = verbModules(read(TABLE));

test("the walk reaches the tree and the table names the verbs it dispatches", () => {
  assert.ok(FILES.length > 250, `${FILES.length} file(s) walked; the selector matches too little`);
  assert.ok(EDGES.get(ENTRY).includes(TABLE), "the entry's own edge to the table is unread");
  assert.ok(VERBS.size > 12, `${VERBS.size} verb module(s) derived from the table; the loader shape moved`);
  assert.equal(VERBS.get("plugin/src/codex/codex.mjs"), "codex");
});

test("the entry loads no verb's handler, and the leaf the campaign measures is not on its path", () => {
  const found = problems(EDGES, ENTRY, VERBS, read);
  assert.deepEqual(found, [], found.join("\n"));
  const by = reachedFrom(EDGES, ENTRY);
  const chain = (one) => {
    const held = [];
    for (let at = one; at; at = by.get(at)) held.unshift(at);
    return held.join(" <- ");
  };
  const leaf = "plugin/src/stats/median.mjs";
  assert.ok(!by.has(leaf), `the entry reaches ${leaf}: ${chain(leaf)}`);
});

const GRAPH = new Map([
  ["plugin/src/cli.mjs", ["plugin/src/commands.mjs"]],
  ["plugin/src/commands.mjs", ["plugin/src/beside.mjs"]],
  ["plugin/src/beside.mjs", ["plugin/src/codex/codex.mjs"]],
  ["plugin/src/codex/codex.mjs", []],
]);
const TEXTS = {
  "plugin/src/cli.mjs": 'import { commands } from "./commands.mjs";\n',
  "plugin/src/commands.mjs": '  codex: loads("./codex/codex.mjs", "codex"),\n'
    + 'import { beside } from "./beside.mjs";\n',
  "plugin/src/beside.mjs": 'import { codex } from "./codex/codex.mjs";\n',
};
const said = (texts = TEXTS, graph = GRAPH) =>
  problems(graph, "plugin/src/cli.mjs", verbModules(texts["plugin/src/commands.mjs"]),
    (one) => texts[one] ?? "");

test("a handler imported anywhere the entry reaches is one finding, naming the module and the edge", () => {
  const found = said();
  assert.equal(found.length, 1, `one finding, not ${found.length}`);
  assert.match(found[0], /loads the `codex` handler/u);
  assert.match(found[0], /plugin\/src\/beside\.mjs imports it from plugin\/src\/codex\/codex\.mjs/u,
    "the finding names the edge somebody wrote, not the whole chain");
});

test("a handler import is read behind a helper-only one that reached the module first", () => {
  const graph = new Map([...GRAPH,
    ["plugin/src/commands.mjs", ["plugin/src/helper.mjs", "plugin/src/beside.mjs"]],
    ["plugin/src/helper.mjs", ["plugin/src/codex/codex.mjs"]]]);
  const texts = { ...TEXTS,
    "plugin/src/commands.mjs": `${TEXTS["plugin/src/commands.mjs"]}import { held } from "./helper.mjs";\n`,
    "plugin/src/helper.mjs": 'import { repoRoot } from "./codex/codex.mjs";\n' };
  assert.equal(said(texts, graph).length, 1,
    "the edge that took the handler is behind the one a walk arrived by, and is read all the same");
});

test("what the same module is imported for decides it, and a namespace takes everything", () => {
  assert.deepEqual(said({ ...TEXTS, "plugin/src/beside.mjs": 'import { repoRoot } from "./codex/codex.mjs";\n' }),
    [], "a binding that is not the handler is another rule's subject");
  assert.equal(said({ ...TEXTS, "plugin/src/beside.mjs": 'import * as held from "./codex/codex.mjs";\n' }).length,
    1, "a namespace binding takes the handler with everything else");
  assert.deepEqual(said(TEXTS, new Map([...GRAPH, ["plugin/src/commands.mjs", []]])),
    [], "and a module the entry never reaches is nothing to this rule");
});

test("a relative specifier is read whichever shape it is written in, and a lazy one is not", () => {
  assert.deepEqual(importsIn('import { a } from "./one.mjs";\n'), ["./one.mjs"]);
  assert.deepEqual(importsIn('import {\n  a,\n  b,\n} from "../two.mjs";\n'), ["../two.mjs"],
    "an import broken over lines is one the loader still resolves");
  assert.deepEqual(importsIn('export { a } from "./three.mjs";\n'), ["./three.mjs"],
    "a re-export resolves the module it re-exports");
  assert.deepEqual(importsIn('import "./four.mjs";\n'), ["./four.mjs"],
    "and one imported for its effect alone");
  assert.deepEqual(importsIn('const held = await import("./five.mjs");\n'), [],
    "a dynamic import is what this rule asks for, so it is no edge of the graph");
  assert.deepEqual(importsIn('import { a } from "node:fs";\n'), [], "and nothing outside this tree");
});

test("a binding is read as a word, so a name inside another name is not it", () => {
  assert.equal(takesFrom('import { codexOwed } from "./codex/codex.mjs";\n', "/codex.mjs", "codex"), false);
  assert.equal(takesFrom('import { held, codex } from "./codex/codex.mjs";\n', "/codex.mjs", "codex"), true);
  assert.equal(takesFrom('import { codex as held } from "./codex/codex.mjs";\n', "/codex.mjs", "codex"), true,
    "renamed on the way in is still the handler on this side of it");
  assert.equal(takesFrom('import { codex } from "./other.mjs";\n', "/codex.mjs", "codex"), false);
});
