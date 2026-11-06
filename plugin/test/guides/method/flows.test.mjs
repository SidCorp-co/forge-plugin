/* What each shipped flow serves, read through the verb rather than off the directory: a project
   pinning `screen` and one pinning nothing are two different readers of the same commands, and the
   difference between them is the whole of what the flow axis buys. Every assertion here is watched
   failing by removing the sentence it names from the flow's own part (ISS-1088). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, projectRoom, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("screen-flow").path;
const { DEFAULT, SCREEN } = await import("../../../src/guides/flow.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");

/* One configuration home for every reading, holding one record per flow: the project's keys live
   beside the machine's now, so a room and the home its record sits in travel together and neither
   is this developer's. One room per flow rather than one per call, two readings of a flow being
   two readings of the same project. */
const HOME = tempRoom("screen-flow-home-");
const rooms = new Map();
const roomFor = (flow) => {
  if (!rooms.has(flow)) {
    rooms.set(flow, projectRoom(tempRoom("screen-flow-"), HOME,
      { slug: "screen-fixture", ...(flow ? { flow } : {}) }));
  }
  return rooms.get(flow);
};

/* One flow per process, the resolver answering once, so every reading spawns the verb. */
const ran = (flow, argv) => {
  const run = spawnSync(FORGE, argv,
    { encoding: "utf8", env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME }, cwd: roomFor(flow) });
  assert.equal(run.status, 0, `\`forge ${argv.join(" ")}\` under ${flow ?? "no key"} exited ${run.status}: ${run.stderr}`);
  return run.stdout;
};

const served = (flow, ...argv) => flat(ran(flow, argv));

/* The same call with its line breaks kept, which is the only way a heading can be told from the
   paragraph under it once `flat` has run. */
const headings = (flow, ...argv) =>
  ran(flow, argv).split("\n").filter((one) => one.startsWith("#"));

const verification = (flow) => served(flow, "guide", "issue-flow", "verification");

test("the rendered state is the screen flow's page, and default holds only what its refusal needs", () => {
  const held = verification(DEFAULT);
  assert.doesNotMatch(held, /## Screenshots/u,
    "criterion 2: default serves a section about taking a screenshot to a project with no screen");
  assert.doesNotMatch(held, /suspect the environment before/u,
    "criterion 2: default serves the browser-shaped environment section");
  /* And the row it was kept for: a plan on this flow may not declare a screen change at all, so the
     refusal that row is the route out of is one no project here can meet (ISS-1694). */
  assert.doesNotMatch(held, /refuses a verdict under a declared screen change/u,
    "default serves the rendered-state row to a project whose plans cannot declare a screen change");
  assert.doesNotMatch(held, /flow: screen/u,
    "criterion 8: default names another flow, and a flow's text is read by a project that runs it alone");
  const screen = verification(SCREEN);
  assert.match(screen, /## Screenshots/u, "criterion 2: the screen flow serves no screenshot section");
  assert.match(screen, /the rendered state, driven/u, "criterion 2: the screen flow serves no rendered-state row");
});

/* Which reader a paragraph is addressed to is the one thing no fence could decide, so the placement
   is the method's: the branch of Phase 5 that sorts the reader by who this project made the judge is
   what serves the judging method, and the reference a builder reads while proving carries none of it
   (ISS-1695). Every selector below is watched failing by putting the section back. */
test("the builder's proving reference carries no judging method, and keeps everything it proves with", () => {
  for (const line of headings(SCREEN, "guide", "issue-flow", "verification")) {
    assert.doesNotMatch(line, /judge/u, `criterion 1: the proving reference still heads a section at a judge: ${line}`);
  }
  const held = verification(SCREEN);
  assert.doesNotMatch(held, /mapped to a criterion/u,
    "criterion 2: the proving reference still instructs the charter, which only a run that judges writes");
  assert.doesNotMatch(held, /material harm/u,
    "criterion 3: the proving reference still carries the threshold a finding is judged against");
  assert.doesNotMatch(held, /QA report/u,
    "criterion 4: the proving reference still sends a capture to a report the builder never writes");
  assert.match(held, /suspect the environment before/u,
    "criterion 5: a hot-reload connection is a local symptom, and the section that names it went with the judging method");
  assert.match(held, /development overlays and error badges land in the image/u,
    "criterion 6: the builder is a capturer, and the craft of capturing went with the judging method");
  assert.match(held, /Two verdict shapes get past `in_progress:release`/u,
    "criterion 7: the shapes the entry check lets past went, and the flow with no judge still carries them");
  const none = verification(DEFAULT);
  assert.doesNotMatch(none, /mapped to a criterion/u, "and the flow with no judge serves no charter");
  assert.doesNotMatch(none, /material harm/u, "and no blocking line, which is what these selectors are watched on");
});

/* The run at the replayed head is the change's own evidence; "run it once" naming no subject read as the
   whole suite, and gate-review's "full run" as one this session starts (ISS-3190). */
test("under either flow the evidence at the replayed head is the change's own, and no reference asks for a full run", () => {
  for (const flow of [DEFAULT, SCREEN]) {
    const reference = served(flow, "guide", "issue-flow", "verification");
    assert.match(reference, /The evidence is the change's own — the suites of the files it touched and the cases each criterion\snames, never the whole gate — run once at that head/u,
      `${flow}: the evidence run at the replayed head does not say what it runs`);
    assert.doesNotMatch(reference, /Run it once, at that head/u, `${flow}: the subjectless run is still served`);
    const measuring = served(flow, "guide", "gate-review", "measuring");
    assert.doesNotMatch(measuring, /full run/u, `${flow}: the gate review still measures a full run of its own`);
    assert.match(measuring, /where it does not, the review says the\smeasurement is not on record rather than starting a gate of its own/u,
      `${flow}: a landing record without sizes leaves the review no route but a gate of its own`);
  }
});
