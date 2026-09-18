/* Six readers derived an edge kind's meaning from its name, agreed only because there were two
   kinds, and none of them failed a test for it (ISS-769). The rows stay the one answer only while a
   seventh comparison fails something, so the rule is watched firing against a real source file. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { INSTEAD, TABLE, comparedIn, kindProblems } from "../../../src/checks/surface/edge-kinds.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const READER = "plugin/src/rank/next.mjs";

const sources = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor") walk(join(dir, one.name), `${at}/${one.name}`);
      } else if (one.name.endsWith(".mjs")) {
        out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  walk(join(ROOT, "plugin", "src"), "plugin/src");
  walk(join(ROOT, "tools"), "tools");
  return out;
};

test("one place decides what an edge kind means, and it is the table", () => {
  const files = sources();
  assert.ok(files.length > 40, `${files.length} source(s) walked; the selector reaches too little`);
  assert.deepEqual(kindProblems(files.flatMap(({ rel, text }) => comparedIn(text, rel))), []);
});

test("the comparison put back into a real reader fails, by line, and is told what to ask instead", () => {
  const text = readFileSync(join(ROOT, READER), "utf8")
    .replace("const edgeKey = (edge) => edge.edgeId", 'const ordered = edge.kind === "blocks";\nconst edgeKey = (edge) => edge.edgeId');
  const said = kindProblems(comparedIn(text, READER));
  assert.equal(said.length, 1, `the mutation matched nothing, so it proves nothing: ${said.join("\n")}`);
  assert.match(said[0], new RegExp(`^${READER.replaceAll(/[./]/gu, "\\$&")}:\\d+ decides`, "u"), said[0]);
  assert.match(said[0], /`=== "blocks"`/u, "the finding does not quote what it found");
  assert.match(said[0], /edgeRow\(kind\)/u, "a refusal has to name what to ask instead");
  assert.ok(INSTEAD.includes(TABLE), "and where the one place is");
});

test("both operators, both spellings and both sides of the comparison are the same rule", () => {
  const each = (line) => comparedIn(line, "plugin/src/one.mjs").length;
  assert.equal(each('if (kind === "blocks") return 1;'), 1);
  assert.equal(each("if (kind !== RELATES) return 1;"), 1);
  assert.equal(each("if (RELATES === edge.kind) return 1;"), 1);
  assert.equal(each("if ('relates' !== kind) return 1;"), 1);
});

/* The two readings a comparison takes when it is not written as one: a switch decides the same
   thing branch by branch, and a parenthesised operand is the same test with a bracket on it. */
test("a switch on the kind and a parenthesised operand are the same decision, and are found", () => {
  const each = (line) => comparedIn(line, "plugin/src/one.mjs").length;
  assert.equal(each('switch (edge.kind) { case "blocks": return 1; default: return 0; }'), 1);
  assert.equal(each("switch (edge.kind) { case RELATES: return 1; default: return 0; }"), 1);
  assert.equal(each('if (kind === ("blocks")) return 1;'), 1);
  assert.equal(each('if (("relates") !== kind) return 1;'), 1);
  assert.deepEqual(comparedIn('const kinds = { "blocks": 1, "relates": 2 };', "plugin/src/one.mjs"), [],
    "a key spelt like a kind decides nothing, and a colon after one is not a case arm");
});

/* A comment between the operator and its operand is the same decision typed around the selector,
   and the operator and the operand are the only two things a comment can be held between. */
test("a comment holding the operator and its name apart does not hide the comparison", () => {
  const each = (line) => comparedIn(line, "plugin/src/one.mjs").length;
  assert.equal(each('if (kind === /* the ordering kind */ "blocks") return 1;'), 1);
  assert.equal(each('if ("blocks" /* the ordering kind */ === kind) return 1;'), 1);
  assert.equal(each("if (kind ===\n  // the ordering kind\n  RELATES) return 1;"), 1);
  assert.equal(each('switch (edge.kind) { case /* ordering */ "blocks": return 1; }'), 1);
});

/* Only an equality test: a kind handed on as a value, filed as one or printed in a usage row
   decides nothing about what it means, and refusing those would stand in the way of every call that
   has a kind to hand. */
test("a kind handed on, filed or named in a usage row is not this rule's", () => {
  const each = (line) => comparedIn(line, "plugin/src/one.mjs");
  assert.deepEqual(each('const row = { kind: "relates", blocksId };'), []);
  assert.deepEqual(each('const usage = "[--blocks ISS-46|--relates ISS-46]";'), []);
  assert.deepEqual(each("if (EDGE_KINDS.includes(asked.kind)) return 1;"), []);
  assert.deepEqual(each("const said = `${subject} ${kind} ${other}`;"), []);
});

test("the table itself is where the rule ends, so its own rows are no finding", () => {
  assert.deepEqual(kindProblems(comparedIn('const one = row.kind === "blocks";', TABLE)), []);
});
