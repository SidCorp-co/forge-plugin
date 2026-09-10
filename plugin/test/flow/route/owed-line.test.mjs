/* The ladder printed under a record write, and who is owed a second reading of it. AC-10-5-3: it is
   advice, so a write leaving owed exactly what the write before it left says nothing — one command
   makes four record writes and owed one reading of the ladder four times over. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("route-owed").path;
const { owedSaid } = await import("../../../src/flow/route.mjs");

const ISSUE = "the-uuid-of-an-issue";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const held = { status: "in_progress", acceptanceCriteria: CRITERIA };
const TYPED = ["## Files touched", "a", "## Before", "a", "## After", "a", "## Deliberately unchanged",
  "a", "## Verified in code", "a", "## Conventions reversed", "a", "## Declarations",
  "Screen change: no\nSchema coupling: no", "## Steps", "1. Do it. criteria: 9"].join("\n\n");

const asked = async (session) => {
  process.env.FORGE_SESSION_ID = session;
  return owedSaid(ISSUE, held, [], "ISS-3");
};

test("the ladder is said to a session that has not read it", async () => {
  const said = await asked("owed-first");
  assert.ok(said.trim(), "a session that has read nothing is owed the whole of it");
  assert.match(said, /ISS-3/u, "and it names the issue it is about");
});

test("the same ladder after the next write is not said twice", async () => {
  const first = await asked("owed-twice");
  assert.ok(first.trim(), "the first write carries it");
  assert.equal(await asked("owed-twice"), "", "and the write after it, owing the same, says nothing");
});

test("another session is owed it whole, having read nothing", async () => {
  await asked("owed-mine");
  const theirs = await asked("owed-theirs");
  assert.ok(theirs.trim(), "one session's reading credits no other");
});

/* It is the last line said that decides, not every line ever said: a ladder that moves and comes
   back is news again, because what a session was told last is what it is acting on. */
test("a ladder that moved and came back is said again", async () => {
  process.env.FORGE_SESSION_ID = "owed-moved";
  const first = await owedSaid(ISSUE, held, [], "ISS-3");
  assert.ok(first.trim());
  const moved = await owedSaid(ISSUE, { ...held, status: "open" }, [], "ISS-3");
  assert.ok(moved.trim(), "a different ladder is a different line");
  assert.notEqual(moved, first);
  const back = await owedSaid(ISSUE, held, [], "ISS-3");
  assert.equal(back, first, "and the first one is owed again, the session having been told another since");
});

/* The line counts the items and never names them, so a reader held to it alone is told a number twice and the
   second set of names not at all. What is said and what the session is credited with are therefore one text (ISS-1103). */
test("the items are said under the line, and a set that changed under an unchanged count is said again", async () => {
  process.env.FORGE_SESSION_ID = "owed-items";
  const said = await owedSaid(ISSUE, held, [], "ISS-3");
  assert.match(said, /item\(s\) owed\.$/mu, "the line, first and alone on its own line");
  const under = said.split("\n").slice(1).filter((one) => one.trim());
  assert.ok(under.length >= 2, `the items under it, each with the command that supplies it: ${said}`);
  assert.match(under.join("\n"), /^ {4}forge /mu, "the command is indented under what it supplies");
  /* Two readings whose lines are identical: four owed with nothing written, and four owed where a typed plan's step serves a criterion the issue does not hold. Only the items part them. */
  const bare = { status: "confirmed" };
  const mismatched = { status: "confirmed", acceptanceCriteria: "1. One outcome.", plan: TYPED };
  process.env.FORGE_SESSION_ID = "owed-same-count";
  const first = await owedSaid(ISSUE, bare, [], "ISS-3");
  const second = await owedSaid(ISSUE, mismatched, [], "ISS-3");
  assert.equal(second.split("\n")[0], first.split("\n")[0], "the line is the same, so the count is");
  assert.notEqual(second, first, "and the items are not, so the second is a reading nobody has read");
  assert.ok(second.trim(), "which is why it is said rather than credited to the first");
});
