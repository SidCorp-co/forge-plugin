/* A script step's `reads` decides both whether a change reaches it and what its digest covers, and
   nothing held it to what the step reads: one too narrow is skipped by the change that should run it
   and banks a pass that does not cover the path either. Four runs of one gate, a step's argument
   apart: reading outside its declaration, inside it, below the level it claims, and nothing at all,
   plus the one record a walk down from the roots would not reach (ISS-1911). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { escapesIn, stepSetFrom } from "../../../../../tools/gates/reads/sets.mjs";
import { landed, ROOT, run, scratch } from "../scratch.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const recordOf = (one) =>
  ({ argv: [], paths: [], dirs: [], trees: [], whole: [], spawned: [], blind: [], done: true, ...one });

const READER = `import { readdirSync, readFileSync } from "node:fs";
const [, , one, how] = process.argv;
if (how === "walk") readdirSync(one, { recursive: true }); else readFileSync(one);
`;

const gateReading = (name, how) => {
  const { work } = scratch(name, null, null,
    { needing: { step: "check:spec", command: `node plugin/src/reader.mjs ${how}` } });
  landed(work, "plugin/src/reader.mjs", READER);
  return run(work);
};

const outside = gateReading("gate-step-reads-outside", "docs/one.md");
const inside = gateReading("gate-step-reads-inside", "plugin/src/one.mjs");
const walked = gateReading("gate-step-reads-walked", "docs walk");

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

test("a step that walks a directory the root's own level does not reach is refused for the walk", () => {
  assert.equal(walked.status, 1, `${walked.stdout}${walked.stderr}`);
  assert.match(walked.stderr, /check:spec read docs \(walk\), which the reads it declares/u);
});

test("a child record no root reaches is judged too, its parent having left an unfinished one", () => {
  const at = tempRoom("gate-step-reads-orphan-");
  writeFileSync(join(at, "own-1.json"), `${JSON.stringify(recordOf(
    { ticket: null, spawned: [{ ticket: "1-1", file: "node", cwd: at, args: [] }], done: false }))}\n`);
  writeFileSync(join(at, "1-1.json"),
    `${JSON.stringify(recordOf({ ticket: "1-1", paths: ["docs/one.md"] }))}\n`);
  assert.deepEqual(escapesIn(stepSetFrom(at, ROOT), ["plugin/src"]), [{ kind: "path", one: "docs/one.md" }]);
});
