/* A fold reading a run's report cannot tell a round that met no plugin defect from one whose project
   would not have carried the finding anyway, and the second is not a clean run. So the report says
   which, off the project's key rather than off the run's memory of what it was allowed to do. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("channel-report-");
const { pluginFilingLine } = await import("../../src/tracker/filing/plugin-defect.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const HELD = "44444444-4444-4444-8444-444444444444";

const roomOn = (plugin) => {
  const room = tempRoom(`report-${plugin}-`);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "somewhere-else", feedback: { plugin } }));
  return room;
};

const closed = roomOn("off");
const open = roomOn("bugs");

/* The one project the fixture lists is the room's: the line is the key's answer, not the slug's. */
const state = {
  issues: [{ documentId: HELD, issueId: "ISS-9", title: "one issue to report on", status: "in_progress" }],
  comments: { [HELD]: [] },
  calls: [],
  answer: {
    "forge_projects.list": () =>
      ({ projects: [{ id: "1e1c1a1e-0000-4000-8000-0000000000ff", slug: "somewhere-else" }] }),
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const report = (room) => ranAsync(FORGE, ["record", "report", "ISS-9"], tracker.env, room);

test("a report on a project that closed the channel says the project withheld it", async () => {
  const run = await report(closed);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Plugin defect {2}withheld by the project \(feedback\.plugin: off/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /none filed/u, "which is the other answer and not this one");
});

test("a report on a project that allows it says a round that filed none filed none", async () => {
  const run = await report(open);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Plugin defect {2}none filed$/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /withheld/u, "a project that allowed the channel withheld nothing");
});

/* Read off the `routed` records rather than asked of the run: what a report says was filed is what
   a record on the issue says went there. */
test("a routed finding that reached this plugin's backlog is what the line carries instead", () => {
  assert.match(pluginFilingLine(["ISS-661 on forge-plugin, as a bug"]), /ISS-661 on forge-plugin/u);
  assert.match(pluginFilingLine(["ISS-4 of this project"]), /none filed/u, "a finding that went elsewhere is not one");
  assert.match(pluginFilingLine([]), /none filed/u, "and a run that routed nothing at all");
});
