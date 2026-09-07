/* The backstop under the routing block: a run holding a rule with no verb satisfies it with the
   nearest verb that works, and `forge new` on the client's own backlog is where the plugin's defect
   lands as one of their issues. So the write holds a body whose cause is inside this plugin — and
   never on this plugin's own checkout, where a plugin defect and a project issue are one thing. */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const TITLE = "the learning gate takes a record that names its cause";

const roomOn = (slug) => {
  const room = tempRoom(`hold-${slug}-`);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug, feedback: { plugin: "off" } }));
  return room;
};

const elsewhere = roomOn("somewhere-else");
const here = roomOn("forge-plugin");

const BODY = [
  "## What happened",
  "",
  "The learning gate refused a record that named its cause at the line the symptom came from.",
  "",
  "## Why it happens",
  "",
  "`plugin/hooks/gates/learning.mjs` reads the cause before the record's own heading is matched.",
  "",
  "## Outcome",
  "",
  "A record naming its cause at a line is taken the first time it is written.",
  "",
  "## Rules",
  "",
  "The gate reads the heading first and the body after it.",
  "",
  "## Out of scope",
  "",
  "What the gate does with a record that names no cause at all.",
].join("\n");

const body = (room) => {
  const path = join(room, "finding.md");
  writeFileSync(path, `${BODY}\n`);
  return path;
};

const state = { issues: [], comments: {}, calls: [], status: 0 };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const file = async (room) => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["new", body(room), "--title", TITLE, "--category", "bug"],
    tracker.env, room);
  return { ...run, filed: state.calls.filter((one) => one.name === "forge_issues" && one.args.action === "create")[0] };
};

test("a body whose cause is inside this plugin is held on a project that closed the channel", async () => {
  const run = await file(elsewhere);
  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.filed, undefined, "and nothing reached the caller's backlog");
  assert.match(run.stderr, /plugin\/hooks\/gates\/learning\.mjs/u, "naming what it read the cause as");
  assert.match(run.stderr, /run's report/u, "with the route the finding takes instead");
  assert.match(run.stderr, /withheld by the project/u, "in the words the report's own line carries");
});

/* The directory list was typed, so it stopped matching `plugin/agents/` the day that directory was
   added and said nothing: a body whose cause is a role's own text read as another project's issue
   and was filed there. Read off this copy now, and every directory it ships is watched matching, so
   the next one added is covered without anybody remembering to (ISS-673). */
test("every directory this copy ships is a path the hold reads as inside the plugin", async () => {
  const dirs = readdirSync(new URL("../../", import.meta.url), { withFileTypes: true })
    .filter((one) => one.isDirectory() && !one.name.startsWith("."))
    .map((one) => one.name);
  assert.ok(dirs.includes("agents"), "the directory whose absence from the typed list was the defect");
  assert.ok(dirs.length > 5, `${dirs.length} directory(ies) under plugin/; the selector reads the wrong tree`);
  for (const dir of dirs) {
    const named = BODY.replace("plugin/hooks/gates/learning.mjs", `plugin/${dir}/whatever.md`);
    const path = join(elsewhere, `cause-${dir}.md`);
    writeFileSync(path, `${named}\n`);
    state.calls = [];
    const run = await ranAsync(FORGE, ["new", path, "--title", TITLE, "--category", "bug"],
      tracker.env, elsewhere);
    assert.equal(run.status, 1, `plugin/${dir}/ read as another project's issue:\n${run.stdout}`);
    assert.match(run.stderr, /cause is inside this plugin/u, `plugin/${dir}/: ${run.stderr}`);
  }
});

test("the same body under the same key is filed on this plugin's own checkout", async () => {
  const run = await file(here);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.filed, "nothing was filed");
  assert.equal(run.filed.args.data.category, "bug");
  assert.doesNotMatch(run.stdout, /withheld by the project/u, "there being no second backlog to hold it for");
});
