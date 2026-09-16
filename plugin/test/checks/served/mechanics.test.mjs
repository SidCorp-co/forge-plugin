/* The rule is only proven by watching it fire on one class and stay silent on the other, and the
   two classes are a sentence apart: "Capture it — `forge claim <ref> --pushed` — before the status
   moves" is correct and "`forge record plan` … each refuse a file no consult has read" is the claim
   ISS-1311 disproved once already. So every source below is spelt out here rather than read off the
   tree, and the corpus sweep is a second assertion on top of them (ISS-1569). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { mechanicsIn } from "../../../src/checks/served/mechanics.mjs";

const GUIDES = new URL("../../../guides/", import.meta.url).pathname;

const walk = (dir, at) => readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
  (one.isDirectory() ? walk(join(dir, one.name), `${at}${one.name}/`)
    : (one.name.endsWith(".md") ? [{ rel: `${at}${one.name}`, path: join(dir, one.name) }] : [])));

const served = () => walk(GUIDES, "");

/* One per route a reference takes into subject position. A rule reaching one of them reads exactly
   like clean text to whoever writes the next sentence by another. */
const REFUSED = {
  "a command opening the sentence": "`forge record plan` refuses an unread file.",
  "a command behind an introductory adverbial": "Normally, `forge record plan` refuses an unread file.",
  "a command set off by an em-dash": "`forge record plan` — refuses an unread file.",
  "a command after a coordinator": "Every typed record carries this number, and `forge doctor` reads the contract for it.",
  "a noun standing for a call already named": "Criteria are numbered, and the write refuses the compounds it can prove.",
  "a command bound by a relative pronoun": "Answer it with `forge codex consult --recheck`, which verifies that consult's findings.",
  "two commands under one predicate": "`forge record plan` and `forge record criteria` each refuse a file no consult has read.",
  "a plural subject standing for two calls": "both calls refuse unread files.",
  "the same plural subject set off by an em-dash": "both calls — refuse unread files.",
  "the same plural subject opening its own sentence": "Both calls refuse unread files.",
  "a coordinated subject set off by an em-dash":
    "Criteria are numbered, and the write — refuses the compounds it can prove.",
  "a subject written in bold": "**`forge record plan`** refuses unread files.",
  "a predicate in its bare form under a singular subject": "The call blocks unread files.",
  "the same predicate under a plural subject": "Both calls block unread files.",
};

