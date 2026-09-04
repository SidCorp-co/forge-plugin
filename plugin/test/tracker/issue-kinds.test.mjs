/* The kinds this CLI defines above the tracker's schema, held to three things: one statement behind
   both the lint and the help, a set nothing steps outside of, and a vocabulary that stays the
   CLI's. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_KIND,
  KINDS,
  KINDS_HELP,
  KIND_NAMES,
  SIZES,
  SIZE_WORDS,
  inFlowWords,
  insteadOf,
  kindRefusal,
  noticeFor,
  shapeFor,
  shapeOf,
  trackerFields,
} from "../../src/tracker/issue-shape.mjs";

const TITLE = "the filing is read against the shape its kind names";
const SECTIONS = {
  happened: "## What happened\n\nThe verb answered success and stored nothing at all.",
  today: "## What happens today\n\nEvery filing is read against the one same shape.",
  outcome: "## Outcome\n\nA filing is read against the shape its kind names.",
  rules: "## Rules\n\n- The refusal names the section and the kind it is required for.",
  scope: "## Out of scope\n\nJudging whether the issue is true.",
  where: "## Where\n\nThe filing verb and the gate on the tracker's own tool.",
  why: "## Why\n\nA reader of any issue finds the same parts in the same places.",
};
const body = (...names) => names.map((one) => SECTIONS[one]).join("\n\n");
const gapsOf = (text, kind) => shapeOf({ title: TITLE, body: text, kind });
const said = (text, kind) => gapsOf(text, kind).gaps.map((one) => `${one.read} ${one.wants} ${one.clear}`).join(" | ");

test("the set is what the backlog's body shapes measured, and every name is one word", () => {
  assert.deepEqual(KIND_NAMES, ["bug", "enhancement", "feature"]);
  assert.ok(KIND_NAMES.includes(DEFAULT_KIND), "the kind a filing naming none is read as is one of them");
  for (const name of KIND_NAMES) assert.match(name, /^[a-z]+$/u, name);
  assert.equal(KIND_NAMES.includes("chore"), false);
});

/* Criterion 10: two lists of sections would drift, and the one that drifts is the help, because
   nothing fails when it does. */
test("the sections the help lists for a kind are the sections the lint asks that kind for", () => {
  for (const one of KINDS) {
    const row = KINDS_HELP.split("\n").findIndex((line) => line.trim().startsWith(one.kind));
    assert.ok(row > 0, `${one.kind} is on no row of the help`);
    const [required, nice] = KINDS_HELP.split("\n").slice(row + 1, row + 3);
    for (const section of one.needs) assert.ok(required.includes(section.title), `${section.title} for ${one.kind}`);
    for (const section of one.says) assert.ok(nice.includes(section.title), `${section.title} for ${one.kind}`);
    const refused = said("nothing here names a section, and this line is only prose about it", one.kind);
    for (const section of one.needs) assert.ok(refused.includes(section.add), `${section.add} in the refusal`);
    for (const section of one.says) {
      assert.equal(refused.includes(section.add), false, `${section.add} is nice to have and refuses nothing`);
    }
  }
});

test("the kind decides which section opens the body, and the refusal names the kind", () => {
  assert.deepEqual(gapsOf(body("happened", "outcome", "rules", "scope", "where"), "bug").gaps, []);
  assert.match(said(body("outcome", "rules", "scope"), "bug"), /what happened/u);
  assert.match(said(body("outcome", "rules", "scope"), "bug"), /required of a bug/u);
  assert.match(said(body("outcome", "rules", "scope"), "bug"), /add `## What happened`/u);
  assert.deepEqual(gapsOf(body("today", "outcome", "rules", "scope", "why"), "enhancement").gaps, []);
  assert.match(said(body("outcome", "rules", "scope"), "enhancement"), /what happens today/u);
  assert.match(said(body("outcome", "rules", "scope"), "enhancement"), /required of an enhancement/u);
  assert.deepEqual(gapsOf(body("outcome", "rules", "scope", "why"), "feature").gaps, [],
    "and the shape every filing was held to before kinds existed is the feature's");
  assert.match(said(body("happened", "rules", "scope"), "bug"), /naming the outcome/u,
    "the three every kind carries are still required of each of them");
});

