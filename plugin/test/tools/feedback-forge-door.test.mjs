/* A credential that cannot see the plugin's own project still reaches somebody: the pinned core's
   own door for feedback about Forge, `POST /api/forge/feedback` (REQ-47), which files into Forge's
   home from any project. Six times in the Agenfold sessions of 2026-10-30/31 the verb was refused
   "No Forge project this credential can see has slug forge-plugin" and the run fell back to a raw
   POST. The refusal is the case that goes red. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectEntry, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const TITLE = "a refused record prints its usage instead of the flag values it takes";
const CALLER_ID = "44444444-4444-4444-8444-444444444444";

const elsewhere = tempRoom("feedback-door-");
const BODY = [
  "## What happened", "", "`forge record confirmation -h` answered with a refusal naming one flag.", "",
  "## Why it happens", "", "The help branch of `forge record` is read after the flags.", "",
  "## Outcome", "", "Asking for help on a record kind prints what to type.", "",
  "## Rules", "", "A help request is answered before any argument is read.", "",
  "## Out of scope", "", "The wording of the refusal itself.",
].join("\n");
const note = () => {
  const path = join(elsewhere, `note-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${BODY}\n`);
  return path;
};

const state = { issues: [], comments: {}, calls: [], answer: {} };
/* The credential sees one project, the caller's own, and the plugin's is not it. */
state.answer["forge_projects.list"] = () => ({ projects: [{ id: CALLER_ID, slug: "somewhere-else" }] });
state.answer.forge_feedback = (args) => ({ created: true, feedback: { key: "FB-77", title: args.data?.title } });
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
projectEntry(projectRoom(elsewhere, tracker.env.XDG_CONFIG_HOME, { slug: "somewhere-else" }), tracker.env.XDG_CONFIG_HOME);

const send = async (argv) => {
  state.calls = [];
  const run = await ranAsync(FORGE, argv, tracker.env, elsewhere);
  return { ...run, door: state.calls.find((one) => one.name === "forge_feedback") };
};

test("a credential that cannot see forge-plugin files to core's own feedback door, never refused for the slug", async () => {
  const run = await send(["feedback", note(), "--title", TITLE]);
  assert.doesNotMatch(run.stderr, /No Forge project this credential can see has slug forge-plugin/u);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(run.door, `nothing reached the door:\n${JSON.stringify(state.calls.map((one) => one.path))}`);
  assert.equal(run.door.path, "/api/forge/feedback", "the pinned core's own route");
  const sent = run.door.args.data;
  assert.equal(sent.title, TITLE);
  assert.equal(sent.kind, "bug", "a bug note is core's bug");
  assert.match(sent.whereSeen, /forge/u, "where in Forge it was met");
  assert.match(sent.body, /^## What happened/mu, "the note's body, whole");
  assert.match(sent.clientVersion, /^forge-plugin \d+\.\d+\.\d+$/u);
  assert.deepEqual(state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "create"), [],
    "and no issue was filed anywhere");
  assert.match(run.stdout, /FB-77/u, "the reply names the item core filed");
});
