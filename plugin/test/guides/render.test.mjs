/* A served part varies by project, so what varies is fenced in one copy of the text and dropped on
   the way out. Two things are watched here that a clean tree cannot show: that the removal takes the
   block and nothing beside it, and that a fence written wrong is named rather than swallowed — a
   renderer that reads a broken fence as the end of the file loses method text silently. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { flat, homeEnv, tempRoom } from "../fixtures.mjs";

const { blocksOf, openersOf, phasesOf, render } = await import("../../src/guides/render.mjs");
const { servedBody } = await import("../../src/guides/skill-guides.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const PLUGIN = new URL("../../", import.meta.url).pathname;
const CONDITION = "feedback.plugin";

/* The domain travels with the answer, off the key's own list, so a case cannot invent a channel. */
const { FEEDBACK_CHANNELS } = await import("../../src/resolve/settings.mjs");
const answering = (value, allowed = FEEDBACK_CHANNELS) => ({ [CONDITION]: { value, allowed } });

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

/* The machine's option, where the channel above is the project's: its own config home, never the live one.
   Flat, so a phrase pattern over the answer asserts the rule and not the wrap it was written under. */
const shipping = (ship, slug = "issue-flow", part = "7") => {
  const env = homeEnv("render-ship");
  mkdirSync(join(env.XDG_CONFIG_HOME, "forge"), { recursive: true });
  writeFileSync(join(env.XDG_CONFIG_HOME, "forge", "config.json"),
    JSON.stringify({ url: "https://nowhere.invalid/mcp", token: "a-throwaway-token", ship }));
  const argv = slug === "issue-flow" ? ["guide", slug, part] : ["guide", slug];
  return flat(spawnSync(FORGE, argv, { encoding: "utf8", env, cwd: room("bugs") }).stdout);
};

/* The paragraph is the unit a reader sees, so equal-elsewhere is asserted over paragraphs: a
   character diff would pass on a rendering that lost a blank line somewhere else in the part. */
const paragraphs = (text) => text.split("\n\n");

test("a marked block is kept for the values it names, dropped for the rest, and nothing beside it moves", () => {
  const kept = render(PLANTED, answering("bugs"));
  const gone = render(PLANTED, answering("off"));
  assert.deepEqual(kept.problems, [], "a well-formed fence is no problem");
  assert.deepEqual(gone.problems, []);
  assert.equal(kept.text.includes("The block, one paragraph of it."), true);
  assert.equal(gone.text.includes("The block"), false, "a value the fence does not name loses the block");
  assert.deepEqual(paragraphs(gone.text), paragraphs(kept.text).filter((one) => !one.startsWith("The block")),
    "the rendering for the value that loses the block is the other one with that paragraph taken out");
  assert.equal(render(PLANTED, answering("all")).text, kept.text, "either value the fence names keeps it");
  assert.deepEqual(blocksOf(PLANTED).map((one) => [one.condition, one.values.join(" ")]),
    [[CONDITION, "bugs all"]], "and the block is one block, whatever any project answers");
});

/* A block joins `blocks` at its closer, so a checker refusing a condition sees nothing in the text
   that never closes one — which is text a refusal is owed for more, not less (ISS-1098). */
test("an opener nothing closes names its condition, and a quoted one names nothing", () => {
  const opener = `<!-- forge:when ${CONDITION} bugs -->`;
  assert.deepEqual(blocksOf(`# One\n\n${opener}\nThe block.\n`), [], "the finished-block reading is blind here");
  assert.deepEqual(openersOf(`# One\n\n${opener}\nThe block.\n`), [CONDITION]);
  assert.deepEqual(openersOf(`# One\n\n${opener}\nThe block.\n<!-- forge:end -->\n`), [CONDITION],
    "closed or not, the condition is named once");
  assert.deepEqual(openersOf(`# One\n\nThe fence is:\n\n    ${opener}\n`), [],
    "and a fence quoted as an example opens nothing, so a page documenting the grammar is clean");
});

