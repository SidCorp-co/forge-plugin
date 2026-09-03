import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { commentSentences, load, sentences } from "../src/checks/duplication.mjs";

const A = "The sequence assigns a master-data code whenever the field is left blank.";
const B = "Uniqueness of that code is a database constraint and not application discipline.";

test("a run of line comments is one block, so a sentence may span two lines", () => {
  const found = commentSentences(`// The sequence assigns a master-data code whenever\n// the field is left blank.\nconst x = 1;\n`);
  assert.deepEqual(found, ["The sequence assigns a master-data code whenever the field is left blank."]);
});

test("a blank line ends the run, so two blocks stay two units", () => {
  assert.equal(commentSentences(`// ${A}\n\n// ${B}\n`).length, 2);
});

test("a block comment loses its leading stars", () => {
  assert.deepEqual(commentSentences(`/**\n * ${A}\n */\n`), [A]);
});

test("a directive is not a unit of prose", () => {
  assert.deepEqual(commentSentences(`// eslint-disable-next-line no-console -- ${A}\n`), []);
});

test("`restated: deliberate` waives the block beneath it, not itself", () => {
  const waived = `// restated: deliberate — the mirror case, and the contrast is why both are written\n// ${A}\n`;
  assert.deepEqual(commentSentences(waived), []);
  // Reaching only one block is the point: the next one is measured again.
  assert.deepEqual(commentSentences(`${waived}\n// ${B}\n`), [B]);
});

test("a bare marker waives nothing, because the reason is mandatory", () => {
  // Not a waiver is not a directive either, so it stays ordinary prose and joins the run below it.
  const found = commentSentences(`// restated: deliberate\n// ${A}\n`);
  assert.equal(found.length, 1);
  assert.match(found[0], /The sequence assigns a master-data code/);
});

test("code carries comments and markdown carries prose", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-dup-"));
  mkdirSync(join(root, "vendor"));
  writeFileSync(join(root, "a.mjs"), `const s = 1;\n// ${A}\n`);
  writeFileSync(join(root, "b.md"), `# Heading\n\n${B}\n`);
  writeFileSync(join(root, "vendor", "c.mjs"), `// ${B}\n`);

  assert.deepEqual(load(root, new Set(["vendor"])).map(([label]) => label).sort(), ["a.mjs", "b.md"]);
  assert.deepEqual(load(root, new Set(), "comments").map(([label]) => label).sort(), [
    "a.mjs",
    join("vendor", "c.mjs"),
  ]);
  assert.deepEqual(load(root, new Set(), "prose").map(([label]) => label), ["b.md"]);
});

test("a glob is not a block comment, however much it looks like one", () => {
  const config = `export default [{ ignores: ["dist/**", "node_modules/**"] }];\n// ${A}\n`;
  assert.deepEqual(commentSentences(config), [A]);
});

test("a markdown heading is not prose, so it is never a unit", () => {
  assert.deepEqual(sentences(`# ${A}\n\n${B}\n`), [B]);
});
