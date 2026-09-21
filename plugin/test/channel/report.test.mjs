/* A fold reading a run's report cannot tell a round that met no plugin defect from one whose project
   would not have carried the finding anyway, and the second is not a clean run. So the report says
   which, off the project's key rather than off the run's memory of what it was allowed to do. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, projectRecord, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-project.mjs";

/* The in-process claim below reads this checkout's own project, so the configuration home this
   process runs against carries that record rather than the machine's. */
process.env.XDG_CONFIG_HOME = tempRoom("channel-report-");
projectRecord(process.cwd(), process.env.XDG_CONFIG_HOME,
  OWN);
const { onThisRepository, pluginFilingLine } = await import("../../src/tracker/filing/plugin-defect.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const HELD = "44444444-4444-4444-8444-444444444444";

/* Each room's slug is a project the fixture lists: the line is the key's answer, not the slug's. */
const state = {
  issues: [{ documentId: HELD, issueId: "ISS-9", title: "one issue to report on", status: "in_progress" }],
  comments: { [HELD]: [] },
  calls: [],
  answer: {
    "forge_projects.list": () => ({
      projects: [
        { id: "1e1c1a1e-0000-4000-8000-0000000000ff", slug: "somewhere-else" },
        { id: "1e1c1a1e-0000-4000-8000-0000000000fe", slug: "forge-plugin" },
      ],
    }),
  },
};

const routedTo = (...destinations) => destinations.map((to, at) => ({
  documentId: `c-${at}`,
  createdAt: `2026-09-17T0${at}:00:00.000Z`,
  authorId: "agent",
  body: "## Routed finding\n\n```forge-record\nwhat: a finding this run sent to the issue that owns it"
    + `\nto: ${to}\n` + "```\n\n`forge-record: routed \u00b7 contract 1`",
}));
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* One configuration home for every room the children are spawned in — the tracker fixture's, which
   is the home each room's project record is written under. */
const HOME = tracker.env.XDG_CONFIG_HOME;
const ENV = { ...tracker.env, HOME };

const roomOn = (slug, plugin) =>
  projectRoom(tempRoom(`report-${slug}-${plugin}-`), HOME, { slug, feedback: { plugin } });

const closed = roomOn("somewhere-else", "off");
const open = roomOn("somewhere-else", "bugs");
/* The one room whose slug is this plugin's: where the on-repository answer can be watched. */
const here = roomOn("forge-plugin", "off");

const report = (room) => ranAsync(FORGE, ["resume", "ISS-9", "--report"], ENV, room);

test("a report on a project that closed the channel says the project withheld it", async () => {
  state.comments[HELD] = [];
  const run = await report(closed);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Plugin defect {2}withheld by the project \(feedback\.plugin: off/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /none filed/u, "which is the other answer and not this one");
});

test("a report on a project that allows it says a round that filed none filed none", async () => {
  state.comments[HELD] = [];
  const run = await report(open);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Plugin defect {2}none filed$/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /withheld/u, "a project that allowed the channel withheld nothing");
});

/* Read off the `routed` records rather than asked of the run: what a report says was filed is what
   a record on the issue says went there. Run in the room rather than called in this process, whose
   own checkout is the plugin's: this claim is about a project that is not this one. */
test("a routed finding that reached this plugin's backlog is what the line carries instead", async () => {
  state.comments[HELD] = routedTo("ISS-661 on forge-plugin, as a bug", "ISS-4 of this project");
  const named = await report(open);
  assert.equal(named.status, 0, named.stderr);
  assert.match(named.stdout, /^Plugin defect {2}ISS-661 on forge-plugin, as a bug$/mu, named.stdout);
  assert.doesNotMatch(named.stdout, /^Plugin defect.*ISS-4 of this project/mu,
    "a finding that went elsewhere is not one");
  state.comments[HELD] = routedTo("ISS-4 of this project");
  const elsewhere = await report(open);
  assert.equal(elsewhere.status, 0, elsewhere.stderr);
  assert.match(elsewhere.stdout, /^Plugin defect {2}none filed$/mu, elsewhere.stdout);
});

/* Here the slug is never in a destination, because the routing block sends a run to file the defect
   as an issue of this project: the line read its own instruction's output as no filing at all, and
   every fold on this checkout under-reported (ISS-1700). */
test("on this plugin's own checkout the issue a defect was filed as is what the line names", async () => {
  state.comments[HELD] = routedTo("ISS-1698");
  const run = await report(here);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Plugin defect {2}ISS-1698$/mu, run.stdout);
});

test("a round on this checkout that routed nothing reads none filed, the closed channel notwithstanding", async () => {
  state.comments[HELD] = [];
  const run = await report(here);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Plugin defect {2}none filed$/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /withheld/u,
    "a channel this checkout's routing block never reads withholds nothing here");
});

/* The room above proves the branch; this proves the fact reaching it is the checkout's own. */
test("the line asks the checkout it is called in, and this one is the plugin's", () => {
  assert.equal(onThisRepository(), true, "the suite runs from this plugin's own checkout");
  assert.match(pluginFilingLine(["ISS-1698"]), /^Plugin defect {2}ISS-1698$/u);
  assert.match(pluginFilingLine([]), /none filed/u, "and a run that routed nothing at all");
});
