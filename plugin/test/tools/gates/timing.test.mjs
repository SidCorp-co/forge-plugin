/* `tools/gates/timing.mjs` alone — the whole-run series beside the step records, on a planted file rather than a checkout, every step of a scratch one being `node -e ""` and measuring process startup. The runner's own behaviour is ../gates.test.mjs. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { recordRun, runSays, runSeries } from "../../../../tools/gates/timing.mjs";
import { tempRoom } from "../../fixtures.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");

const planted = (lines) => {
  const dir = join(tempRoom("said-"), "gate-ledger");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "runs"), lines.length === 0 ? "" : `${lines.join("\n")}\n`);
  return dir;
};

const FULL = "2026-01-01T00:00:00.000Z 80s 12/12";

test("a figure is compared only with a whole-gate figure, and what is comparable is always named", () => {
  assert.match(runSays(planted([])), /no run is recorded/u);
  assert.match(runSays(planted([])), /npm run check -- --full/u);

  // The shape this repository produces: scoped ship-gate runs between the full ones, which the newest two *runs* would never subtract across.
  const apart = runSays(planted([FULL, "2026-01-02T00:00:00.000Z 9s 3/12", "2026-01-03T00:00:00.000Z 100s 12/12"]));
  assert.match(apart, /100s over 12 of 12 step\(s\) on 2026-01-03, 1\.25x the 80s before it/u,
    `two whole-gate figures with a scoped run between them were not subtracted:\n${apart}`);

  const scoped = runSays(planted([FULL, "2026-01-03T00:00:00.000Z 9s 3/12"]));
  assert.match(scoped, /^9s over 3 of 12 step\(s\) on 2026-01-03, which is scoped and measures less/u, scoped);
  assert.match(scoped, /the whole gate last took 80s over 12 of 12 step\(s\) on 2026-01-01, the only whole-gate figure recorded/u,
    `a scoped run that names no comparable figure leaves the reader to assume one:\n${scoped}`);

  const first = runSays(planted(["2026-01-04T00:00:00.000Z 9s 3/12"]));
  assert.match(first, /no run recorded spent the whole table; npm run check -- --full plants a figure/u, first);

  // A table that gained a step is another gate, and subtracting across the two reports the addition as drift, which is what a review would act on.
  const grown = runSays(planted([FULL, "2026-01-07T00:00:00.000Z 100s 13/13"]));
  assert.match(grown, /100s over 13 of 13 step\(s\) on 2026-01-07, and the one before it was 80s over 12 of 12 step\(s\)/u, grown);
  assert.match(grown, /a table of another size, so nothing is subtracted/u, grown);
  assert.doesNotMatch(grown, /x the 80s/u, `a 12-step gate was subtracted from a 13-step one:\n${grown}`);

  const sameSize = runSays(planted([FULL, "2026-01-08T00:00:00.000Z 40s 13/13", "2026-01-09T00:00:00.000Z 50s 13/13"]));
  assert.match(sameSize, /50s over 13 of 13 step\(s\) on 2026-01-09, 1\.25x the 40s before it/u,
    `two figures over the same table were not subtracted:\n${sameSize}`);

  // A gate under a second is the scratch case, and a ratio over it is a division by zero.
  assert.match(runSays(planted(["2026-01-05T00:00:00.000Z 0s 12/12", "2026-01-06T00:00:00.000Z 3s 12/12"])),
    /3s more than the one before it, which took under a second, so there is no ratio/u);
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
