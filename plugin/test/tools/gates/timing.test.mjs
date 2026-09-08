/* `tools/gates/timing.mjs` alone — the whole-run series beside the step records, on a planted file rather than a checkout, every step of a scratch one being `node -e ""` and measuring process startup. The runner's own behaviour is ../gates.test.mjs. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CEILING_SECONDS, REVIEW, ceilingOf, fileTimesPath, recordRun, runSays, runSeries } from "../../../../tools/gates/timing.mjs";
import { tempRoom } from "../../fixtures.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");

const planted = (lines) => {
  const dir = join(tempRoom("said-"), "gate-ledger");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "runs"), lines.length === 0 ? "" : `${lines.join("\n")}\n`);
  return dir;
};

const FULL = "2026-01-01T00:00:00.000Z 80s 12/12";
// A review figure planted beside the runs, so what these cases pin is the arithmetic and not this repository's number.
const REVIEWED = { seconds: 400, load: 0.2, cores: 8, on: "2025-12-01", issue: "ISS-0" };
const says = (lines) => runSays(planted(lines), REVIEWED);

test("a figure is compared only with a whole-gate figure, and what is comparable is always named", () => {
  assert.match(says([]), /no run is recorded/u);
  assert.match(says([]), /npm run check -- --full/u);

  // The shape this repository produces: scoped ship-gate runs between the full ones, which the newest two *runs* would never subtract across.
  const apart = says([FULL, "2026-01-02T00:00:00.000Z 9s 3/12", "2026-01-03T00:00:00.000Z 100s 12/12"]);
  assert.match(apart, /100s over 12 of 12 step\(s\) on 2026-01-03, 0\.25x the 400s the review of 2025-12-01 measured under load 0\.2 on 8 core\(s\) \(ISS-0\); 1\.25x the 80s before it/u,
    `two whole-gate figures with a scoped run between them were not subtracted:\n${apart}`);

  const scoped = says([FULL, "2026-01-03T00:00:00.000Z 9s 3/12"]);
  assert.match(scoped, /^9s over 3 of 12 step\(s\) on 2026-01-03, which is scoped and measures less/u, scoped);
  assert.match(scoped, /the whole gate last took 80s over 12 of 12 step\(s\) on 2026-01-01, 0\.20x the 400s the review of 2025-12-01 measured under load 0\.2 on 8 core\(s\) \(ISS-0\); the only whole-gate figure recorded/u,
    `a scoped run that names no comparable figure leaves the reader to assume one:\n${scoped}`);

  const first = says(["2026-01-04T00:00:00.000Z 9s 3/12"]);
  assert.match(first, /no run recorded spent the whole table; npm run check -- --full plants a figure/u, first);

  // A table that gained a step is another gate, and subtracting across the two reports the addition as drift, which is what a review would act on.
  const grown = says([FULL, "2026-01-07T00:00:00.000Z 100s 13/13"]);
  assert.match(grown, /100s over 13 of 13 step\(s\) on 2026-01-07, 0\.25x the 400s [^;]+; the one before it was 80s over 12 of 12 step\(s\)/u, grown);
  assert.match(grown, /a table of another size, so nothing is subtracted/u, grown);
  assert.doesNotMatch(grown, /x the 80s/u, `a 12-step gate was subtracted from a 13-step one:\n${grown}`);

  const sameSize = says([FULL, "2026-01-08T00:00:00.000Z 40s 13/13", "2026-01-09T00:00:00.000Z 50s 13/13"]);
  assert.match(sameSize, /50s over 13 of 13 step\(s\) on 2026-01-09, 0\.13x the 400s [^;]+; 1\.25x the 40s before it/u,
    `two figures over the same table were not subtracted:\n${sameSize}`);

  // A gate under a second is the scratch case, and a ratio over it is a division by zero.
  assert.match(says(["2026-01-05T00:00:00.000Z 0s 12/12", "2026-01-06T00:00:00.000Z 3s 12/12"]),
    /3s more than the one before it, which took under a second, so there is no ratio/u);
});

/* The load on a run's line is context; the review figure, said with the load it was measured under, is
   what a regression shows against — a rolling baseline taken under load would read it as an improvement (ISS-736). */
