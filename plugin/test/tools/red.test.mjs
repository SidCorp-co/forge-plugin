/* The command that watches one case go red twice. Each case below fails without the reading it
   holds, and the fourth is the whole reason the target's own result is read rather than the run's
   exit status: a file red for a sibling reads as a red watched twice to anything counting statuses. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resultsFrom } from "../../../tools/gates/counted.mjs";
import { tempRoom } from "../fixtures.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const RED = join(ROOT, "tools", "red.mjs");

/* The mark sits under the reading's own temporary directory, which the command gives each of the two
   afresh, so what the file's earlier case wrote reaches the later one and no reading reaches the
   next. That is an ordering this fixture decides rather than a race it hopes for. */
const PREAMBLE = `import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const mark = join(process.env.TMPDIR, "mark");
const writes = () => writeFileSync(mark, "x");
const reads = () => assert.ok(existsSync(mark), "the mark is not there");
`;

const watching = (name, body, target) => {
  const at = join(tempRoom(`red-${name}-`), "subject.test.mjs");
  writeFileSync(at, `${PREAMBLE}${body}`);
  return spawnSync(process.execPath, [RED, at, target], { encoding: "utf8", cwd: ROOT, env: process.env });
};

const FAILS = `test("the subject", () => { assert.fail("always"); });\n`;
const PASSES = `test("the subject", () => {});\n`;
const WRITES = `test("the case that writes the mark", writes);\n`;
const READS = `test("the subject", reads);\n`;

test("a case that fails in both readings is a red watched twice", () => {
  const run = watching("twice", FAILS, "the subject");
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.stdout, /alone\s+fail\n\s+in its file\s+fail/u, run.stdout);
  assert.match(run.stdout, /The red is this case's own/u, run.stdout);
});

test("a case that passes in both readings watched nothing", () => {
  const run = watching("nothing", PASSES, "the subject");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /alone\s+pass\n\s+in its file\s+pass/u, run.stdout);
  assert.match(run.stdout, /Nothing was watched/u, run.stdout);
});

test("a case red alone and green behind the case that writes its mark is a disagreement", () => {
  const run = watching("apart", `${WRITES}${READS}`, "the subject");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /alone\s+fail\n\s+in its file\s+pass/u, run.stdout);
  assert.match(run.stdout, /decided by what ran before it/u, run.stdout);
});

test("a run turned red by a sibling is not the watched case turning red", () => {
  const sibling = `test("the sibling that fails", () => { assert.fail("sibling"); });\n`;
  const run = watching("sibling", `${sibling}${WRITES}${READS}`, "the subject");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /alone\s+fail\n\s+in its file\s+pass/u, run.stdout);
  assert.match(run.stdout, /decided by what ran before it/u, run.stdout);
});

test("a name no top-level case carries is refused, with the names that file does carry", () => {
  const run = watching("absent", PASSES, "the subjekt");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /no top-level case of .+ is named/u, run.stdout);
  assert.match(run.stdout, /pass\s+the subject/u, run.stdout);
});

test("a name two top-level cases carry is refused rather than read", () => {
  const run = watching("twins", `${PASSES}${FAILS}`, "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /2 top-level cases of .+ are named/u, run.stdout);
});

test("a skipped target is refused rather than read as a case that passed", () => {
  const run = watching("skip", `test("the subject", { skip: true }, () => {});\n`, "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /the case was skipped/u, run.stdout);
});

test("a target marked todo is refused rather than read as a case that passed", () => {
  const run = watching("todo", `test("the subject", { todo: true }, () => {});\n`, "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /the case is marked todo/u, run.stdout);
});

test("a file that throws before the target is refused, not read as a case that passed", () => {
  const run = watching("throws", `throw new Error("this file does not load");\n${PASSES}`, "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /left no roster that answers for itself/u, run.stdout);
});

test("a file whose worker exits mid-run cannot say the name it recorded is carried once", () => {
  const leaves = `test("the subject", async () => { await new Promise((r) => setTimeout(r, 30)); process.exit(1); });\n`;
  const run = watching("half", `${FAILS}${leaves}`, "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /left no roster that answers for itself/u, run.stdout);
  assert.doesNotMatch(run.stdout, /The red is this case's own/u, run.stdout);
});

test("a todo target that throws is refused rather than read as a red", () => {
  const run = watching("todo-throws",
    `test("the subject", { todo: true }, () => { assert.fail("boom"); });\n`, "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /the case is marked todo/u, run.stdout);
});

test("a target cancelled before its body runs is refused, the run naming no kind of failure", () => {
  const run = watching("cancelled",
    `test("the subject", { signal: AbortSignal.abort() }, async () => { await new Promise(() => {}); });\n`,
    "the subject");
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /naming any kind of failure for it/u, run.stdout);
});

test("a roster whose count does not answer for its rows is not a reading", () => {
  const at = join(tempRoom("red-short-"), "record.jsonl");
  const row = `${JSON.stringify({ name: "the subject", outcome: "fail" })}\n`;
  writeFileSync(at, row);
  assert.equal(resultsFrom(at), null, "a record with no count read as a roster");
  writeFileSync(at, `${row}${JSON.stringify({ topLevel: null })}\n`);
  assert.equal(resultsFrom(at), null, "a run that reported no count read as a roster");
  writeFileSync(at, `${row}${JSON.stringify({ topLevel: 2 })}\n`);
  assert.equal(resultsFrom(at), null, "a count of two read a roster of one");
  writeFileSync(at, `${row}${JSON.stringify({ topLevel: 1 })}\n`);
  assert.deepEqual(resultsFrom(at), [{ name: "the subject", outcome: "fail" }], "a whole record refused");
});

test("the usage says what is compared and what each exit status means", () => {
  const run = spawnSync(process.execPath, [RED, "-h"], { encoding: "utf8", cwd: ROOT, env: process.env });
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.stdout, /never the run's exit status/u, run.stdout);
  assert.match(run.stdout, /Exit 0 where the two are red/u, run.stdout);
});

test("a call naming a file and no case prints the usage and refuses", () => {
  const run = spawnSync(process.execPath, [RED, RED], { encoding: "utf8", cwd: ROOT, env: process.env });
  assert.equal(run.status, 2, run.stdout);
  assert.match(run.stdout, /Usage: node tools\/red\.mjs/u, run.stdout);
});
