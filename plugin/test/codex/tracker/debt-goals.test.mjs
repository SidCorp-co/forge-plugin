/* The goals a debt review is ruled against are the project's brief, read off a tracker rather than a
   mock of the reader: which goals come back, with which words, and what a project with no brief gets. */
import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fakeStore, fakeTracker, projectRecord } from "../../fixtures.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const BRIEF = [
  "# a project's map",
  "",
  "## What this project is for",
  "",
  "**G-12** What this plugin does is read from the project's own configuration.  ← `CLAUDE.md`",
  "- **G-13** A defect is answered at its cause.  ← `CLAUDE.md`",
].join("\n");

const { store, knowledge } = fakeStore();
const state = { answer: { forge_knowledge: (args) => (state.down ? { refused: "Error: the store is unreachable" } : knowledge(args)) } };
const tracker = await fakeTracker(state);
after(() => tracker.close());

/* Imported with the tracker's own config in reach, so no case can read the developer's live brief. */
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
projectRecord(process.cwd(), tracker.env.XDG_CONFIG_HOME, { slug: OWN.slug });
const { goalsFor, promptFor } = await import("../../../src/codex/codex-api.mjs");

test("a consult the debt angle reviews is handed the brief's goals, each with its own words", async () => {
  store.set("project-brief", { slug: "project-brief", kind: "overview", title: "the map", body: BRIEF });
  const held = await goalsFor(["tech", "debt"]);
  assert.deepEqual(held.goals, [
    { id: "G-12", text: "What this plugin does is read from the project's own configuration." },
    { id: "G-13", text: "A defect is answered at its cause." },
  ]);
  assert.match(promptFor("intent", [], [], { goals: held }),
    /^G-12 — What this plugin does is read from the project's own configuration\.$/mu);
});

test("a project with no brief hands the debt angle the reason, and the block says to judge debt alone", async () => {
  store.delete("project-brief");
  const held = await goalsFor(["debt"]);
  assert.deepEqual(held.goals, []);
  assert.match(held.why, /has no brief stored/u);
  assert.equal(held.unread, false, "no brief stored is the project's own answer");
  assert.match(promptFor("intent", [], [], { goals: held }),
    /GOALS — this project states none: this project has no brief stored\. The Debt Reviewer judges debt alone/u);
});

test("a store that would not answer is told apart from a project stating no goals", async () => {
  state.down = true;
  try {
    const held = await goalsFor(["debt"]);
    assert.deepEqual(held.goals, []);
    assert.equal(held.unread, true);
    const said = promptFor("intent", [], [], { goals: held });
    assert.match(said, /GOALS — none could be read: the store would not answer for this project's brief\./u, said);
    assert.ok(!said.includes("states none"));
  } finally {
    state.down = false;
  }
});
