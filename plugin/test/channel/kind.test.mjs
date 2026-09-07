/* What a note may be about is the caller's project's decision, not this verb's constant: `bugs` is
   the one kind the channel carried before the key existed, and `all` reads a body against whichever
   shape it names. Spawned from a checkout that is not this plugin's, as every feedback case is. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const TITLE = "a note about a kind this project allows";

const roomOn = (plugin) => {
  const room = tempRoom(`feedback-kind-${plugin}-`);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "somewhere-else", feedback: { plugin } }));
  return room;
};

const bugsOnly = roomOn("bugs");
const everything = roomOn("all");

const ENHANCEMENT = [
  "## What happens today",
  "",
  "`forge record report` prints every payload and says nothing about the plugin channel.",
  "",
  "## Outcome",
  "",
  "The report tells a round that filed nothing from one whose project withheld the channel.",
  "",
  "## Rules",
  "",
  "The line is rendered off the project's key and never typed by the run that writes the report.",
  "",
  "## Out of scope",
  "",
  "What the run does with the finding once the report carries it.",
].join("\n");

const note = (room, body) => {
  const path = join(room, `note-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(path, `${body}\n`);
  return path;
};

const state = { issues: [], comments: {}, calls: [], status: 0 };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const send = async (room, argv) => {
  state.calls = [];
  const run = await ranAsync(FORGE, argv, tracker.env, room);
  return { ...run, filed: state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "create")[0] };
};

test("under bugs, a kind the project did not allow is refused by name", async () => {
  const run = await send(bugsOnly,
    ["feedback", note(bugsOnly, ENHANCEMENT), "--title", TITLE, "--kind", "enhancement"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /enhancement/u, "the kind that was asked for");
  assert.match(run.stderr, /feedback\.plugin/u, "and the key that allows only the one");
  assert.equal(run.filed, undefined, "nothing was filed");
  /* A withheld route may not be replaced by another: this refusal once sent a plugin enhancement to
     the client's own backlog, where `forge new` would have filed it and nobody who owns the code
     reads it. What is withheld goes in the report, which is the whole of the rule (ISS-108). */
  assert.match(run.stderr, /report/u, "the withheld finding is routed to the run's report");
  assert.doesNotMatch(run.stderr, /forge new/u, "and to no verb that would file it somewhere else");
  assert.doesNotMatch(run.stderr, /this project's own backlog/u, "least of all the wrong backlog");
});

test("under all, an enhancement missing a section its own shape needs is refused by that section", async () => {
  const short = ENHANCEMENT.split("\n## Outcome")[1];
  const run = await send(everything,
    ["feedback", note(everything, `## Outcome${short}`), "--title", TITLE, "--kind", "enhancement"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /What happens today/u, run.stderr);
  assert.equal(run.filed, undefined, "nothing was filed");
});

test("under all, an enhancement carrying every section its shape needs is filed as one", async () => {
  const run = await send(everything,
    ["feedback", note(everything, ENHANCEMENT), "--title", TITLE, "--kind", "enhancement"]);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.filed, "nothing was filed");
  assert.equal(run.filed.args.data.category, "enhancement");
  assert.equal(run.filed.slug, "forge-plugin", "on the plugin's own project, as a bug note is");
  assert.match(run.stdout, /^The note is a new enhancement on forge-plugin\.$/mu, run.stdout);
});