for (const [route, source] of Object.entries(REFUSED)) {
  test(`${route} is refused, once`, () => {
    const said = mechanicsIn(source, "guide.md");
    assert.equal(said.length, 1, `${said.length} finding(s) for ${route}: ${said.join(" ")}`);
    assert.match(said[0], /^guide\.md:\d+ describes what a verb does rather than pointing at it: "/u, said[0]);
    assert.match(said[0], /Delete that clause; what remains is /u, "a refusal has to say what is left");
  });
}

/* The class the rule may not catch. A checker rejecting these forces a correct directive to be
   split or obscured to evade it, which is worse than the decay it was written for. */
const ACCEPTED = {
  "a capture directive naming the verb as its instrument":
    "Capture it — `forge claim <ref> --pushed` — before the status moves and again at each push.",
  "the same directive with commas for its em-dashes":
    "Capture it, `forge claim <ref> --pushed`, before the status moves and again at each push.",
  "a pointer at a help text": "`forge record park -h` lists the kinds.",
  "a pointer at a help text through a possessive": "`forge doctor` first, whose own `-h` says what it reports and from where.",
  "a pointer whose predicate defers": "`forge resume <ref>` says which phases the record earned and which one is owed.",
  "a pointer at a guide": "`forge guide contract approved` prints what the status reads.",
  "an imperative carrying the verb mid-sentence":
    "Take the reading that is cheaper to reverse, write it up in the shape `forge record decision -h` takes, and carry on.",
  "a sequencing directive naming a status that moves": "Push the branch before the status moves, and capture it again.",
  "a directive whose instrument is followed by a second obligation":
    "Capture it, `forge claim <ref> --pushed`, then write the handoff.",
  "the same directive with an em-dash aside around the instrument":
    "Capture it — `forge claim <ref> --pushed` — then write the handoff.",
  "a command ending one clause and an imperative opening the next":
    "Run this before pushing: `forge record plan`; write the handoff afterwards.",
};

for (const [route, source] of Object.entries(ACCEPTED)) {
  test(`${route} passes`, () => {
    assert.deepEqual(mechanicsIn(source, "guide.md"), [], route);
  });
}

test("punctuation alone does not change a verdict", () => {
  const dashed = "Capture it — `forge claim <ref> --pushed` — before the status moves.";
  const comma = "Capture it, `forge claim <ref> --pushed`, before the status moves.";
  assert.deepEqual(mechanicsIn(dashed, "guide.md"), mechanicsIn(comma, "guide.md"));
  assert.equal(mechanicsIn("`forge record plan` — refuses an unread file.", "guide.md").length,
    mechanicsIn("`forge record plan` refuses an unread file.", "guide.md").length,
    "a mechanics description cannot be escaped by writing an em-dash into it");
});

/* The sentence ISS-1311 disproved, restored with a caveat, in the form the guide carries it: a real
   obligation, a mechanics description and a pointer in one breath. Only the middle one goes. */
test("the Phase 3 sentence ISS-1311 disproved is refused, and the pointer beside it is not", () => {
  const source = "**Both are read before the issue takes them**: `forge record plan` and `forge record criteria` each\n"
    + "refuse a file no consult has read, and one consult over both clears both writes with no flag to\n"
    + "remember, unless this machine's own configuration names a send mode — `forge codex consult -h` says\n"
    + "how the issue and the two bodies reach the reviewer.";
  const said = mechanicsIn(source, "07-phase-3.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /"`forge record plan` and `forge record criteria` each refuse a file no consult has read"/u);
  assert.match(said[0], /`forge codex consult -h` says how the issue and the two bodies reach the reviewer\."/u,
    "the pointer sharing the sentence is part of what remains, not part of the cut");
});

/* The unit is the clause and not the sentence, because deleting the sentence would take the
   obligation with the description. Both strings are asserted whole: a refusal that named the
   sentence would pass a weaker assertion and destroy the directive at the site. */
test("the recheck sentence is cut at its relative clause and keeps its obligation", () => {
  const source = "**A fix made to close a finding is answered by a recheck**, `forge codex consult --recheck`, which\n"
    + "verifies that consult's findings rather than roaming for new ones; what a recheck may not do is that\n"
    + "verb's own help.";
  const said = mechanicsIn(source, "08-phase-4.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which verifies that consult\'s findings rather than roaming for new ones"'),
    `the cut is not the relative clause: ${said[0]}`);
  assert.ok(said[0].includes('what remains is "A fix made to close a finding is answered by a recheck, '
    + '`forge codex consult --recheck`; what a recheck may not do is that verb\'s own help."'),
    `what remains is not the obligation and the pointer: ${said[0]}`);
});

/* An aside is joined to the predicate after it so an em-dash cannot be written into a description to
   escape the rule, and that join must not swallow the relative clause the rule reads instead. */
test("a description inside an aside is refused, and the obligation the aside sits in is not", () => {
  const said = mechanicsIn("`forge record plan`, which refuses unread files, is the next call.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which refuses unread files"'), `the cut is not the relative clause: ${said[0]}`);
  assert.ok(said[0].includes('what remains is "`forge record plan` is the next call."'), said[0]);
});

test("a cut at a relative clause stops at that clause and leaves the obligation after it standing", () => {
  const said = mechanicsIn("Run `forge codex consult --recheck`, which verifies findings, before pushing.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which verifies findings"'), `the cut ran past the clause: ${said[0]}`);
  assert.ok(said[0].includes('what remains is "Run `forge codex consult --recheck` before pushing."'),
    `a run taking this cut would lose the timing obligation: ${said[0]}`);
});

/* A comma inside the clause's own object is not where the clause ends, and a cut taken there would
   leave half a list standing in the sentence the obligation is made of. */
test("a cut at a relative clause carrying a list keeps the list with the cut", () => {
  const said = mechanicsIn("Run `forge record plan`, which reads plans, criteria and decisions, before pushing.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which reads plans, criteria and decisions"'), `the cut stopped inside the list: ${said[0]}`);
  assert.ok(said[0].includes('what remains is "Run `forge record plan` before pushing."'), said[0]);
});

test("a relative clause the main clause does not resume after is cut whole", () => {
  const said = mechanicsIn("It is answered by `forge record plan`, which reads plans, criteria and decisions.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which reads plans, criteria and decisions"'), said[0]);
  assert.ok(said[0].includes('what remains is "It is answered by `forge record plan`."'), said[0]);
});

/* Two adjuncts after the clause: the cut has to stop at the first place the main clause takes over,
   because stopping at the last one leaves the reader deleting an obligation that was never the
   clause's. The line is the refused span's own and not the sentence's, or a cut lands on the wrong one. */
test("a cut stops where the main clause first resumes, however many adjuncts follow", () => {
  const said = mechanicsIn("Run `forge record plan`, which reads plans, before pushing, after review.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which reads plans"'), `the cut ran past the resumption: ${said[0]}`);
  assert.ok(said[0].includes('what remains is "Run `forge record plan` before pushing, after review."'), said[0]);
});

test("a refusal names the line the refused span starts on", () => {
  const said = mechanicsIn("Run `forge record plan` — \nwhich refuses unread files — before pushing.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /^guide\.md:2 /u, `the line is the sentence's rather than the span's: ${said[0]}`);
  assert.ok(said[0].includes('"which refuses unread files"'), said[0]);
});

/* A description and a directive coordinated in one sentence, each way round. Whichever side the
   description is on, the cut is its side and the directive is what remains. */
test("a directive coordinated after a description is not part of the cut", () => {
  const said = mechanicsIn("`forge record plan` refuses unread files, then run the consult before pushing.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"`forge record plan` refuses unread files"'), said[0]);
  assert.ok(said[0].includes('what remains is "run the consult before pushing."'),
    `a run taking this cut would lose the directive: ${said[0]}`);
});

test("a main clause resuming under a modal is where a cut at a relative clause stops", () => {
  const said = mechanicsIn("`forge record plan`, which refuses unread files, must be run before pushing.", "guide.md");
  assert.equal(said.length, 1, said.join("\n"));
  assert.ok(said[0].includes('"which refuses unread files"'), said[0]);
  assert.ok(said[0].includes('what remains is "`forge record plan` must be run before pushing."'), said[0]);
});

test("the walk reaches the served text, so a clean answer is a clean corpus and not an empty selector", () => {
  const found = served();
  assert.ok(found.length > 100, `${found.length} file(s) walked; the selector matches too little`);
  for (const rel of [
    "contract/default/01-the-issue-flow-contract.md",
    "skills/issue-flow/default/guide/07-phase-3.md",
    "skills/dispatch/default/guide/03-phase-1.md",
  ]) {
    assert.ok(found.some((one) => one.rel === rel), `${rel} is not reached`);
  }
});

/* What ISS-1568 empties, one entry per refusal and each carrying its own span, so a second
   assertion written into a listed sentence fails here rather than hiding behind its line number.
   An entry goes when its clause does; nothing here is a marker a site can be exempted with. */
const OWED = [
  ["contract/default/01-the-issue-flow-contract.md:3", "`forge doctor` reads the contract for it"],
  ["contract/screen/01-the-issue-flow-contract.md:3", "`forge doctor` reads the contract for it"],
  ["skills/dispatch/default/guide/08-phase-6.md:26", "The landing takes each issue as far as its record earns and the project's release allows"],
  ["skills/dispatch/screen/guide/08-phase-6.md:26", "The landing takes each issue as far as its record earns and the project's release allows"],
  ["skills/forge/default/references/configuration.md:25", "the verb then leaves the usage list"],
  ["skills/forge/default/references/dependencies.md:5", "`forge issue ISS-nn --blocks ISS-mm` writes an edge there, `--relates ISS-mm` writes one that orders nothing"],
  ["skills/forge/default/references/dependencies.md:7", "`forge issue ISS-mm --fields relations` reads them back, under `blockedBy` for the edges holding that issue up, `blocks` for the ones it holds up"],
  ["skills/forge/screen/references/configuration.md:25", "the verb then leaves the usage list"],
  ["skills/forge/screen/references/dependencies.md:5", "`forge issue ISS-nn --blocks ISS-mm` writes an edge there, `--relates ISS-mm` writes one that orders nothing"],
  ["skills/forge/screen/references/dependencies.md:7", "`forge issue ISS-mm --fields relations` reads them back, under `blockedBy` for the edges holding that issue up, `blocks` for the ones it holds up"],
  ["skills/issue-flow/default/guide/07-phase-3.md:13", "Both writes take a path and nothing but a path"],
  ["skills/issue-flow/default/guide/07-phase-3.md:20", "the write refuses the compounds it can prove"],
  ["skills/issue-flow/default/guide/07-phase-3.md:28", "`forge record plan` and `forge record criteria` each refuse a file no consult has read"],
  ["skills/issue-flow/default/guide/07-phase-3.md:37", "`forge record plan` and `forge record criteria` each refuse a file no consult has read"],
  ["skills/issue-flow/default/guide/08-phase-4.md:57", "which verifies that consult's findings rather than roaming for new ones"],
  ["skills/issue-flow/screen/guide/07-phase-3.md:13", "Both writes take a path and nothing but a path"],
  ["skills/issue-flow/screen/guide/07-phase-3.md:20", "the write refuses the compounds it can prove"],
  ["skills/issue-flow/screen/guide/07-phase-3.md:28", "`forge record plan` and `forge record criteria` each refuse a file no consult has read"],
  ["skills/issue-flow/screen/guide/07-phase-3.md:37", "`forge record plan` and `forge record criteria` each refuse a file no consult has read"],
  ["skills/issue-flow/screen/guide/08-phase-4.md:57", "which verifies that consult's findings rather than roaming for new ones"],
].map(([at, cut]) => `${at} ${cut}`);

test("the served text describes a verb's behaviour at these sites and no others", () => {
  const found = served().flatMap((one) => mechanicsIn(readFileSync(one.path, "utf8"), one.rel));
  const shape = /^(?<at>\S+) describes what a verb does rather than pointing at it: "(?<cut>.*?)"\. The verb's/su;
  const seen = found.map((one) => {
    const read = shape.exec(one);
    assert.ok(read, `a refusal the case cannot read: ${one}`);
    return `${read.groups.at} ${read.groups.cut}`;
  });
  assert.deepEqual(seen, OWED,
    "a site added here is a mechanics description the served text gained; one missing is a cut ISS-1568 made and did not take out of this list");
});
