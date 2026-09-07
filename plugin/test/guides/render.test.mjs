/* A served part varies by project, so what varies is fenced in one copy of the text and dropped on
   the way out. Two things are watched here that a clean tree cannot show: that the removal takes the
   block and nothing beside it, and that a fence written wrong is named rather than swallowed — a
   renderer that reads a broken fence as the end of the file loses method text silently. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { homeEnv, tempRoom } from "../fixtures.mjs";

const { blocksOf, phasesOf, render } = await import("../../src/guides/render.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const BODY = new URL("../../guides/v1/skills/issue-flow/guide.md", import.meta.url).pathname;
const CONDITION = "feedback.plugin";

const PLANTED = [
  "# One",
  "",
  "A line every project reads.",
  "",
  `<!-- forge:when ${CONDITION} bugs all -->`,
  "The block, one paragraph of it.",
  "<!-- forge:end -->",
  "",
  "The line after it.",
  "",
].join("\n");

const asked = (room, ...argv) =>
  spawnSync(FORGE, argv, { encoding: "utf8", env: homeEnv("render"), cwd: room });

const room = (plugin) => {
  const dir = tempRoom("render-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "render-fixture", feedback: { plugin } }));
  return dir;
};

/* The paragraph is the unit a reader sees, so equal-elsewhere is asserted over paragraphs: a
   character diff would pass on a rendering that lost a blank line somewhere else in the part. */
const paragraphs = (text) => text.split("\n\n");

test("a marked block is kept for the values it names, dropped for the rest, and nothing beside it moves", () => {
  const kept = render(PLANTED, { [CONDITION]: "bugs" });
  const gone = render(PLANTED, { [CONDITION]: "off" });
  assert.deepEqual(kept.problems, [], "a well-formed fence is no problem");
  assert.deepEqual(gone.problems, []);
  assert.equal(kept.text.includes("The block, one paragraph of it."), true);
  assert.equal(gone.text.includes("The block"), false, "a value the fence does not name loses the block");
  assert.deepEqual(paragraphs(gone.text), paragraphs(kept.text).filter((one) => !one.startsWith("The block")),
    "the rendering for the value that loses the block is the other one with that paragraph taken out");
  assert.equal(render(PLANTED, { [CONDITION]: "all" }).text, kept.text, "either value the fence names keeps it");
  assert.deepEqual(blocksOf(PLANTED).map((one) => [one.condition, one.values.join(" ")]),
    [[CONDITION, "bugs all"]], "and the block is one block, whatever any project answers");
});

/* AC-02-8-1. The two readings of the phase come from one source, so the case reads the shipped text
   rather than a fixture: a fence that stopped matching the real body would pass on invented lines. */
test("the Phase 5 part this copy ships carries the filing block once, and loses it under a closed channel", () => {
  const body = readFileSync(BODY, "utf8");
  const phase = phasesOf(body).find((one) => one.number === "5");
  assert.ok(phase, "the method's phases are addressed by number, and 5 is one of them");
  const marked = blocksOf(phase.text).filter((one) => one.condition === CONDITION);
  assert.equal(marked.length, 1, "the filing block is fenced once in the Phase 5 source");
  assert.equal(blocksOf(body).filter((one) => one.condition === CONDITION).length, 1,
    "and once in the whole method text, so no branch of it is written twice");
  const filing = marked[0].body.join("\n");
  const kept = render(phase.text, { [CONDITION]: "bugs" });
  const gone = render(phase.text, { [CONDITION]: "off" });
  assert.deepEqual(kept.problems, []);
  assert.equal(kept.text.includes(filing), true, "a project whose key takes bug reports is shown the block");
  assert.equal(gone.text.includes(filing), false, "a project that closed the channel is not");
  assert.deepEqual(paragraphs(gone.text), paragraphs(kept.text).filter((one) => one !== filing),
    "and the two are equal everywhere else in the part");
});

/* AC-02-8-1, through the key rather than through an argument: the block travels to a project's own
   answer, which is a resolver reading `.forge.json` and not a value a case can hand the renderer. */
