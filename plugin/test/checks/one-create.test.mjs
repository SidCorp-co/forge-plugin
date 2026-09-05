/* Two verbs and a release step each assembled a filing by hand, so a rule about one was three edits
   and a test that the three agreed (ISS-338). The interface only stays the one place if a second
   caller of the create fails something. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { INTERFACE, TOOL, createsIn, creationProblems } from "../../src/checks/one-create.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;

/* `plugin/src` and `tools` both: the release step is a script and files as surely as a verb does. */
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

const found = () => sources().flatMap(({ rel, text }) => createsIn(text, rel));

test("one place in the tree files an issue, and it is the interface", () => {
  const files = sources();
  assert.ok(files.length > 40, `${files.length} source(s) walked; the selector matches too little`);
  assert.deepEqual(creationProblems(found()), []);
});

/* CLAUDE.md, Verifying: the selector has to be watched matching. */
test("the interface itself is found, so the check is measuring something", () => {
  const mine = found().filter((one) => one.where === INTERFACE);
  assert.equal(mine.length, 1, `${INTERFACE} makes ${mine.length} create(s) on ${TOOL}, and it owns one`);
});

test("a second caller fails, is named by line, and is told what to call instead", () => {
  const second = `const answer = await write("${TOOL}", { action: "create", data });\n`;
  const said = creationProblems(createsIn(`const first = 1;\n${second}`, "plugin/src/tools/elsewhere.mjs"));
  assert.equal(said.length, 1, "a second caller of the create passed");
  assert.match(said[0], /^plugin\/src\/tools\/elsewhere\.mjs:2 writes a create/u, said[0]);
  assert.match(said[0], /fileIssue/u, "a refusal has to name what to call instead");
});

test("a create on another tool is not this rule's, and neither is a create nobody wrote out", () => {
  assert.deepEqual(createsIn(`write("forge_comments", { action: "create", data });`, "one.mjs"), []);
  assert.deepEqual(createsIn(`write("${TOOL}", { action, data });`, "two.mjs"), [],
    "an action handed in is a caller passing a value, not a second decision about a filing");
  assert.deepEqual(createsIn(`scoped("${TOOL}", { action: "list", filters });`, "three.mjs"), []);
});