test("a heading is matched by family, so the backlog's own wordings are the same section", () => {
  const today = body("outcome", "rules", "scope").replace("## Outcome",
    "## What it is now\n\nOne shape is read of every filing.\n\n## Outcome");
  assert.deepEqual(gapsOf(today, "enhancement").gaps, []);
  const broke = body("outcome", "rules", "scope").replace("## Outcome",
    "## What went wrong\n\nThe verb answered success and stored nothing.\n\n## Outcome");
  assert.deepEqual(gapsOf(broke, "bug").gaps, []);
});

/* Criterion 1 on the route the flag cannot reach: the tracker takes any string of a hundred
   characters, so a kind nobody has decided the sections of arrives through its own tool. */
test("a kind this CLI does not define is refused with the set and the route past it", () => {
  const refused = gapsOf(body("outcome", "rules", "scope"), "chore");
  assert.equal(refused.gaps.length, 1, "and no section is judged, there being no shape to judge it by");
  assert.match(refused.gaps[0].read, /a kind of `chore`/u);
  for (const name of KIND_NAMES) assert.ok(refused.gaps[0].wants.includes(name), name);
  assert.match(refused.gaps[0].clear, /set the kind to one of bug, enhancement, feature/u);
  for (const name of KIND_NAMES) assert.ok(kindRefusal("chore").includes(name), name);
  assert.match(kindRefusal("chore"), /files an issue against this plugin/u);
  /* Presence, never truth: a payload carries the field as it likes, and `""` is a value nobody
     defined rather than a filing that named nothing. */
  for (const given of ["", false, 0]) {
    const read = gapsOf(body("outcome", "rules", "scope"), given);
    assert.equal(read.gaps.length, 1, JSON.stringify(given));
    assert.match(read.gaps[0].read, /which this CLI does not define/u);
  }
});

test("a nice-to-have section left out is said in one line, and refuses nothing", () => {
  const whole = body("happened", "outcome", "rules", "scope");
  const read = gapsOf(whole, "bug");
  assert.deepEqual(read.gaps, [], "it is filed");
  assert.match(read.said, /^Read as a bug\./u);
  assert.match(read.said, /leaves out Where/u);
  assert.equal(read.said.split("\n").length, 1, "one line");
  assert.equal(gapsOf(body("happened", "outcome", "rules", "scope", "where"), "bug").said, null,
    "and a kind that left nothing out is told nothing");
});

test("a filing naming no kind is read as the default and told so", () => {
  const read = gapsOf(body("outcome", "rules", "scope", "why"), null);
  assert.deepEqual(read.gaps, []);
  assert.equal(read.said, `Read as a ${DEFAULT_KIND}, the kind a filing naming none is read as.`);
  assert.equal(noticeFor({ kind: DEFAULT_KIND, named: true, left: [] }), null);
  assert.equal(shapeFor(null).kind, DEFAULT_KIND);
});

/* Criterion 11: the mark says the flow is not worth spending on this, and a section list is the
   flow's cost in another form. */
test("a body marked `Size: fix.` is read against no section, whatever kind it names", () => {
  const marked = "`forge dep` should take the `data.relations` route.\n\nSize: fix.";
  for (const kind of [...KIND_NAMES, null]) {
    const read = gapsOf(marked, kind);
    assert.deepEqual(read.gaps, [], String(kind));
    assert.equal(read.said, null, "and nothing is said about a reading that did not happen");
  }
  assert.match(KINDS_HELP, /no section and against no kind, so nothing is read\nof it and nothing is said/u,
    "which is what the help says, so the two cannot drift into promising a line the mark suppresses");
  /* The mark exempts the sections and not the set, and the tracker's own tool is the route that
     can carry both at once. */
  const outside = gapsOf(marked, "chore");
  assert.equal(outside.gaps.length, 1);
  assert.match(outside.gaps[0].read, /a kind of `chore`/u);
});

