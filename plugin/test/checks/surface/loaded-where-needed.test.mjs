/* A small binding taken out of a verb's implementation loads that verb's whole tree, and the graph says so before any process is spawned. The real-tree cases below go red the moment one of the two seams ISS-1801 moved is put back; the synthetic pair is the same reading over a graph that still has them, so a walk that reached nothing could not pass for a clean repository. */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { graphOf, reachedFrom } from "../../../src/checks/surface/eager-load.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;

const walked = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((one) =>
  (one.isDirectory()
    ? walked(join(dir, one.name))
    : (/\.(mjs|js)$/u.test(one.name) ? [relative(ROOT, join(ROOT, dir, one.name))] : [])));

const FILES = ["plugin/src", "plugin/hooks", "tools"].flatMap((one) => walked(one));
const EDGES = graphOf(ROOT, FILES);

/** The chain that reaches `target` from `from`, or null; the chain and not the answer, because a module reached is a line somebody wrote and the reader has to be told which. */
const chainTo = (edges, from, target) => {
  const by = reachedFrom(edges, from);
  if (!by.has(target)) return null;
  const held = [];
  for (let at = target; at; at = by.get(at)) held.unshift(at);
  return held.join(" -> ");
};

const CODEX = "plugin/src/codex/codex.mjs";
const KNOWLEDGE = "plugin/src/tools/knowledge.mjs";
const MEDIAN = "plugin/src/stats/median.mjs";
const STORE = "plugin/src/tracker/knowledge/store.mjs";
const ROOTS = ["plugin/src/cli.mjs", "plugin/src/flow/record/record.mjs",
  "plugin/src/flow/record/plan-scope.mjs", "plugin/src/tracker/project-config.mjs"];

test("the walk reaches the tree and every module this rule is about is in it", () => {
  assert.ok(FILES.length > 250, `${FILES.length} file(s) walked; the selector matches too little`);
  for (const one of [...ROOTS, CODEX, KNOWLEDGE, MEDIAN, STORE]) {
    assert.ok(EDGES.has(one), `${one} is not in the walk, so nothing below is asserted about it`);
  }
  assert.equal(chainTo(EDGES, "plugin/src/tracker/project-config.mjs", STORE),
    "plugin/src/tracker/project-config.mjs -> plugin/src/tracker/knowledge/store.mjs",
    "the brief still reads the store, so the rule below is about where the binding is and not whether it is gone");
});

test("no module on a verb's path takes a binding out of another verb's implementation", () => {
  for (const from of ROOTS) {
    for (const target of [CODEX, KNOWLEDGE, MEDIAN]) {
      const chain = chainTo(EDGES, from, target);
      assert.equal(chain, null, `${from} reaches ${target}: ${chain}`);
    }
  }
});

const PUT_BACK = new Map([
  ["plugin/src/flow/record/record.mjs", [CODEX]],
  [CODEX, ["plugin/src/codex/log/replies.mjs"]],
  ["plugin/src/codex/log/replies.mjs", [MEDIAN]],
  [MEDIAN, []],
]);

test("the same reading names the module and the chain where a seam is put back", () => {
  assert.equal(chainTo(PUT_BACK, "plugin/src/flow/record/record.mjs", MEDIAN),
    `plugin/src/flow/record/record.mjs -> ${CODEX} -> plugin/src/codex/log/replies.mjs -> ${MEDIAN}`,
    "repoRoot back inside the consult verb puts the whole consult stack on forge record's path");
  assert.equal(chainTo(new Map([["plugin/src/cli.mjs", ["plugin/src/commands.mjs"]],
    ["plugin/src/commands.mjs", ["plugin/src/tracker/project-config.mjs"]],
    ["plugin/src/tracker/project-config.mjs", [KNOWLEDGE]], [KNOWLEDGE, []]]),
  "plugin/src/cli.mjs", KNOWLEDGE),
  `plugin/src/cli.mjs -> plugin/src/commands.mjs -> plugin/src/tracker/project-config.mjs -> ${KNOWLEDGE}`,
  "the store's client back inside the knowledge verb puts that verb on every invocation's path");
});