/* AC-02-8-1. The readings come from one source, so the case reads the shipped text rather than a
   fixture: a fence that stopped matching the real body would pass on invented lines. Three of them
   and not two — a run learning from the refusal which shapes it sends has already spent the turn. */
test("the Phase 5 part this copy ships answers each of the channel's three values with its own text", () => {
  const body = servedBody("issue-flow", PLUGIN);
  const phase = phasesOf(body).find((one) => one.number === "5");
  assert.ok(phase, "the method's phases are addressed by number, and 5 is one of them");
  const marked = blocksOf(phase.text).filter((one) => one.condition === CONDITION);
  assert.deepEqual(marked.map((one) => one.values.join(" ")), ["bugs all", "bugs", "all"],
    "the filing both open channels share, then one block per channel for what only it sends");
  assert.equal(blocksOf(body).filter((one) => one.condition === CONDITION).length, marked.length,
    "and the branch is written in this phase alone, so no other part of the method answers the key");
  const [shared, ...only] = marked.map((one) => one.body.join("\n").trim());
  const seen = Object.fromEntries(FEEDBACK_CHANNELS.map((one) => [one, render(phase.text, answering(one))]));
  for (const [value, out] of Object.entries(seen)) assert.deepEqual(out.problems, [], value);
  assert.equal(seen.off.text.includes(shared), false, "a project that closed the channel is shown none of it");
  for (const [at, value] of ["bugs", "all"].entries()) {
    assert.equal(seen[value].text.includes(shared), true, `${value} is shown the filing itself`);
    assert.equal(seen[value].text.includes(only[at]), true, `${value} is shown what only it sends`);
    assert.equal(seen[value].text.includes(only[1 - at]), false, `${value} is not shown the other channel's`);
  }
  assert.deepEqual(paragraphs(seen.off.text),
    paragraphs(seen.bugs.text).filter((one) => one !== shared && one !== only[0]),
    "and the three are one part everywhere else");
});

/* AC-02-8-1, through the key rather than through an argument: the blocks travel to a project's own
   answer, which is a resolver reading `.forge.json` and not a value a case can hand the renderer. */
test("the phase the verb serves a project carries the branch its own key names", () => {
  const marked = blocksOf(servedBody("issue-flow", PLUGIN)).filter((one) => one.condition === CONDITION);
  const [shared, bugsOnly, allOnly] = marked.map((one) => one.body.join("\n").trim());
  const out = Object.fromEntries(
    FEEDBACK_CHANNELS.map((one) => [one, asked(room(one), "guide", "issue-flow", "5")]));
  for (const [value, one] of Object.entries(out)) assert.equal(one.status, 0, `${value}: ${one.stderr}`);
  assert.equal(out.off.stdout.includes(shared), false, "`feedback.plugin: off` is shown no filing at all");
  assert.equal(out.bugs.stdout.includes(shared), true, "`feedback.plugin: bugs` is shown the filing block");
  assert.equal(out.bugs.stdout.includes(bugsOnly), true, "and that a defect is the only shape it sends");
  assert.equal(out.bugs.stdout.includes(allOnly), false, "never the other channel's answer");
  assert.equal(out.all.stdout.includes(allOnly), true, "`feedback.plugin: all` is shown to send the shape it met");
  assert.equal(out.all.stdout.includes(bugsOnly), false, "and not the narrower channel's answer");
  assert.deepEqual(paragraphs(out.off.stdout.trimEnd()),
    paragraphs(out.bugs.stdout.trimEnd()).filter((one) => one !== shared && one !== bugsOnly),
    "and the part is otherwise the same part");
  assert.equal(out.bugs.stdout.includes("forge:when"), false, "a fence is never served to a reader");
});

/* A renderer that swallows a broken fence looks exactly like one with nothing to drop, so each way
   of writing it wrong is watched failing and each answer names the line to go to. */
