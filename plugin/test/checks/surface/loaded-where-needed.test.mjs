/* A binding taken out of a verb's implementation loads that verb's whole tree, and the graph says so before any process is spawned. The trees and the roots are read off the command table, so a verb added to it is covered here with no edit; the synthetic graphs are the same reading over the shapes it refuses, so a walk that reached nothing could not pass for a clean repository. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { SHARED, graphOf, reachedFrom, treeLoads, verbModules, verbTrees } from "../../../src/checks/surface/eager-load.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;

const walked = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((one) =>
  (one.isDirectory()
    ? walked(join(dir, one.name))
    : (/\.(mjs|js)$/u.test(one.name) ? [relative(ROOT, join(ROOT, dir, one.name))] : [])));

const FILES = ["plugin/src", "plugin/hooks", "tools"].flatMap((one) => walked(one));
const EDGES = graphOf(ROOT, FILES);
const ENTRY = "plugin/src/cli.mjs";
const VERBS = verbModules(readFileSync(join(ROOT, "plugin/src/commands.mjs"), "utf8"));
const TREES = verbTrees(VERBS);

/** The chain that reaches `target` from `from`, or null; the chain and not the answer, because a module reached is a line somebody wrote and the reader has to be told which. */
const chainTo = (edges, from, target) => {
  const by = reachedFrom(edges, from);
  if (!by.has(target)) return null;
  const held = [];
  for (let at = target; at; at = by.get(at)) held.unshift(at);
  return held.join(" -> ");
};

/* The leaf the campaign measures (ISS-1801): not a verb's module, so no table row names it, and
   the one target here that is declared rather than read. */
const MEDIAN = "plugin/src/stats/median.mjs";
const STORE = "plugin/src/tracker/knowledge/store.mjs";
const BRIEF = "plugin/src/tracker/knowledge/brief.mjs";
/* Paths that are no verb's module and that a hook or every verb reads, so no table row roots them. */
const SHARED_ROOTS = ["plugin/src/flow/record/plan-scope.mjs", "plugin/src/tracker/project-config.mjs", BRIEF];

test("the walk reaches the tree, and the table names verbs with a tree of their own", () => {
  assert.ok(FILES.length > 250, `${FILES.length} file(s) walked; the selector matches too little`);
  assert.ok(VERBS.size > 12, `${VERBS.size} verb module(s) derived from the table; the loader shape moved`);
  for (const one of [ENTRY, ...VERBS.keys(), ...SHARED_ROOTS, MEDIAN, STORE]) {
    assert.ok(EDGES.has(one), `${one} is not in the walk, so nothing below is asserted about it`);
  }
  const dirs = TREES.filter((one) => one.tree.endsWith("/"));
  assert.ok(dirs.some((one) => one.verb === "google"), `no verb's tree is a directory: ${JSON.stringify(TREES)}`);
  for (const { dir } of SHARED) {
    assert.ok(FILES.some((one) => one.startsWith(dir)), `${dir} is declared shared and holds no module`);
  }
  assert.equal(chainTo(EDGES, BRIEF, STORE), `${BRIEF} -> ${STORE}`,
    "the brief still reads the store, so the rule below is about where the binding is and not whether it is gone");
});

test("neither the entry nor any verb's path enters another verb's tree past a module standing alone in it", () => {
  const found = [ENTRY, ...VERBS.keys()].flatMap((root) => treeLoads(EDGES, root, TREES));
  assert.deepEqual(found, [], found.join("\n"));
});

test("no path that is not a verb's own takes a binding out of a verb's module", () => {
  for (const from of SHARED_ROOTS) {
    for (const target of VERBS.keys()) {
      const chain = chainTo(EDGES, from, target);
      assert.equal(chain, null, `${from} reaches ${target}: ${chain}`);
    }
  }
});

test("the measured leaf is on no path the record verb or a shared root takes", () => {
  for (const from of [ENTRY, "plugin/src/flow/record/record.mjs", ...SHARED_ROOTS]) {
    const chain = chainTo(EDGES, from, MEDIAN);
    assert.equal(chain, null, `${from} reaches ${MEDIAN}: ${chain}`);
  }
});

/* One table text and one graph, standing for a CLI this one could become. `mail` is a verb that
   exists only in this text, which is the case of a verb added after the rule was written. */
const TABLE = [
  '  mail: loads("./tools/services/mail/mail.mjs", "mail"),',
  '  cloud: loads("./tools/services/cloud.mjs", "cloud"),',
  '  lint: loads("./lint/lint.mjs", "lint"),',
].join("\n");
const SYNTH = verbTrees(verbModules(TABLE), [{ dir: "plugin/src/lint/", why: "read by every verb" }]);
const M = "plugin/src/tools/services/mail/";
const graph = (pairs) => new Map(pairs);

