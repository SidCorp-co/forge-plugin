/* `feedback.project` is the project's say over its own backlog, the way `feedback.plugin` is over
   this plugin's: accepted, defaulted and printed, so something reads it. `off` closes `forge new`,
   `bugs` lets it file a bug alone, and `all` or no key at all files as before. Spawned from rooms
   that are not this plugin's checkout, each carrying its own record of the key. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const TITLE = "the report says which round filed nothing";

/* The rooms' slug is a project the tracker lists, so a filing that is let through has somewhere to go. */
const state = {
  issues: [], comments: {}, calls: [], status: 0,
  answer: {
    "forge_projects.list": () => ({
      projects: [{ id: "1e1c1a1e-0000-4000-8000-0000000000ff", slug: "somewhere-else" }],
    }),
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* The configuration home the child reads: the tracker fixture's, where each room's record lives. */
const HOME = tracker.env.XDG_CONFIG_HOME;
const ENV = { ...tracker.env, HOME };

const roomOn = (project) => projectRoom(tempRoom(`project-channel-${project ?? "unset"}-`), HOME,
  { slug: "somewhere-else", ...(project ? { feedback: { project } } : {}) });

const closed = roomOn("off");
const bugsOnly = roomOn("bugs");
const everything = roomOn("all");
const unset = roomOn(null);

const BUG = [
  "## What happened", "", "`forge resume --report` printed nothing for a round that met no defect.", "",
  "## Why it happens", "", "The report reads the routed records and nothing beside them.", "",
  "## Outcome", "", "The report says a round that met nothing met nothing.", "",
  "## Rules", "", "The line is rendered off the records.", "",
  "## Out of scope", "", "What a run does with the line.",
].join("\n");

const ENHANCEMENT = [
  "## What happens today", "", "`forge resume --report` prints every payload and no filing line.", "",
  "## Outcome", "", "The report tells a round that filed nothing from one whose project withheld it.", "",
  "## Rules", "", "The line is rendered off the project's key.", "",
  "## Out of scope", "", "What the run does with the finding once the report carries it.",
].join("\n");

const file = async (room, category, body) => {
  const path = join(room, `body-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${body}\n`);
  state.calls = [];
  const run = await ranAsync(FORGE, ["new", path, "--title", TITLE, "--category", category], ENV, room);
  const creates = state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "create");
  return { ...run, creates };
};

test("under feedback.project off, `forge new` is refused in one line naming the key and sends nothing", async () => {
  const run = await file(closed, "bug", BUG);
  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.stderr.trim().split("\n").length, 1, run.stderr);
  assert.match(run.stderr, /feedback\.project to off in \S*project-channel-off-\S*config\.json/u, "the key and its file");
  assert.match(run.stderr, /a run fixes a finding in the issue it is working and declares it there/u,
    "the route a run's finding takes instead");
  assert.match(run.stderr, /a person files one on the tracker's own screen/u, "and where a person files one");
  assert.deepEqual(run.creates, [], "no create reached the tracker");
});

test("under feedback.project off, `forge -h` lists no `new` row, and under all it does", async () => {
  const off = await ranAsync(FORGE, ["-h"], ENV, closed);
  assert.equal(off.status, 0, off.stderr);
  assert.doesNotMatch(off.stdout, /^ {2}new /mu, off.stdout);
  const on = await ranAsync(FORGE, ["-h"], ENV, everything);
  assert.match(on.stdout, /^ {2}new /mu, "the row a project allowing its own channel keeps");
});

test("under feedback.project bugs, an enhancement is refused by the key and a bug files", async () => {
  const refused = await file(bugsOnly, "enhancement", ENHANCEMENT);
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /files bug alone on its own backlog, and --category enhancement names another: feedback\.project says which/u,
    refused.stderr);
  assert.deepEqual(refused.creates, [], "and nothing was sent");
  const filed = await file(bugsOnly, "bug", BUG);
  assert.equal(filed.status, 0, filed.stderr);
  assert.equal(filed.creates.length, 1, "the bug reached the tracker");
  assert.equal(filed.creates[0].args.data.category, "bug");
});

for (const [said, room] of [["all", everything], ["unset", unset]]) {
  test(`under feedback.project ${said}, an enhancement files as it always did`, async () => {
    const run = await file(room, "enhancement", ENHANCEMENT);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.creates.length, 1, run.stdout);
    assert.equal(run.creates[0].args.data.category, "enhancement");
  });
}
