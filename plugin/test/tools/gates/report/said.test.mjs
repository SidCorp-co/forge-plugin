/* What a run says it spent, in the unit the step it spent it on has. Every case here fails against a
   report that counts steps alone, which is what a narrowing that had stopped working printed for a day
   after ISS-654 landed (ISS-1746). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { ledgerSaid, readsSaid, stepSaid, verdictSaid } from "../../../../../tools/gates/report/said.mjs";
import { fileSeconds, fileTimesPath } from "../../../../../tools/gates/timing.mjs";
import { NAMED, landed, run, scratch, write } from "../scratch.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const spend = (over = {}) => ({ spent: 6, known: 290, unpriced: 0, seconds: 604.4, reach: null, ...over });

const reads = (over = {}) => ({
  step: { label: "test" }, kept: [{ file: "plugin/test/one.test.mjs", digest: "0123456789ab" }],
  spend: ["plugin/test/two.test.mjs"], unknown: [], ...over,
});

const SECOND = "plugin/test/tools/two.test.mjs";
const READS = (source) => `import test from "node:test";\nimport { readFileSync } from "node:fs";\n`
  + `test("the green case of ${SECOND}", () => { readFileSync("${source}"); });\n`;

test("a step that held files back names the files it spent of the files it knows, and the seconds either side", () => {
  assert.equal(stepSaid("test", 41, spend()),
    "--- test: 6 of 290 file(s), 41s (284 held back, 604s when they last ran)");
});

test("a step that held nothing back says so rather than leaving the fraction to be read as a narrowing", () => {
  assert.equal(stepSaid("test", 655, spend({ spent: 290, seconds: 0 })),
    "--- test: 290 of 290 file(s), 655s (none held back)");
});

/* The record is rewritten by every run of the step, a narrowed one included, so it prices only what
   some run really ran: the count it prices nothing for stands beside the sum and never inside it. */
test("held-back files the record prices nothing for are counted beside the sum and not added into it", () => {
  assert.equal(stepSaid("test", 41, spend({ unpriced: 12 })),
    "--- test: 6 of 290 file(s), 41s (284 held back, 604s when they last ran, 12 the record prices nothing for)");
  assert.equal(stepSaid("test", 41, spend({ unpriced: 284, seconds: 0 })),
    "--- test: 6 of 290 file(s), 41s (284 held back, and the record prices none of them)");
});

test("a step whose unit is not the file prints its seconds and no fraction", () => {
  assert.equal(stepSaid("lint", 11, null), "--- lint: 11s");
});

test("the line carries the arithmetic of the invariant, in files, where the run knows what changed", () => {
  assert.equal(stepSaid("test", 41, spend({ reach: { spent: 6, reached: 4, blind: 2, elsewhere: 0, past: 0 } })),
    "--- test: 6 of 290 file(s), 41s (284 held back, 604s when they last ran; spent 6 = 4 reached + 2 blind)");
});

/* Named and never called a waste: the listing rule over-counts the reach and a set recorded before the
   file gained a dependency under-counts it, so the excess is what neither count explains and no more. */
test("a spend running past reached plus blind names the excess as its own count", () => {
  assert.equal(stepSaid("test", 655, spend({ spent: 290, seconds: 0, reach: { spent: 290, reached: 3, blind: 76, elsewhere: 0, past: 211 } })),
    "--- test: 290 of 290 file(s), 655s (none held back; spent 290 > 3 reached + 76 blind, 211 accounted for neither way)");
});

/* Every context is digested from the reads collector, so a change to it leaves no set able to match and the whole spend
   follows from the change. Unnamed, the first line anybody ever sees from this feature reads as a defect — and the change
   most likely to produce it is a change to the narrower, which is every issue in this family. */
test("a spend under a context the record does not hold is named as that, beside what nothing explains", () => {
  assert.equal(stepSaid("test", 1321, spend({ spent: 292, known: 292, seconds: 0,
    reach: { spent: 292, reached: 12, blind: 78, elsewhere: 202, past: 0 } })),
    "--- test: 292 of 292 file(s), 1321s (none held back; spent 292 > 12 reached + 78 blind,"
    + " 202 spent under a context the record does not hold)");
  assert.equal(stepSaid("test", 1321, spend({ spent: 292, known: 292, seconds: 0,
    reach: { spent: 292, reached: 12, blind: 78, elsewhere: 180, past: 22 } })),
    "--- test: 292 of 292 file(s), 1321s (none held back; spent 292 > 12 reached + 78 blind,"
    + " 180 spent under a context the record does not hold and 22 accounted for neither way)");
});

test("a run that never learned which paths changed carries no count of reach, rather than a reach of nought", () => {
  assert.equal(stepSaid("test", 655, spend({ spent: 290, seconds: 0 })),
    "--- test: 290 of 290 file(s), 655s (none held back)");
});

test("a step the record holds no pass for at any content is told apart from one whose passes are stale", () => {
  assert.match(ledgerSaid({ label: "test", digest: "0123456789ab", contents: 0 }),
    /^spend test {19}the record holds no pass for this step at any content$/u);
  assert.match(ledgerSaid({ label: "test", digest: "0123456789ab", contents: 7 }),
    /digest 0123456789ab, and the 7 pass\(s?e?s?\) it holds for this step are at other content$/u);
});

test("the files a step spent are told apart by whether the record holds any set for them at all", () => {
  assert.equal(readsSaid(reads()).at(-1),
    "spend 1 test file(s): every one has a recorded set, at other content");
  assert.equal(readsSaid(reads({ unknown: ["plugin/test/two.test.mjs"] })).at(-1),
    "spend 1 test file(s): the record holds no set for any of them");
  assert.equal(readsSaid(reads({ spend: ["a", "b", "c"], unknown: ["a"] })).at(-1),
    "spend 3 test file(s): 1 the record holds no set for at all, 2 whose recorded set is at other content");
});