test("the entry entering a verb's directory at a module that loads more of it is one finding, with the chain", () => {
  const found = treeLoads(graph([
    [ENTRY, ["plugin/src/resolve/shown.mjs"]],
    ["plugin/src/resolve/shown.mjs", [`${M}auth/status.mjs`]],
    [`${M}auth/status.mjs`, [`${M}surface.mjs`]],
    [`${M}surface.mjs`, []],
  ]), ENTRY, SYNTH);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /enters the `mail` verb's tree plugin\/src\/tools\/services\/mail\//u);
  assert.ok(found[0].includes(`${ENTRY} -> plugin/src/resolve/shown.mjs -> ${M}auth/status.mjs, and from there ${M}surface.mjs.`),
    `the chain from the entry is not named: ${found[0]}`);
  assert.match(found[0], /the one in plugin\/src\/resolve\/shown\.mjs that imports/u, "and the line to remove");
});

test("the entry entering a verb's directory only at modules that load nothing else of it is no finding", () => {
  assert.deepEqual(treeLoads(graph([
    [ENTRY, ["plugin/src/resolve/shown.mjs"]],
    ["plugin/src/resolve/shown.mjs", [`${M}auth/configured.mjs`, `${M}config.mjs`]],
    [`${M}auth/configured.mjs`, ["plugin/src/resolve/config.mjs"]],
    [`${M}config.mjs`, []],
    ["plugin/src/resolve/config.mjs", []],
  ]), ENTRY, SYNTH), []);
});

test("a reader that leaves the directory and comes back into it does not stand alone", () => {
  const found = treeLoads(graph([
    [ENTRY, [`${M}auth/configured.mjs`]],
    [`${M}auth/configured.mjs`, ["plugin/src/resolve/helper.mjs"]],
    ["plugin/src/resolve/helper.mjs", [`${M}surface.mjs`]],
    [`${M}surface.mjs`, []],
  ]), ENTRY, SYNTH);
  assert.equal(found.length, 1, found.join("\n"));
  assert.ok(found[0].includes(`${ENTRY} -> ${M}auth/configured.mjs, and from there plugin/src/resolve/helper.mjs -> ${M}surface.mjs.`),
    `the route back into the tree is not named: ${found[0]}`);
});

test("one verb's handler reaching into another verb's directory, or its module, is a finding from that handler", () => {
  const CLOUD = "plugin/src/tools/services/cloud.mjs";
  const into = treeLoads(graph([
    [CLOUD, [`${M}auth/status.mjs`]],
    [`${M}auth/status.mjs`, [`${M}wire.mjs`]],
    [`${M}wire.mjs`, []],
  ]), CLOUD, SYNTH);
  assert.equal(into.length, 1, into.join("\n"));
  assert.ok(into[0].startsWith(`${CLOUD} enters the \`mail\` verb's tree`), into[0]);
  assert.ok(into[0].includes(`${CLOUD} -> ${M}auth/status.mjs, and from there ${M}wire.mjs.`), into[0]);
  const handler = treeLoads(graph([
    [`${M}mail.mjs`, ["plugin/src/resolve/beside.mjs"]],
    ["plugin/src/resolve/beside.mjs", [CLOUD]],
    [CLOUD, []],
  ]), `${M}mail.mjs`, SYNTH);
  assert.equal(handler.length, 1, handler.join("\n"));
  assert.ok(handler[0].includes(`enters the \`cloud\` verb's module: ${M}mail.mjs -> plugin/src/resolve/beside.mjs -> ${CLOUD}.`),
    handler[0]);
  assert.match(handler[0], /pays for that verb's handler/u);
});

test("a directory declared shared is its verb's module alone, and every other namesake directory is a tree", () => {
  assert.deepEqual(SYNTH.map(({ verb, tree }) => [verb, tree]),
    [["mail", M], ["cloud", "plugin/src/tools/services/cloud.mjs"], ["lint", "plugin/src/lint/lint.mjs"]]);
  const LINT = "plugin/src/lint/";
  const reads = graph([
    [ENTRY, [`${LINT}rules.mjs`]],
    [`${LINT}rules.mjs`, [`${LINT}table.mjs`]],
    [`${LINT}table.mjs`, []],
  ]);
  assert.deepEqual(treeLoads(reads, ENTRY, SYNTH), [], "a shared directory's library modules are read freely");
  const withHandler = new Map([...reads, [`${LINT}rules.mjs`, [`${LINT}lint.mjs`]], [`${LINT}lint.mjs`, []]]);
  assert.equal(treeLoads(withHandler, ENTRY, SYNTH).length, 1, "and its verb's module is still refused");
  assert.equal(verbTrees(verbModules(TABLE), []).find((one) => one.verb === "lint").tree, LINT,
    "undeclared, the same directory is the verb's tree");
});
