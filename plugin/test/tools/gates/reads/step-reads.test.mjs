/* A script step's `reads` decides both whether a change reaches it and what its digest covers, and
   nothing held it to what the step reads: one too narrow is skipped by the change that should run it
   and banks a pass that does not cover the path either. Three runs of one gate, a step's argument
   apart: reading outside its declaration, reading inside it, and a step nothing watched (ISS-1911). */
import assert from "node:assert/strict";
import test from "node:test";

import { landed, run, scratch } from "../scratch.mjs";

const READER = `import { readFileSync } from "node:fs";\nreadFileSync(process.argv[2]);\n`;

const gateReading = (name, path) => {
  const { work } = scratch(name, null, null,
    { needing: { step: "check:spec", command: `node plugin/src/reader.mjs ${path}` } });
  landed(work, "plugin/src/reader.mjs", READER);
  return run(work);
};

const outside = gateReading("gate-step-reads-outside", "docs/one.md");
const inside = gateReading("gate-step-reads-inside", "plugin/src/one.mjs");

test("a script step reading a path it does not declare fails the gate, named with the path", () => {
  assert.equal(outside.status, 1, `${outside.stdout}${outside.stderr}`);
  assert.match(outside.stderr, /Gate failed: check:spec/u);
  assert.match(outside.stderr,
    /check:spec read docs\/one\.md \(path\), which the reads it declares in tools\/gates\/steps\.mjs/u);
  assert.match(outside.stderr, /do not cover: \., docs\/requirements, plugin\/hooks\/vendor, plugin\/src/u);
});

test("the same step reading a path it does declare passes, and says what it was watched to ask for", () => {
  assert.equal(inside.status, 0, `${inside.stdout}${inside.stderr}`);
  assert.match(inside.stdout,
    /reads: check:spec was watched to ask this repository for 2 paths, every one of them inside what it declares/u);
});

test("a step the audit saw nothing under says its declaration went unchecked, not that it passed", () => {
  assert.match(inside.stdout,
    /reads: check:dup asked this repository for nothing the audit saw, so what it declares went unchecked here: plugin/u);
});