test("a step that held every file back still prints its block, with no line claiming a spend", () => {
  const said = readsSaid(reads({ spend: [], unknown: [] }));
  assert.equal(said[0], "\n=== reads: test — 1 of 1 test file(s) already answered for at this content ===");
  assert.equal(said.length, 2, said.join("\n"));
});

test("the verdict line carries the fraction per step with a file unit, and the rest counted once", () => {
  assert.deepEqual(verdictSaid({ files: [{ step: "test", spent: 6, known: 290 }], unitless: 5 }),
    ["test 6 of 290 file(s)", "5 step(s) with no file unit ran whole"]);
  assert.deepEqual(verdictSaid({}), []);
});

test("the per-file record answers as nothing priced where it is absent, and by path where it is there", () => {
  const at = tempRoom("gate-report-times-");
  try {
    mkdirSync(at, { recursive: true });
    assert.equal(fileSeconds(at, "test").size, 0);
    writeFileSync(fileTimesPath(at, "test"), "307.8s plugin/test/tools/gates.test.mjs\n1.5s plugin/test/one.test.mjs\n");
    assert.equal(fileSeconds(at, "test").get("plugin/test/one.test.mjs"), 1.5);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The three states a run is really in, off the gate's own stdout: nothing banked, everything banked,
   and a narrowing that held one file of two back. The first is the one nothing printed. */
test("a run whose record holds nothing says so, of its steps and of its test files alike", () => {
  const { at, work } = scratch("report-empty", null, null);
  try {
    landed(work, "plugin/src/two.mjs", "two\n");
    landed(work, SECOND, READS("plugin/src/two.mjs"));
    const { stdout, status } = run(work);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /spend lint {19}the record holds no pass for this step at any content/u, stdout);
    assert.match(stdout, /=== reads: test — 0 of 2 test file\(s\) already answered for at this content ===/u, stdout);
    assert.match(stdout, /spend 2 test file\(s\): the record holds no set for any of them/u, stdout);
    assert.match(stdout, /--- test: 2 of 2 file\(s\), \d+s \(none held back; spent 2 = 0 reached \+ 2 blind\)/u, stdout);
    assert.match(stdout, new RegExp(String.raw`gate verdict: pass — \d+ of 14 step\(s\) in \d+s, test:tree ${NAMED.length} of ${NAMED.length} file\(s\), `, "u"), stdout);
    assert.match(stdout, /test 2 of 2 file\(s\), \d+ step\(s\) with no file unit ran whole/u, stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a run that held one test file of two back names both counts and prices what it held", () => {
  const { at, work } = scratch("report-narrowed", null, null);
  try {
    landed(work, "plugin/src/two.mjs", "two\n");
    landed(work, SECOND, READS("plugin/src/two.mjs"));
    assert.equal(run(work).status, 0);
    landed(work, "plugin/src/two.mjs", "two, moved\n");
    const { stdout, status } = run(work);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /=== reads: test — 1 of 2 test file\(s\) already answered for at this content ===/u, stdout);
    assert.match(stdout, /spend 1 test file\(s\): every one has a recorded set, at other content/u, stdout);
    assert.match(stdout, /--- test: 1 of 2 file\(s\), \d+s \(1 held back, \d+s when they last ran; spent 1 = 1 reached \+ 0 blind\)/u, stdout);
    assert.match(stdout, /gate verdict: pass — \d+ of 14 step\(s\) in \d+s, test 1 of 2 file\(s\)/u, stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The shape ISS-1739 wore for a day: the narrower answers for nothing because the execution context moved, so every file
   is spent while the change reaches one of them, and before this line the run printed what it prints with nothing to
   hold back. The record's own sets say which it was, so the excess is named rather than left for somebody to guess. */
test("a spend under a context the record does not hold is named as that, and a run with no diff names no reach", () => {
  const { at, work } = scratch("report-past", null, null);
  try {
    landed(work, "plugin/src/two.mjs", "two\n");
    landed(work, SECOND, READS("plugin/src/two.mjs"));
    assert.equal(run(work).status, 0);
    landed(work, "plugin/src/two.mjs", "two, moved\n");
    const moved = run(work, [], work, { NODE_OPTIONS: "--no-warnings" });
    assert.equal(moved.status, 0, moved.stdout);
    assert.match(moved.stdout,
      /--- test: 2 of 2 file\(s\), \d+s \(none held back; spent 2 > 1 reached \+ 0 blind, 1 spent under a context the record does not hold\)/u,
      moved.stdout);
    const whole = run(work, ["--full"]);
    assert.equal(whole.status, 0, whole.stdout);
    assert.match(whole.stdout, /--- test: 2 of 2 file\(s\), \d+s \(none held back\)\n/u, whole.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a step every one of whose files the record answers for prints its block and is never spent", () => {
  const { at, work } = scratch("report-whole-held", null, null);
  try {
    write(work, "plugin/src/three.mjs", "three\n");
    landed(work, "plugin/src/two.mjs", "two\n");
    assert.equal(run(work).status, 0);
    landed(work, "plugin/src/three.mjs", "three, moved\n");
    const { stdout, status } = run(work);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /=== reads: test — 1 of 1 test file\(s\) already answered for at this content ===/u, stdout);
    assert.doesNotMatch(stdout, /--- test: \d+ of 1 file\(s\)/u, stdout);
    assert.match(stdout, new RegExp(String.raw`=== reads: test:tree — ${NAMED.length} of ${NAMED.length} test file\(s\)`, "u"), stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