test("a fence nothing closes, a close nothing opened, a nest, and a condition nothing resolves are each named", () => {
  const unclosed = render(PLANTED.replace("<!-- forge:end -->", "Not the closer."), answering("bugs"));
  assert.match(unclosed.problems[0], /^line 5 opens a marked block nothing closes\./u);
  assert.match(unclosed.problems[0], /forge:when/u, "and the answer carries the fence's own shape");
  const orphan = render(`# One\n\n<!-- forge:end -->\n`, {});
  assert.match(orphan.problems[0], /^line 3 closes a marked block nothing opened\./u);
  const nested = render(PLANTED.replace("The block, one paragraph of it.",
    `<!-- forge:when ${CONDITION} all -->\nInside.`), answering("bugs"));
  assert.match(nested.problems[0], /^line 6 opens a marked block inside the one line 5 opened\./u);
  const unknown = render(PLANTED, {});
  assert.match(unknown.problems[0], /^line 5 marks a block on `feedback\.plugin`, a condition nothing here resolves\./u);
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
    const said = render(PLANTED.replace(was, wrong), answering("bugs"));
    assert.match(said.problems[0] ?? "", /reaches for a fence and is neither an opener nor a closer/u,
      `\`${wrong}\` was taken for prose`);
    assert.equal(said.text.includes("forge:"), false, "and no marker is served to a reader");
  }
});

/* A value the key never takes matches no project, so before this the block vanished for everyone and
   nothing said why — method instructions gone on a typo, which is worse than a fence written wrong
   because the rendering looks well-formed. The domain is the key's own list, named in the answer. */
test("a fence naming a value its key does not take is refused, and never quietly loses the block", () => {
  const typo = PLANTED.replace(`forge:when ${CONDITION} bugs all`, `forge:when ${CONDITION} bug`);
  const said = render(typo, answering("bugs"));
  assert.match(said.problems[0] ?? "",
    /^line 5 marks a block on `feedback\.plugin` for bug, which that key does not take — it takes off, bugs, all\./u);
  assert.equal(said.text.includes("The block, one paragraph of it."), true,
    "and the block stays, because a refusal is what the reader gets rather than a part with a hole in it");
  const both = render(PLANTED.replace(`${CONDITION} bugs all`, `${CONDITION} bugs sometimes`), answering("bugs"));
  assert.match(both.problems[0] ?? "", /for sometimes, which that key does not take/u,
    "one stray value beside a good one is still named");
  const undeclared = render(PLANTED, { [CONDITION]: { value: "bugs" } });
  assert.match(undeclared.problems[0] ?? "", /whose values nothing here declares/u,
    "and an answer that brought no domain cannot have its values read at all");
  assert.deepEqual(render(PLANTED, answering("bugs")).problems, [], "a value the key takes is no problem");
});

/* Ordinary Markdown must not change policy. A marker quoted as an example is the subject of the
   sentence and gets served whole; a real marker one space in is still the verb and still governs. */
test("a marker inside a literal context is served, and one indented outside it still governs", () => {
  const quoting = [
    "# One", "", "The syntax is written:", "",
    "```", `<!-- forge:when ${CONDITION} bugs all -->`, "The example.", "<!-- forge:end -->", "```", "",
    "    <!-- forge:when feedback.plugin off -->", "",
    "The line after.", "",
  ].join("\n");
  const shown = render(quoting, answering("off"));
  assert.deepEqual(shown.problems, [], "an example is not a fence and raises nothing");
  assert.equal(shown.text.includes(`<!-- forge:when ${CONDITION} bugs all -->`), true,
    "a fenced example is served byte for byte, whatever the project answers");
  assert.equal(shown.text.includes("The example."), true, "including the body it is showing");
  assert.equal(shown.text.includes("    <!-- forge:when feedback.plugin off -->"), true,
    "and an indented code line is quoting too");
  const indented = [
    "# One", "", ` <!-- forge:when ${CONDITION} bugs all -->`, " The conditional instruction.",
    "  <!-- forge:end -->", "", "The line after.", "",
  ].join("\n");
  const off = render(indented, answering("off"));
  assert.deepEqual(off.problems, []);
  assert.equal(off.text.includes("The conditional instruction."), false,
    "a real marker indented under four spaces still removes its block for a project that lost the channel");
  assert.equal(off.text.includes("forge:"), false, "and its own lines are never served");
  assert.equal(render(indented, answering("bugs")).text.includes("The conditional instruction."), true,
    "while the project that has the channel still gets it");
});

