/* The learning gate's duplicate teaching, and what a session is spared when it meets it again. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { homeEnv } from "../../fixtures.mjs";
import { dupRoom, dupWrite } from "../../fixtures/skill-duplicate.mjs";

const HOME = homeEnv("learning-gate-duplicate");

/* AC-10-5-3, the learning gate's half: advice repeated unchanged costs nothing, and another
   session is still owed the whole of it. */
test("a duplicate this session already read in full is not taught again", () => {
  const fixture = dupRoom();
  const session = randomUUID();
  const first = dupWrite(session, fixture, { home: HOME });
  assert.match(first, /repeats what the skill already says/u, "the first teaching is the whole of it");
  assert.match(first, /forge hooks --how learning-gate/u, "and names where the reason and escape are");
  assert.equal(dupWrite(session, fixture, { home: HOME, name: "shape-two.md" }), "", "the unchanged repeat says nothing");
  assert.match(dupWrite(randomUUID(), fixture, { home: HOME, name: "shape-three.md" }),
    /repeats what the skill already says/u, "while another session is owed the whole of it");
});

/* AC-10-5-5, through the hook: a credit under the wave's id was read as every agent's (ISS-1028). */
test("a duplicate one agent was shown whole is shown whole to its sibling, and not again to itself", () => {
  const fixture = dupRoom();
  const session = randomUUID();
  const as = (agent, name) => dupWrite(session, fixture, { home: HOME, name, agent });
  assert.match(as("first", "a.md"), /repeats what the skill already says/u);
  const sibling = as("second", "b.md");
  assert.match(sibling, /repeats what the skill already says/u, "the sibling never saw it");
  assert.ok(sibling.includes("(cause: learning-gate/skill-restated)"), sibling);
  assert.equal(as("first", "c.md"), "", "the agent that read it whole is told nothing more");
});

/* AC-10-5-6, the learning gate's half. A second duplicate is a new quoted pair under the same
   instruction and route, and a delta cutting those two would hand it the pair alone. */
test("a second duplicate of another sentence carries the instruction and the route beside its new pair", () => {
  const fixture = dupRoom();
  const session = randomUUID();
  dupWrite(session, fixture, { home: HOME, name: "one.md" });
  const again = dupWrite(session, fixture, { home: HOME, name: "two.md", says: fixture.other });
  assert.match(again, /^Keep it in one place and cite it from the other\./u, `the instruction leads it: ${again}`);
  assert.ok(again.includes("payload file is written outside the checkout"), "beside the pair it is about");
  assert.ok(again.includes("How: `forge hooks --how learning-gate` (cause: learning-gate/skill-restated)"),
    "and the route to the reason, cause and all");
  assert.doesNotMatch(again, /two authorities for one rule/u, "the reason already read is the part cut");
});
