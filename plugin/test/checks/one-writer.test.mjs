/* Two verbs and a release step each assembled a filing by hand, so a rule about one was three edits
   and a test that the three agreed (ISS-338). The lease then wrote its own update beside the field
   writer (ISS-451). Either interface only stays the one place if a second caller fails something. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SAYS, TOOL, WRITERS, saidIn, sayProblems, writesIn, writerProblems } from "../../src/checks/one-writer.mjs";

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

const found = () => sources().flatMap(({ rel, text }) => writesIn(text, rel));

test("one place in the tree files an issue, and one writes a field, and both are the interface", () => {
  const files = sources();
  assert.ok(files.length > 40, `${files.length} source(s) walked; the selector matches too little`);
  assert.deepEqual(writerProblems(found()), []);
});

/* CLAUDE.md, Verifying: the selector has to be watched matching, and once per row. */
for (const [shape, row] of Object.entries(WRITERS)) {
  test(`the interface for ${shape} is found, so that row is measuring something`, () => {
    const mine = found().filter((one) => one.shape === shape);
    assert.equal(mine.length, 1, `${mine.length} ${shape}(s) on ${TOOL}, and ${row.interface} owns one`);
    assert.equal(mine[0].where, row.interface, `the one ${shape} is not at ${row.interface}`);
  });
}

test("a second caller of the create fails, is named by line, and is told what to call instead", () => {
  const second = `const answer = await write("${TOOL}", { action: "create", data });\n`;
  const said = writerProblems(writesIn(`const first = 1;\n${second}`, "plugin/src/tools/elsewhere.mjs"));
  assert.equal(said.length, 1, "a second caller of the create passed");
  assert.match(said[0], /^plugin\/src\/tools\/elsewhere\.mjs:2 writes/u, said[0]);
  assert.match(said[0], /fileIssue/u, "a refusal has to name what to call instead");
});

test("a second caller of the update fails, is named by line, and is told what to call instead", () => {
  const second = `await write("${TOOL}", { action: "update", documentId, data: { plan } });\n`;
  const said = writerProblems(writesIn(`const first = 1;\nconst next = 2;\n${second}`, "plugin/src/flow/second.mjs"));
  assert.equal(said.length, 1, "a second caller of the update passed");
  assert.match(said[0], /^plugin\/src\/flow\/second\.mjs:3 writes/u, said[0]);
  assert.match(said[0], /writeField/u, "a refusal has to name what to call instead");
  assert.match(said[0], /plugin\/src\/tracker\/field-write\.mjs/u, "and where that one place is");
});

/* One message for two rules would send a stray create to the field writer and a stray update to the
   filing route, which is the one thing a reader of either refusal would act on. */
test("the refusal says which of the two call shapes it judges", () => {
  const at = (shape) =>
    writerProblems(writesIn(`write("${TOOL}", { action: "${shape}", data });`, "plugin/src/one.mjs"))[0];
  assert.match(at("create"), /action: "create"/u);
  assert.match(at("update"), /action: "update"/u);
  assert.doesNotMatch(at("create"), /writeField/u, "a create is not answered with the field writer");
  assert.doesNotMatch(at("update"), /fileIssue/u, "and an update is not answered with the filing route");
});

test("a write on another tool is not this rule's, and neither is one nobody wrote out", () => {
  assert.deepEqual(writesIn(`write("forge_comments", { action: "create", data });`, "one.mjs"), []);
  assert.deepEqual(writesIn(`write("forge_comments", { action: "update", data });`, "one.mjs"), []);
  assert.deepEqual(writesIn(`write("${TOOL}", { action, data });`, "two.mjs"), [],
    "an action handed in is a caller passing a value, not a second decision about a write");
  assert.deepEqual(writesIn(`scoped("${TOOL}", { action: "list", filters });`, "three.mjs"), []);
  assert.deepEqual(writesIn(`write("${TOOL}", { action: "transition", data });`, "four.mjs"), [],
    "a transition is forge advance's and is judged by neither row");
});

/* `forge new`'s filing branch and `forge feedback`'s route say the same four things about a filing,
   and said them separately until one of them stopped echoing a fold's comment (ISS-348). */
test("one module formats a filing's reply, and it is the one the routes call", () => {
  const said = sources().flatMap(({ rel, text }) => saidIn(text, rel));
  assert.ok(said.length > 0, "no formatter call found anywhere; the selector matches too little");
  assert.deepEqual(sayProblems(said), []);
  for (const what of SAYS.formatters) {
    assert.ok(said.some((one) => one.what === what), `${what} is formatted nowhere, so that name is stale`);
  }
});

test("a second route formatting a filing's reply fails, by line, and is told what to call instead", () => {
  const second = "console.log(filedAs(answer, said));\n";
  const said = sayProblems(saidIn(`const first = 1;\n${second}`, "plugin/src/tools/elsewhere.mjs"));
  assert.equal(said.length, 1, "a second route printing its own filed-as line passed");
  assert.match(said[0], /^plugin\/src\/tools\/elsewhere\.mjs:2 formats/u, said[0]);
  assert.match(said[0], /fileAndSay/u, "a refusal has to name what to call instead");
  assert.match(said[0], /plugin\/src\/tracker\/filing\/say\.mjs/u, "and where that one place is");
});

/* The rule is about a second copy of the reply, so the route that files without printing one, and
   the standalone comment verb's own landed line, are neither of them this rule's. */
test("filing without saying, and a comment's own landed line, are not this rule's", () => {
  assert.deepEqual(saidIn("const filed = await fileIssue(asked);", "plugin/src/tools/release.mjs"), []);
  assert.deepEqual(saidIn("return sayLanded(await commentLanded(issue, posted, ref));", "plugin/src/commands.mjs"), [],
    "a comment is no filing, and the verb that posts one says so itself");
});
