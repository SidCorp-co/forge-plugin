import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { commentSentences, load, sentences } from "../../../src/checks/duplication.mjs";
import { cleanRepo, tempRoom } from "../../fixtures.mjs";

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
  const root = tempRoom("skill-dup-");
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

/* The list names untracked files, so a fixture a concurrent test process writes into the checkout is
   in it and gone by the read. One ENOENT there ended `forge doctor` mid-report and would end the
   learning gate mid-session, and the report that died named nothing about why (ISS-891). Staged and
   then deleted is the same list and the same read, without a second process to wait for. */
test("a file gone by the time the walk reads it is skipped, and the rest still carry their units", () => {
  const room = cleanRepo();
  writeFileSync(join(room, "a.mjs"), `// ${A}\n`);
  writeFileSync(join(room, "gone.mjs"), `// ${B}\n`);
  spawnSync("git", ["-C", room, "add", "gone.mjs"]);
  rmSync(join(room, "gone.mjs"));

  assert.deepEqual(load(room, new Set(), "comments").map(([label]) => label), ["a.mjs"]);
});

/* The other half, and the reason the tolerance is ENOENT and not every read error: `check:dup` reads
   no hits as a clean tree, so a file that is there and went unread would certify coverage nobody
   measured — which is the shape this project calls absent rather than red (consult 91d5cd, F1). */
test("a file that is there and cannot be read stops the walk rather than reading as a clean scan", () => {
  const root = tempRoom("skill-dup-held-");
  writeFileSync(join(root, "held.mjs"), `// ${B}\n`);
  chmodSync(join(root, "held.mjs"), 0o000);

  assert.throws(() => load(root, new Set(), "comments"), /EACCES/u);
});

test("a glob is not a block comment, however much it looks like one", () => {
  const config = `export default [{ ignores: ["dist/**", "node_modules/**"] }];\n// ${A}\n`;
  assert.deepEqual(commentSentences(config), [A]);
});

test("a markdown heading is not prose, so it is never a unit", () => {
  assert.deepEqual(sentences(`# ${A}\n\n${B}\n`), [B]);
});
