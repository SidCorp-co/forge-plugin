/* One fixture omitting the retry ladder's own setting cost a single case 28.4s of sleeping while the
   suite read green (ISS-2040). Fixing that one is an edit; holding the rule is this file. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SETTING, laddersIn } from "../../../src/checks/suite/fixture-retry.mjs";

const SUITE = new URL("../../", import.meta.url).pathname;
// The tests of this repository's own scripts, which sit outside plugin/ so the plugin travels alone (ISS-2537).
const TOOLS_SUITE = new URL("../../../../tools/test/", import.meta.url).pathname;
const MADE_UP = "plugin/test/made-up.test.mjs";
/* Every source below opens with the statement that writes the store, that being half of what the
   rule reads; a case about the keys alone would pass for the wrong reason. */
const WROTE = 'writeFileSync(join(home, "forge", "config.json"), JSON.stringify(';

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs")) out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
    }
  };
  walk(SUITE, "plugin/test");
  walk(TOOLS_SUITE, "tools/test");
  return out;
};

test("the walk reaches the suite, so a clean answer is a clean suite and not an empty selector", () => {
  const walked = files();
  assert.ok(walked.length > 30, `${walked.length} file(s) under plugin/test and tools/test; the selector matches too little`);
  assert.ok(walked.some((one) => one.rel === "tools/test/run/run-fixtures.mjs"), "the tests of tools/ are not reached");
  assert.ok(walked.some((one) => one.rel === "plugin/test/stats/corpus/guide-parts.test.mjs"),
    "a nested file is not reached");
});

test("no fixture tracker configuration in this suite leaves the retry ladder at the transport's own figure", () => {
  assert.deepEqual(files().flatMap((one) => laddersIn(one.text, one.rel)), []);
});

test("a configuration naming a tracker and a token without the setting is refused, at the line it opens on", () => {
  const said = laddersIn(`${WROTE}{\n  url: "https://nowhere.invalid/mcp",\n  token: "t",\n}));\n`, MADE_UP);
  assert.equal(said.length, 1, said.join(" "));
  assert.match(said[0], /^plugin\/test\/made-up\.test\.mjs:1 writes a fixture tracker configuration/u, said[0]);
  assert.match(said[0], new RegExp(`Name it: ${SETTING}: 0\\.`, "u"), "a refusal has to name what to write instead");
});

test("a shorthand key is read as a key, so a configuration built from variables is refused too", () => {
  assert.equal(laddersIn(`${WROTE}{ url, token }));\n`, MADE_UP).length, 1);
});

const ACCEPTED = {
  "a configuration that names the setting": `${WROTE}{ url: "u", token: "t", retrySeconds: 0 }));\n`,
  "a configuration that names the setting as a shorthand key": `${WROTE}{ url: "u", token: "t", retrySeconds }));\n`,
  "a store that names no token, which is no tracker's": `${WROTE}{ url: "https://vi.example", model: "m" }));\n`,
  "a store that names no endpoint": `${WROTE}{ token: "t", waitSeconds: 2 }));\n`,
  "the refused shape inside a comment": `/* ${WROTE}{ url: "u", token: "t" })); */\nconst n = 1;\n`,
  "the refused shape inside a string": 'assert.match(said, \'{ url: "u", token: "t" }\');\n',
  /* Another service's session carries a url and a token too and answers to no ladder of the
     tracker's transport, so what tells them apart is the file the statement writes. */
  "a session of another service, which names no store of this plugin's": 'const s = session({ url: "https://coolify.test/api/v1", token: "tok-1" }, {});\n',
  "a literal handed to a stub rather than written to the store": 'const said = shaped({ url: "https://stub.example/mcp", token: "t" });\n',
};

for (const [what, source] of Object.entries(ACCEPTED)) {
  test(`${what} is not a finding`, () => {
    assert.deepEqual(laddersIn(source, MADE_UP), []);
  });
}

/* A tracker configuration carries other stores inside it, each with a url of its own, and the ladder
   is the outer one's business alone. Read as one text, the inner url would answer the rule for the
   outer object and a real omission would read clean. */
test("a nested store's endpoint answers for the nested store and not for the one around it", () => {
  const nested = `${WROTE}{ url: "u", token: "t", retrySeconds: 0, chatgpt: { url: "g", key: "k" } }));\n`;
  assert.deepEqual(laddersIn(nested, MADE_UP), [], "the inner store names no token, so nothing is owed of it");
  const missing = `${WROTE}{ url: "u", token: "t", chatgpt: { url: "g", key: "k", retrySeconds: 0 } }));\n`;
  assert.equal(laddersIn(missing, MADE_UP).length, 1,
    "and a setting written into the nested store does not answer for the outer one");
});

/* The statement and not the file: one test file writes the store in one place and hands a shape to a
   stub in another, and a rule reading the file whole would answer for both alike. */
test("a literal in one statement does not carry the store another statement names", () => {
  const two = `${WROTE}{ url: "u", token: "t", retrySeconds: 0 }));\n`
    + 'const said = shaped({ url: "u", token: "t" });\n';
  assert.deepEqual(laddersIn(two, MADE_UP), []);
});

/* Both halves of the window come off the blanked copy, so neither a semicolon nor a brace a comment
   holds moves it: a rule that read the source for its bounds would find the comment's semicolon and
   answer about a statement that stops before the literal. */
test("a semicolon inside a comment does not cut the statement short of the literal", () => {
  const said = laddersIn(`${WROTE}/* a fixture; unreachable */ { url: "u", token: "t" }));\n`, MADE_UP);
  assert.equal(said.length, 1, said.join(" "));
});