test("a regression against the review figure is said even when the run before it was slower under load", () => {
  const review = { seconds: 60, load: 1.1, cores: 6, on: "2026-09-01", issue: "ISS-1" };
  const said = runSays(planted(["2026-09-08T08:00:00.000Z 100s 14/14 load 9.00/6", "2026-09-08T09:00:00.000Z 90s 14/14 load 0.50/6"]), review);
  assert.equal(said, "90s over 14 of 14 step(s) on 2026-09-08, load 0.5 on 6 core(s), 1.50x the 60s the review of 2026-09-01 measured under load 1.1 on 6 core(s) (ISS-1), "
    + "over the ceiling of 75s that review set; 0.90x the 100s before it (its line said load 9.00/6)");
});

test("under the ceiling nothing is said about it, and a line from before the load clause compares without one", () => {
  const review = { seconds: 100, load: 1.1, cores: 6, on: "2026-09-01", issue: "ISS-1" };
  const said = runSays(planted(["2026-09-04T18:05:41.583Z 69s 14/14", "2026-09-08T09:00:00.000Z 80s 14/14 load 0.50/6"]), review);
  assert.equal(said, "80s over 14 of 14 step(s) on 2026-09-08, load 0.5 on 6 core(s), 0.80x the 100s the review of 2026-09-01 measured under load 1.1 on 6 core(s) (ISS-1); 1.16x the 69s before it");
  assert.equal(ceilingOf({ seconds: 100 }), 125);
  assert.equal(CEILING_SECONDS, Math.round(REVIEW.seconds * 1.25), "the ceiling is the drift trigger applied to the review figure");
});

test("a line without a load clause and one with it both read as runs, and a recorded run writes what it was given", () => {
  const dir = planted(["2026-09-04T18:05:41.583Z 69s 12/12", "2026-09-08T09:00:00.000Z 100s 14/14 load 7.25/6"]);
  recordRun(dir, { seconds: 90, ran: 14, total: 14, load: 1.5, cores: 6 });
  recordRun(dir, { seconds: 91, ran: 3, total: 14 });
  const [old, fresh, withLoad, without] = runSeries(dir);
  assert.deepEqual(old, { at: "2026-09-04T18:05:41.583Z", seconds: 69, ran: 12, total: 12, load: null, cores: null });
  assert.deepEqual(fresh, { at: "2026-09-08T09:00:00.000Z", seconds: 100, ran: 14, total: 14, load: 7.25, cores: 6 });
  assert.equal(withLoad.load, 1.5);
  assert.equal(without.load, null);
  assert.equal(fileTimesPath("/ledger", "test:tree"), join("/ledger", "test-tree-files"), "the per-file record is named for its step");
});

// Any trimming reads the file first, and this one is shared, so a stale snapshot renamed over it would drop the figure a release is about to read.
test("the record is only ever appended, however far past a reader's needs it has grown", () => {
  const runs = (count) => Array.from({ length: count }, (one, nth) => `2026-01-01T00:00:0${nth % 10}.000Z ${nth}s 12/12`);
  for (const count of [30, 65]) {
    const dir = planted(runs(count));
    recordRun(dir, { seconds: 7, ran: 12, total: 12 });
    const held = runSeries(dir);
    assert.equal(held.length, count + 1, `${count} run(s) plus one left ${held.length}: the file was rewritten`);
    assert.equal(held.at(-1).seconds, 7, "the fresh figure is the last line");
    assert.equal(held[0].seconds, 0, "the oldest line went, and only a rewrite can drop one");
  }
});

// The case above proves the write carries nothing it read; this pins what follows from it, over real processes rather than one module called twice.
test("eight runs recording at once each leave their figure", () => {
  const dir = planted([]);
  const write = `import { recordRun } from "${join(ROOT, "tools", "gates", "timing.mjs")}";
    recordRun(process.argv[2], { seconds: Number(process.argv[3]), ran: 3, total: 12 });`;
  const at = join(dir, "write.mjs");
  writeFileSync(at, write);
  // Backgrounded and waited for: eight spawnSync calls would run one after another.
  const together = spawnSync("sh",
    ["-c", `for n in 1 2 3 4 5 6 7 8; do "${process.execPath}" "${at}" "${dir}" $n & done; wait`],
    { encoding: "utf8" });
  assert.equal(together.status, 0, together.stderr);
  const seconds = runSeries(dir).map((run) => run.seconds).sort((a, b) => a - b);
  assert.deepEqual(seconds, [1, 2, 3, 4, 5, 6, 7, 8], `8 runs recorded ${seconds.length} figure(s)`);
});
