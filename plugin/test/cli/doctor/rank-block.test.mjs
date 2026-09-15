/* The ceiling decides whether an issue nobody has worked keeps rising or settles below the fold
   forever, and a reader of a project's own file finds nothing where it set nothing. Spawned rather
   than called, because the row is what a developer reads (ISS-1397). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const tracker = await fakeTracker({ issues: [], comments: {}, calls: [], answer: {}, memory: {} });
test.after(() => tracker.close());

const ROW = (mark, detail) => new RegExp(`^\\[${mark}\\] age ceiling\\s+${detail}`, "mu");

const ranked = (rank) => {
  const room = tempHome("project-rank");
  writeFileSync(join(room.path, ".forge.json"), JSON.stringify({ slug: "forge-plugin", ...(rank ? { rank } : {}) }));
  return ranAsync(FORGE, ["doctor"], tracker.env, room.path);
};

test("the report names the age ceiling in force and which of the two decided it", async () => {
  const shipped = await ranked(null);
  assert.match(shipped.stdout,
    ROW(" {2}ok {2}", "none, so age accrues for as long as an issue is open {2}← the plugin's default"),
    shipped.stdout);
  const capped = await ranked({ ageCap: 25 });
  assert.match(capped.stdout, ROW(" {2}ok {2}", "25 points, past which two filing dates rank alike {2}← \\.forge\\.json"));
  const elsewhere = await ranked({ blocks: 9 });
  assert.match(elsewhere.stdout, ROW(" {2}ok {2}", "none, .*← the plugin's default"),
    "a project that set another weight is not told its file decided this one");
});

test("a refused rank block is a fault on that row rather than a ceiling nobody set", async () => {
  const run = await ranked({ ageCap: "none" });
  assert.match(run.stdout,
    ROW(" miss ", "`rank\\.ageCap` is a number of points or `null` for no ceiling"), run.stdout);
  assert.match(run.stdout, /refuses to rank at all/u, "and what it costs, which is the whole verb");
});
