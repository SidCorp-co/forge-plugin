/* What a ship's last step says about the gate, run end to end in a scratch checkout: the landing's
   side of the same two lines is ../landing/release-owes.test.mjs. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REVIEW } from "../../../gates/timing.mjs";

import { BARE, git, lastStep, landIn, pushed, runIn } from "../run-fixtures.mjs";

/* The gate this release spent a step earlier wrote the newest figure, so the release is where it is
   freshest — and beside the volume count, because both are what this run left the next one to
   answer for and a second place to look is a second thing to remember to read (ISS-166). */
test("the last step prints the series' newest whole-run figure beside the volume count, and says when it has none", () => {
  const { work } = pushed("timing");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");

  const blank = lastStep(work);
  assert.match(blank.stdout, /the gate: this release's own left no record of what it took, so no figure below is this release's/u, blank.stdout);
  assert.match(blank.stdout, /appends to, whose newest line may be another run's: no run is recorded, so nothing says whether this gate has grown/u, blank.stdout);
  assert.match(blank.stdout, /until the next landing whose gate spends every step plants a figure/u, "a tree with no figure is told what plants one");

  const dir = join(work, ".git", "gate-ledger");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "runs"), "2026-01-01T00:00:00.000Z 80s 12/12\n2026-01-02T00:00:00.000Z 100s 12/12\n");
  const said = lastStep(work);
  assert.match(said.stdout, new RegExp(`may be another run's: 100s over 12 of 12 step\\(s\\) on 2026-01-02, \\d\\.\\d\\dx the ${REVIEW.seconds}s the review of `
    + `${REVIEW.on} measured under load ${REVIEW.load} on ${REVIEW.cores} core\\(s\\) \\(${REVIEW.issue}\\); 1\\.25x the 80s before it`, "u"), said.stdout);

  const lines = said.stdout.split("\n");
  const figure = lines.findIndex((one) => one.includes("another run's: 100s"));
  const volume = lines.findIndex((one) => one.includes("changed line(s) under"));
  assert.equal(volume - figure, 1, `the figure and the volume count are not one place:\n${said.stdout}`);
});

/* The series is the checkout's, one file every worktree appends to, so under a wave the line after
   this release's own is a sibling's full gate: this gate writes its own figure and then that line,
   which is 2026-09-06 as ISS-358's ship met it (ISS-594). */
const TIMING = new URL("../../../gates/timing.mjs", import.meta.url).href;
const VERDICT = new URL("../../../gates/verdict.mjs", import.meta.url).href;
const SIBLING_GATE = `import { appendFileSync, realpathSync } from "node:fs";
import { recordDir, recordRun, seriesFile } from ${JSON.stringify(TIMING)};
import { gateDecided } from ${JSON.stringify(VERDICT)};
const root = realpathSync(process.cwd());
const dir = recordDir(root);
recordRun(dir, { seconds: 12, ran: 3, total: 14 });
appendFileSync(seriesFile(dir), new Date().toISOString() + " 188s 14/14\\n");
gateDecided(root, { tree: root, pid: process.pid }, { verdict: "pass", code: 0, seconds: 12, ran: 3, total: 14 });
`;

test("the gate line is this release's own figure, and a sibling's newer line is printed as the series'", () => {
  const { at, work } = pushed("sibling");
  runIn(work, ["review", "--done"], BARE);
  const gate = join(at, "sibling-gate.mjs");
  writeFileSync(gate, SIBLING_GATE);
  const manifest = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  writeFileSync(join(work, "package.json"), JSON.stringify({ ...manifest, scripts: { check: `node ${gate}` } }, null, 2));
  git(work, "commit", "-qam", "a gate that records what a wave does");
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");

  const said = lastStep(work);
  assert.match(said.stdout, /^ {2}the gate: this release's own took 12s over 3 of 14 step\(s\), which is scoped and measures less than a whole gate$/mu,
    `the gate line is not the figure this release's gate recorded:\n${said.stdout}`);
  assert.doesNotMatch(said.stdout, /the gate: 188s/u, `a sibling's figure is credited to this release:\n${said.stdout}`);
  const lines = said.stdout.split("\n");
  const series = lines.findIndex((one) => /^ {2}the series every worktree of this checkout appends to, whose newest line may be another run's: 188s over 14 of 14 step\(s\)/u.test(one));
  assert.ok(series > 0, `the sibling's figure is not printed as the series':\n${said.stdout}`);
  assert.match(lines[series], /\dx the 188s before it/u, `the series reading lost its comparison:\n${lines[series]}`);
  const volume = lines.findIndex((one) => one.includes("changed line(s) under"));
  assert.equal(volume - series, 1, `the series line and the volume count are not one place:\n${said.stdout}`);
});
