/* The project's key decides whether this CLI names a destination for a defect in the plugin. A key
   that closed the channel takes the verb's row, the footer and the routing block with it: a sentence
   left behind is satisfied with the nearest verb that works, which is the client's own backlog. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

/* Never this checkout: where a note lands is the whole point, and a case run from here passes
   either way. */
const roomOn = (plugin, slug = "somewhere-else") => {
  const room = tempRoom(`channel-${plugin}-`);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug, feedback: { plugin } }));
  return room;
};

const closed = roomOn("off");
const open = roomOn("bugs");

const state = { issues: [], comments: {}, calls: [] };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ask = (argv, room) => ranAsync(FORGE, argv, tracker.env, room);

test("under feedback.plugin off the verb is nowhere in `forge -h`, and under bugs it is a row", async () => {
  const off = await ask(["-h"], closed);
  assert.equal(off.status, 0, off.stderr);
  assert.doesNotMatch(off.stdout, /feedback/iu, off.stdout);
  const on = await ask(["-h"], open);
  assert.equal(on.status, 0, on.stderr);
  assert.match(on.stdout, /^ {2}feedback /mu, "the row a project allowing the channel keeps");
  assert.match(on.stdout, /forge feedback <note\.md>/u, "and the footer that says where a defect goes");
});

test("a channel the project closed refuses the verb in one line naming the key", async () => {
  const body = join(closed, "note.md");
  writeFileSync(body, "## What happened\n\nA verb refused a body it should have taken.\n");
  const typed = await ask(["feedback", body, "--title", "a note nobody asked for"], closed);
  assert.equal(typed.status, 1, typed.stdout);
  assert.equal(typed.stderr.trim().split("\n").length, 1, typed.stderr);
  assert.match(typed.stderr, /feedback\.plugin/u, "naming the key that closed it");
  const helped = await ask(["feedback", "-h"], closed);
  assert.equal(helped.status, 1, helped.stdout);
  assert.equal(helped.stderr.trim(), typed.stderr.trim(), "and -h on it describes nothing either");
  assert.equal(helped.stdout, "", "a withheld verb's help is not a surface");
});

/* The two withholdings are two answers to two questions, and only `forge doctor` attributes: a
   machine that hid the verb has told the project nothing, so the block claims nothing of it. */
test("a machine that withheld the verb leaves the routing naming no verb and no project", async () => {
  const path = join(tracker.env.XDG_CONFIG_HOME, "forge", "config.json");
  const held = readFileSync(path, "utf8");
  writeFileSync(path, JSON.stringify({ ...JSON.parse(held), withheld: ["feedback"] }));
  try {
    const run = await ask(["new", "-h"], open);
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /forge feedback/u, "no verb, this machine having withheld it");
    assert.doesNotMatch(run.stdout, /this project files none/u, "and nothing said of the project");
    assert.match(run.stdout, /goes in the run's report/u, "the route a finding takes either way");
  } finally {
    writeFileSync(path, held);
  }
});

test("`forge new -h` names the verb for a plugin defect only where the key allows the channel", async () => {
  const on = await ask(["new", "-h"], open);
  assert.equal(on.status, 0, on.stderr);
  assert.match(on.stdout, /`forge feedback <note\.md> --title/u, on.stdout);
  const off = await ask(["new", "-h"], closed);
  assert.equal(off.status, 0, off.stderr);
  assert.doesNotMatch(off.stdout, /forge feedback/u, off.stdout);
  assert.match(off.stdout, /goes in the run's report/u, "and says where one goes instead");
});
