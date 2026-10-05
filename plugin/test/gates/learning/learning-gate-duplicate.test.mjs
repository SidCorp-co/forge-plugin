/* The learning gate's duplicate refusal, and what a session is spared when it meets it again. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { homeEnv } from "../../fixtures.mjs";
import { dupRoom, dupWrite } from "../../fixtures/skill-duplicate.mjs";

const HOME = homeEnv("learning-gate-duplicate");

/* AC-10-5-2, the learning gate's half. The write is still refused — the duplicate must not land —
   and what the session is spared is a paragraph it has already read. */
test("a duplicate this session already read in full is refused again in one line", () => {
  const fixture = dupRoom();
  const session = randomUUID();
  const first = dupWrite(session, fixture, { home: HOME });
  assert.match(first, /repeats what the skill already says/u, "the first refusal is the whole of it");
  const again = dupWrite(session, fixture, { home: HOME, name: "shape-two.md" });
  assert.equal(again.split("\n").length, 1, "the second is one line");
  assert.match(again, /^Refused again/u, "which still reads as a refusal");
  assert.match(again, /forge hooks --how learning-gate/u, "and names where the reason and escape are");
  assert.match(dupWrite(randomUUID(), fixture, { home: HOME, name: "shape-three.md" }),
    /repeats what the skill already says/u, "while another session is owed the whole of it");
});

/* AC-10-5-5, through the hook: a credit under the wave's id was read as every agent's (ISS-1028). */
test("a duplicate one agent was shown whole is shown whole to its sibling, and repeats with its shape", () => {
  const fixture = dupRoom();
  const session = randomUUID();
  const as = (agent, name) => dupWrite(session, fixture, { home: HOME, name, agent });
  assert.match(as("first", "a.md"), /repeats what the skill already says/u);
  const sibling = as("second", "b.md");
  assert.match(sibling, /repeats what the skill already says/u, "the sibling never saw it");
  assert.doesNotMatch(sibling, /^Refused again/u);
  const again = as("first", "c.md");
  assert.match(again, /^Refused again — `c\.md` repeats what the skill already says/u, again);
  assert.ok(again.includes("(cause: learning-gate/skill-restated)"), again);
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