test("the phase the verb serves a project carries the block off the project's own key", () => {
  const filing = blocksOf(readFileSync(BODY, "utf8"))
    .find((one) => one.condition === CONDITION).body.join("\n");
  const bugs = asked(room("bugs"), "guide", "issue-flow", "5");
  const off = asked(room("off"), "guide", "issue-flow", "5");
  assert.equal(bugs.status, 0, bugs.stderr);
  assert.equal(off.status, 0, off.stderr);
  assert.equal(bugs.stdout.includes(filing), true, "`feedback.plugin: bugs` is shown the filing block");
  assert.equal(off.stdout.includes(filing), false, "`feedback.plugin: off` is not");
  assert.deepEqual(paragraphs(off.stdout.trimEnd()), paragraphs(bugs.stdout.trimEnd()).filter((one) => one !== filing),
    "and the part is otherwise the same part");
  assert.equal(bugs.stdout.includes("forge:when"), false, "a fence is never served to a reader");
});

/* A renderer that swallows a broken fence looks exactly like one with nothing to drop, so each way
   of writing it wrong is watched failing and each answer names the line to go to. */
test("a fence nothing closes, a close nothing opened, a nest, and a condition nothing resolves are each named", () => {
  const unclosed = render(PLANTED.replace("<!-- forge:end -->", "Not the closer."), { [CONDITION]: "bugs" });
  assert.match(unclosed.problems[0], /^line 5 opens a marked block nothing closes\./u);
  assert.match(unclosed.problems[0], /forge:when/u, "and the answer carries the fence's own shape");
  const orphan = render(`# One\n\n<!-- forge:end -->\n`, {});
  assert.match(orphan.problems[0], /^line 3 closes a marked block nothing opened\./u);
  const nested = render(PLANTED.replace("The block, one paragraph of it.",
    `<!-- forge:when ${CONDITION} all -->\nInside.`), { [CONDITION]: "bugs" });
  assert.match(nested.problems[0], /^line 6 opens a marked block inside the one line 5 opened\./u);
  const unknown = render(PLANTED, {});
  assert.match(unknown.problems[0], /^line 5 marks a block on `feedback\.plugin`, which nothing here resolves\./u);
  assert.equal(unknown.text.includes("The block"), true,
    "and the block stays: text dropped for a key nobody answered is method text gone with nothing to say so");
});

/* A typo in a fence matches neither strict form, and the branch that took an unmatched line as prose
   served the marker and the text it meant to condition with nothing said. `forge:` is reserved. */
test("a line reaching for a fence and missing is named, whatever it got wrong", () => {
  const OPENER = `<!-- forge:when ${CONDITION} bugs all -->`;
  const CLOSER = "<!-- forge:end -->";
  for (const [was, wrong] of [
    [OPENER, `<!-- forge:when ${CONDITION} bugs-->`],
    [OPENER, `<!-- forge:whenn ${CONDITION} bugs -->`],
    [OPENER, "<!--forge:when nothing -->"],
    [CLOSER, "<!-- forge:end-->"],
  ]) {
    const said = render(PLANTED.replace(was, wrong), { [CONDITION]: "bugs" });
    assert.match(said.problems[0] ?? "", /reaches for a fence and is neither an opener nor a closer/u,
      `\`${wrong}\` was taken for prose`);
    assert.equal(said.text.includes("forge:"), false, "and no marker is served to a reader");
  }
});

/* The number is the whole address, so a phase that grew a subsection has to answer with all of it:
   `partsOf` ends a part at the next heading of any level, which would cut one silently. */
test("a phase answers its number with every heading subordinate to it, and none of the next phase", () => {
  const text = [
    "# Method", "", "Opening.", "",
    "## Phase 4 — Before", "", "The fourth.", "",
    "## Phase 5 — Prove it", "", "The fifth.", "",
    "### Evidence", "", "What it owes.", "",
    "#### A deeper one", "", "Still the fifth.", "",
    "## Phase 6 — After", "", "The sixth.", "",
  ].join("\n");
  const five = phasesOf(text).find((one) => one.number === "5");
  assert.match(five.text, /^## Phase 5 — Prove it/u);
  assert.equal(five.text.includes("### Evidence"), true, "the subsection is inside the phase");
  assert.equal(five.text.includes("Still the fifth."), true, "however deep it goes");
  assert.equal(five.text.includes("Phase 6"), false, "and the next phase is not");
  assert.equal(five.text.includes("The fourth."), false, "nor the one before it");
  assert.deepEqual(phasesOf(text).map((one) => one.number), ["4", "5", "6"],
    "and a subordinate heading is no phase of its own");
});
