/* What one step's spend is read to be, off the record and before the step is spawned. The context case is the one a
   reader of this line gets wrong first: a set recorded under another context had no chance of matching whatever its
   content, so the spend that follows is the key having moved and not a narrowing that stopped working (ISS-1746). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { contextOf, readsDir } from "../../../../../tools/gates/reads/sets.mjs";
import { launcherOf } from "../../../../../tools/gates/steps.mjs";
import { spendOf } from "../../../../../tools/gates/report/spend.mjs";
import { fileTimesPath } from "../../../../../tools/gates/timing.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const FIRST = "a.test.mjs";

const step = (over = {}) => ({ label: "test", tests: true, files: [FIRST, "b.test.mjs"], argv: ["node", "--test"],
  known: 4, held: ["c.test.mjs", "d.test.mjs"], closures: new Map(), ...over });

const setFor = (dir, file, body) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `0123456789ab.${file.replace(/[^\w.-]+/gu, "-")}`),
    `${JSON.stringify({ file, paths: [], dirs: [], trees: [], ...body })}\n`);
};

const room = (run) => {
  const at = tempRoom("gate-spend-");
  try {
    mkdirSync(at, { recursive: true });
    run(at);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
};

test("a step whose unit is not the test file has no spend to read", () => {
  assert.equal(spendOf({ label: "lint", tests: false }, { record: "/none", changed: [] }), null);
});

test("a run that read no diff reads no reach at all, rather than a reach of nought", () => {
  room((at) => {
    assert.equal(spendOf(step(), { record: at, changed: null }).reach, null);
    assert.deepEqual(spendOf(step(), { record: at, changed: [] }).reach,
      { spent: 2, reached: 0, blind: 2, elsewhere: 0, past: 0 });
  });
});

/* The step that narrowed nothing carries no closures, so the run that still has to report reads them itself: the digests
   it refused to trust answer whether a pass covers a file, which is not the question the reach asks. */
test("a step carrying no closures has them read off the record, and a file with none is blind", () => {
  room((at) => {
    setFor(readsDir(at), FIRST, { paths: ["plugin/src/one.mjs"] });
    assert.deepEqual(spendOf(step({ closures: undefined }), { record: at, changed: ["plugin/src/one.mjs"] }).reach,
      { spent: 2, reached: 1, blind: 1, elsewhere: 0, past: 0 });
  });
});

/* Read at the step's own launcher and never handed in, because that is the context the narrowing keyed on a moment ago:
   a report keyed on any other would answer for a spend that never happened. */
test("the context a spent file is measured against is this step's own, so a set keyed on another is counted as that", () => {
  room((at) => {
    const one = step({ closures: undefined });
    setFor(readsDir(at), FIRST, { context: contextOf(launcherOf(one)), paths: ["plugin/src/old.mjs"] });
    setFor(readsDir(at), "b.test.mjs", { context: "ffffffffffff", paths: ["plugin/src/old.mjs"] });
    assert.deepEqual(spendOf(one, { record: at, changed: ["plugin/src/new.mjs"] }).reach,
      { spent: 2, reached: 0, blind: 0, elsewhere: 1, past: 1 });
  });
});

test("the held-back files the record prices are summed and the rest counted, both off the step's whole list", () => {
  room((at) => {
    writeFileSync(fileTimesPath(at, "test"), "12.5s c.test.mjs\n3s e.test.mjs\n");
    const read = spendOf(step(), { record: at, changed: [] });
    assert.equal(read.spent, 2);
    assert.equal(read.known, 4);
    assert.equal(read.seconds, 12.5, "only the held-back files the record prices");
    assert.equal(read.unpriced, 1, "d.test.mjs is held back and priced nowhere");
  });
});
