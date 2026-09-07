/* What a session is shown once and what a repeat costs it. Each rule below fails without the check
   behind it: before this store the same paragraph was delivered on every firing, and a refusal that
   repeats its whole paragraph teaches a session nothing it did not already read. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("shown-ledger");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(
  join(HOME.path, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME.path;

const { digestOf, held, lastShown, noteShown, owedOf, sayIfChanged, sayOnce, sessionKey } =
  await import("../../src/shown/ledger.mjs");
const { creditedTo } = await import("../../src/shown/journal.mjs");

const PARAGRAPH = "The first line of it.\nThe second line of it.";
const ROUTE = "bash-guard";

test("a text nobody has been shown is owed whole, and the whole of it is what prints", () => {
  const said = sayOnce("session-a", "learning-gate", PARAGRAPH, { route: ROUTE });
  assert.equal(said, PARAGRAPH, "the first firing prints the paragraph");
});

/* A refusal repeats as a line and not as nothing, because the call is still being refused and a
   session shown nothing cannot tell a block from a pass. So it still reads as a refusal. */
test("an unchanged repeat costs a refusal one line, and that line names the route to the reason", () => {
  sayOnce("session-b", "learning-gate", PARAGRAPH, { route: ROUTE });
  const again = sayOnce("session-b", "learning-gate", PARAGRAPH, { route: ROUTE });
  assert.notEqual(again, PARAGRAPH, "the paragraph is not printed twice");
  assert.equal(again, held(ROUTE));
  assert.match(again, /^Refused/u, "it still reads as a refusal and not as advice");
  assert.ok(again.includes(`forge hooks --how ${ROUTE}`), "and it names where the reason and escape are");
  assert.equal(again.split("\n").length, 1, "one line, so a repeat cannot cost a paragraph");
});

test("an unchanged repeat costs advice nothing at all", () => {
  sayOnce("session-c", "codex-turn", PARAGRAPH);
  assert.equal(sayOnce("session-c", "codex-turn", PARAGRAPH), "", "advice with no hold prints nothing");
});

test("a text that grew since it was shown owes the lines it grew by and not the rest", () => {
  sayOnce("session-d", "codex-turn", PARAGRAPH);
  const grown = `${PARAGRAPH}\nA third line, which is new.`;
  assert.equal(sayOnce("session-d", "codex-turn", grown), "A third line, which is new.");
});

/* Twice, because the delta prints one thing and credits another: the lines shown are the delta and
   the credit is the whole text, so a second growth reads its predecessor as already shown. */
test("a text that grows twice owes each growth once and never the same line again", () => {
  assert.equal(sayOnce("session-g", "codex-turn", "one"), "one");
  assert.equal(sayOnce("session-g", "codex-turn", "one\ntwo"), "two");
  assert.equal(sayOnce("session-g", "codex-turn", "one\ntwo\nthree"), "three");
  assert.equal(sayOnce("session-g", "codex-turn", "one\ntwo\nthree"), "", "and then nothing");
});

/* The read is not the delivery: a surface that asked and then failed to print must still owe it. */
test("asking what is owed credits nothing, so a text that never printed is owed again", () => {
  const first = owedOf("session-e", "codex-turn", PARAGRAPH);
  assert.equal(first.owed, true);
  assert.equal(owedOf("session-e", "codex-turn", PARAGRAPH).owed, true, "asking twice changes nothing");
  noteShown("session-e", "codex-turn", PARAGRAPH);
  assert.equal(owedOf("session-e", "codex-turn", PARAGRAPH).owed, false, "the credit is what settles it");
});

test("one surface's credit says nothing about another's", () => {
  noteShown("session-f", "learning-gate", PARAGRAPH);
  assert.equal(owedOf("session-f", "bash-guard", PARAGRAPH).owed, true);
});

/* AC-10-5-5: the dispatcher and a subagent holding its own id are two readers, and the whole point
   is that the second is shown what the first read — it never saw it. */
test("a subagent under its own id is shown a text its dispatcher was credited for", () => {
  noteShown("dispatcher-session", "codex-turn", PARAGRAPH);
  assert.equal(owedOf("dispatcher-session", "codex-turn", PARAGRAPH).owed, false);
  assert.equal(sayOnce("subagent-session", "codex-turn", PARAGRAPH), PARAGRAPH,
    "the subagent is shown the whole of it");
});

/* The second reading: only the text said last suppresses, so a surface reporting what is owed says
   a thing again once something else has been said since. The first reading cannot answer this. */
test("a text said last is not said again, and one said before that is", () => {
  assert.equal(sayIfChanged("session-h", "owed-next", "the first ladder"), "the first ladder");
  assert.equal(sayIfChanged("session-h", "owed-next", "the first ladder"), "", "said last, so not again");
  assert.equal(sayIfChanged("session-h", "owed-next", "a second ladder"), "a second ladder");
  assert.equal(sayIfChanged("session-h", "owed-next", "the first ladder"), "the first ladder",
    "another has been said since, so this one is news again");
});

test("the last item on a surface is the last thing shown on it, not its first sighting", () => {
  noteShown("session-i", "one-surface", "alpha");
  noteShown("session-i", "one-surface", "beta");
  assert.equal(lastShown("session-i", "one-surface"), digestOf("beta"));
  noteShown("session-i", "one-surface", "alpha");
  assert.equal(lastShown("session-i", "one-surface"), digestOf("alpha"),
    "credited again, so it moves to the end rather than keeping its first place");
  noteShown("session-i", "one-surface", PARAGRAPH);
  assert.equal(lastShown("session-i", "one-surface"), digestOf(PARAGRAPH),
    "and a text of several lines is named by the whole of it, never by its last line");
});

/* Through `sessionKey` and not around it: the cases here hand two literal ids, which leaves the
   resolution the ledger inherits unexercised. AC-10-5-5 holds on the condition this one names. */
test("a run handed an id of its own is credited alone, and one left on a wave's id is not", () => {
  const env = { ...process.env };
  delete process.env.FORGE_SESSION_ID;
  process.env.CLAUDE_CODE_SESSION_ID = "the-wave";
  try {
    assert.equal(sessionKey({ session_id: "child-event" }), "the-wave",
      "the id every agent under one dispatcher carries outranks the event's own");
    noteShown(sessionKey({ session_id: "dispatcher-event" }), "bash-guard", PARAGRAPH);
    assert.equal(owedOf(sessionKey({ session_id: "child-event" }), "bash-guard", PARAGRAPH).owed, false,
      "so a sibling's delivery is credited to a run that never read it");
    process.env.FORGE_SESSION_ID = "an-id-of-its-own";
    assert.equal(sessionKey({ session_id: "child-event" }), "an-id-of-its-own");
    assert.equal(owedOf(sessionKey({ session_id: "child-event" }), "bash-guard", PARAGRAPH).owed, true,
      "and a run saying which run it is reads it whole");
  } finally {
    for (const name of ["FORGE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"]) {
      if (env[name]) process.env[name] = env[name]; else delete process.env[name];
    }
  }
});

test("the subagent's credit is written under its own id and not its dispatcher's", () => {
  noteShown("boss-session", "learning-gate", PARAGRAPH);
  noteShown("worker-session", "learning-gate", "A paragraph only the worker was shown.");
  const boss = creditedTo("boss-session", "learning-gate");
  const worker = creditedTo("worker-session", "learning-gate");
  assert.ok(worker.has(digestOf("A paragraph only the worker was shown.")), "the worker holds its own");
  assert.equal(boss.has(digestOf("A paragraph only the worker was shown.")), false,
    "and the dispatcher was credited for nothing the worker read");
});