/* A second heading of the same family leaves the first one answering, so the refusal that asks for
   one is a refusal a developer cannot act on. */
test("a heading already there is told to grow a line, not to be added a second time", () => {
  const thin = body("outcome", "rules", "scope").replace("A filing is read against the shape its kind names.", "TBD");
  const clears = gapsOf(thin, "feature").gaps.map((one) => one.clear).join(" | ");
  assert.match(clears, /write one line of 4 words or more under the outcome heading already there/u);
  assert.doesNotMatch(clears, /add `## Outcome`/u);
  const hollow = body("outcome", "rules", "scope").replace("Judging whether the issue is true.", "## Evidence\n\nnone");
  assert.match(gapsOf(hollow, "feature").gaps.map((one) => one.clear).join(" | "),
    /write one line under the out-of-scope heading already there/u);
});

/* The flags are the way in, and `forge new` spreads the ones it does not read straight into the
   payload: under the tracker's own name a value would reach the field with nothing read against it. */
test("a flag naming the tracker's field is refused with the word this CLI reads", () => {
  for (const [given, word] of [["category", "--kind"], ["complexity", "--size"]]) {
    const said = insteadOf({ [given]: "x" });
    assert.match(said, new RegExp(`--${given} is the tracker's own name`, "u"));
    assert.ok(said.includes(word), `${word} is the way out named`);
  }
  assert.equal(insteadOf({ priority: "high", status: "open" }), null, "and the fields it does pass through");
  assert.equal(insteadOf({}), null);
});

test("the writer sends the kind the filing named, and nothing where it named none", () => {
  assert.deepEqual(trackerFields({ kind: "bug" }), { category: "bug" });
  assert.deepEqual(trackerFields({}), {}, "a default written into the field would read later as a choice");
  assert.deepEqual(trackerFields({ kind: null }), {});
});

/* Criteria 13 and 14: the flow's word is `fix` and the tracker's value is its own, and the two meet
   here once. The mark itself is a line in the description, so this is read and never written. */
test("the flow's size word and the tracker's value for it are one statement", () => {
  assert.deepEqual(SIZE_WORDS, ["fix"]);
  assert.deepEqual(Object.values(SIZES), SIZE_WORDS, "the allowed set is the statement's own values");
  assert.deepEqual(inFlowWords({ complexity: "xs" }), { size: "fix" });
  assert.deepEqual(inFlowWords({ complexity: "l" }), { size: "l" },
    "a value the flow has no word for is handed back as the tracker gave it");
});

test("the payload a call hands back is in the CLI's words, and the rest of it is untouched", () => {
  assert.deepEqual(inFlowWords({ issueId: "ISS-98", category: "bug", complexity: "xs", status: "open" }),
    { issueId: "ISS-98", kind: "bug", size: "fix", status: "open" });
  assert.deepEqual(inFlowWords(null), null);
  assert.deepEqual(inFlowWords([{ category: "bug" }]), [{ category: "bug" }], "a list is not an issue");
});

/* A name a reader has to translate back costs a round, and this is the surface where both of the
   tracker's names would otherwise appear. `plugin/test/tracker/tracker-names.test.mjs` holds the
   rule over the whole source; this holds it over the text these two fields are printed by. */
test("nothing the kinds surface prints names the tracker's field for either of them", () => {
  const printed = [
    KINDS_HELP,
    kindRefusal("chore"),
    noticeFor({ kind: "bug", named: false, left: KINDS[0].says }),
    ...KINDS.flatMap((one) => [...one.needs, ...one.says]).flatMap((one) => [one.reads, one.bare, one.wants, one.add]),
    said(body("outcome"), "bug"),
  ];
  for (const text of printed) assert.doesNotMatch(text, /category|complexity/iu, text);
  assert.deepEqual(Object.keys(inFlowWords({ category: "bug", complexity: "xs" })), ["kind", "size"],
    "while the mapping to those two names is what the reader above goes through");
});