/* The other condition, whose two answers are both text rather than a block and its absence: a run
   reading the wrong half is told to land a change the mode stops at a pushed branch. Off the shipped
   bodies, because a fence that stopped matching either would pass on a fixture (ISS-673). */
test("Phase 7 and the fold are served in the mode's own text, one branch of each per reader", () => {
  const modes = ["self", "ready"];
  const both = modes.map((one) => shipping(one));
  for (const [at, said] of both.entries()) {
    assert.equal(said.includes("forge:when"), false, `${modes[at]}: a fence is never served to a reader`);
    assert.match(said, /^## Phase 7 — Ship/u, `${modes[at]}: the part opens on the phase`);
  }
  const [self, ready] = both;
  assert.match(self, /The landing is this phase's first step/u, "self mode lands its own change");
  assert.doesNotMatch(self, /ends at ready-to-land/u, "and is told nothing about a landing it does not make");
  assert.match(ready, /ends at ready-to-land and lands nothing/u, "ready mode stops at the checkpoint");
  assert.match(ready, /forge claim ISS-nn --pushed --ready/u, "with the command that writes one");
  assert.doesNotMatch(ready, /The landing is this phase's first step/u,
    "and is not also told to merge, which is the contradiction the mode used to serve");
  /* The fold is the other half: under `ready` the landing is the dispatcher's step, and nothing in
     the shipped text said so, so a wave read a Phase 6 that folded reports and landed nothing. */
  const folds = modes.map((one) => shipping(one, "dispatch"));
  assert.doesNotMatch(folds[0], /ready-to-land/u, "self mode's fold lands nothing extra");
  assert.match(folds[1], /the landing is this phase's and it is one actor's/u, "ready mode's fold lands them");
  assert.match(folds[1], /never the run that built the change/u, "and dispatches the judge where one is asked for");
});

/* What a fence takes with it: the `self` branch carried the note, the release rung and the close, so fencing it left a `ready` reader two statuses short of the end state. Over the union served, either half may own it and neither may drop it (ISS-673). */
test("a ready reader is told somewhere who moves the release rung, which the mode's own half no longer does", () => {
  const phase = shipping("ready");
  const fold = shipping("ready", "dispatch");
  assert.match(`${phase} ${fold}`, /`awaiting_release`/u,
    "the rung past the judging is named to a reader whose own phase stops at a pushed branch");
  assert.match(fold, /A status the landing could not reach is this phase's/u,
    "and the fold, whose landing it follows, is where it is owned");
  assert.match(phase, /are the landing's, not this run's/u,
    "the phase says whose it is rather than leaving the run to assume it is nobody's");
  assert.doesNotMatch(phase, /Then close it, in this phase/u,
    "and does not also claim the close, which under this mode it cannot make");
  assert.match(shipping("self"), /Then close it, in this phase/u,
    "while the mode that does land its own change still closes it there");
});

/* The shape the reader above exists to remove: the pattern is the phrase a reader reads, the fixture the wrap it arrived under. */
test("a phrase of served prose is matched across whatever break the formatter chose", () => {
  const wrapped = "and the fold, whose landing it follows, is where `released` and\n`closed` are\nmoved from here.";
  const phrase = /`released` and `closed` are moved from here/u;
  assert.doesNotMatch(wrapped, phrase, "one day's wrap is what a pattern over the raw answer asserts");
  assert.match(flat(wrapped), phrase, "and the rule is what a reader reads, whatever column it broke at");
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
