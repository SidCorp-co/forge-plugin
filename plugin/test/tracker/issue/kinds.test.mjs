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
  inFlowWords,
  keysOffered,
  insteadOf,
  kindRefusal,
  noticeFor,
  shapeFor,
  shapeOf,
  trackerFields,
} from "../../../src/tracker/issue-shape.mjs";
import { bodyOf } from "../../../src/tracker/filing/route.mjs";

const TITLE = "the filing is read against the shape its kind names";
const SECTIONS = {
  happened: "## What happened\n\nThe verb answered success and stored nothing at all.",
  cause: "## Why it happens\n\n`plugin/src/tracker/rpc.mjs` reads the status and never the body.",
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
  assert.deepEqual(KIND_NAMES, ["bug", "enhancement", "feature", "review"]);
  assert.ok(KIND_NAMES.includes(DEFAULT_KIND), "the kind a raw create naming none is read as is one of them");
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
  assert.deepEqual(gapsOf(body("happened", "cause", "outcome", "rules", "scope", "where"), "bug").gaps, []);
  assert.match(said(body("outcome", "rules", "scope"), "bug"), /what happened/u);
  assert.match(said(body("outcome", "rules", "scope"), "bug"), /required of a bug/u);
  assert.match(said(body("outcome", "rules", "scope"), "bug"), /add `## What happened`/u);
  /* A cause nobody could find is an answer and says what was looked at, so a heading with nothing
     substantial under it does not clear the section any more than an absent one. */
  const missing = said(body("happened", "outcome", "rules", "scope"), "bug");
  assert.match(missing, /no heading naming why it happens/u);
  assert.match(missing, /add `## Why it happens` and re-send the same command/u);
  assert.match(said(body("happened", "cause", "outcome", "rules", "scope"), "enhancement"),
    /what happens today/u);
  assert.equal(said(body("today", "outcome", "rules", "scope", "why"), "enhancement").includes("Why it happens"),
    false, "and of no other kind: an enhancement is refused nothing for naming no cause");
  const thin = said(`${body("happened", "outcome", "rules", "scope")}\n\n## Why it happens\n\nnot found`, "bug");
  assert.match(thin, /a cause heading with nothing under it of 4 words or more/u);
  assert.match(thin, /write one line of 4 words or more under the cause heading already there/u);
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
  const broke = body("cause", "outcome", "rules", "scope").replace("## Outcome",
    "## What went wrong\n\nThe verb answered success and stored nothing.\n\n## Outcome");
  assert.deepEqual(gapsOf(broke, "bug").gaps, []);
  /* And the cause's own family, the four wordings a backlog writes it under. */
  for (const heading of ["Why it happens", "Why this happens", "Root cause", "Where it comes from"]) {
    const named = body("happened", "outcome", "rules", "scope")
      .replace("## Outcome", `## ${heading}\n\n\`plugin/src/tracker/rpc.mjs\` reads only the status.\n\n## Outcome`);
    assert.deepEqual(gapsOf(named, "bug").gaps, [], heading);
  }
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
  const whole = body("happened", "cause", "outcome", "rules", "scope");
  const read = gapsOf(whole, "bug");
  assert.deepEqual(read.gaps, [], "it is filed");
  assert.match(read.said, /^Read as a bug\./u);
  assert.match(read.said, /leaves out Where/u);
  assert.equal(read.said.split("\n").length, 1, "one line");
  assert.equal(gapsOf(body("happened", "cause", "outcome", "rules", "scope", "where"), "bug").said, null,
    "and a kind that left nothing out is told nothing");
});

/* Every case here named a consonant kind, so a green suite shipped `Read as a enhancement`
   (ISS-115). ARTICLE is restated rather than imported: a case asking the module for the answer it
   checks passes whatever the module says. */
const ARTICLE = (word) => (/^[aeiou]/iu.test(word) ? "an" : "a");

test("every printer of a kind's name takes the article off the name, vowel or not", () => {
  const vowel = gapsOf(body("today", "outcome", "rules", "scope"), "enhancement");
  assert.deepEqual(vowel.gaps, [], JSON.stringify(vowel.gaps));
  assert.match(vowel.said, /^Read as an enhancement\./u);
  assert.match(vowel.said, /nice to have on an enhancement and refused on nothing\./u);
  const consonant = gapsOf(body("happened", "outcome", "rules", "scope"), "bug");
  assert.match(consonant.said, /^Read as a bug\./u);
  assert.match(consonant.said, /nice to have on a bug and refused on nothing\./u);
  assert.match(said(body("outcome", "rules", "scope"), "enhancement"), /required of an enhancement/u,
    "which is what the refusal path said all along, off the same reader");
  for (const one of KIND_NAMES) {
    const printed = noticeFor({ kind: one, named: true, left: shapeFor(one).says });
    assert.ok(printed.startsWith(`Read as ${ARTICLE(one)} ${one}.`), printed);
    assert.ok(printed.includes(`nice to have on ${ARTICLE(one)} ${one} and`), printed);
  }
});

/* The fourth is nobody's to type: a reading filed as a feature reads as work somebody owes. */
test("a reading is a kind of its own, sharing the feature's sections and not its name", () => {
  const reading = KINDS.find((one) => one.kind === "review");
  const feature = KINDS.find((one) => one.kind === "feature");
  assert.deepEqual(reading.needs.map((one) => one.title), feature.needs.map((one) => one.title));
  assert.deepEqual(reading.says.map((one) => one.title), feature.says.map((one) => one.title));
  assert.deepEqual(gapsOf(body("outcome", "rules", "scope", "why"), "review").gaps, []);
  const missing = gapsOf(body("outcome", "rules", "why"), "review");
  assert.equal(missing.gaps.length, 1, JSON.stringify(missing.gaps));
  assert.match(missing.gaps[0].wants, /out-of-scope heading.*required of a review/u);
  assert.deepEqual(trackerFields({ kind: "review" }), { category: "review" },
    "the value is what a reader filters a reading off, so it has to reach the field");
});

/* A raw create carries no flag to require, so the shared reader still reads a body as a feature. */
test("a filing naming no kind is read as the default and told so", () => {
  const read = gapsOf(body("outcome", "rules", "scope", "why"), null);
  assert.deepEqual(read.gaps, []);
  assert.equal(read.said,
    `Read as ${ARTICLE(DEFAULT_KIND)} ${DEFAULT_KIND}, the kind a filing naming none is read as.`);
  assert.match(KINDS_HELP, new RegExp(`is read as ${ARTICLE(DEFAULT_KIND)}\\n${DEFAULT_KIND}\\.`, "u"),
    "and the help says the same of the same value, so the next default reintroduces nothing");
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
  assert.match(KINDS_HELP, /no section and against no kind, so\nnothing is read of it and nothing is said/u,
    "which is what the help says, so the two cannot drift into promising a line the mark suppresses");
  assert.match(KINDS_HELP, /the mark is not an exemption from the flag/u,
    "the sections are what the mark drops, and the set is not among them");
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

/* Offered, never written: no verb here retracts an edge, and nothing lexical tells a key cited as
   a reason from one naming related work. */
test("the keys a body names come back with the read, and the line offers them with the flag", () => {
  const cited = `${body("outcome", "rules", "scope")}\n\nIt is why ISS-45 was filed, and iss-46 says so.`;
  assert.deepEqual(gapsOf(cited, "feature").keys, ["ISS-45", "ISS-46"], "one entry per key, upper-cased");
  assert.match(keysOffered(["ISS-45", "ISS-46"]), /^This body names ISS-45, ISS-46\. `--with ISS-45,ISS-46`/u);
  assert.match(keysOffered(["ISS-45"]), /a key being as often a sentence's reason/u);
  assert.equal(keysOffered(["ISS-45"], ["iss-45"]), null, "a key already related is not offered again");
  assert.equal(keysOffered([]), null);
  assert.deepEqual(gapsOf(body("outcome", "rules", "scope"), "feature").keys, []);
});

test("the writer sends the kind the filing named, and nothing where it named none", () => {
  assert.deepEqual(trackerFields({ kind: "bug" }), { category: "bug" });
  assert.deepEqual(trackerFields({}), {}, "a default written into the field would read later as a choice");
  assert.deepEqual(trackerFields({ kind: null }), {});
  /* Criteria 15, 16 and 17: the rung the body claims reaches the tracker as its own value. */
  assert.deepEqual(trackerFields({ kind: null, rung: "trivial" }), { complexity: "xs" });
  assert.deepEqual(trackerFields({ kind: null, rung: "fix" }), { complexity: "s" });
  assert.deepEqual(trackerFields({ kind: "bug", rung: "feature" }), { category: "bug", complexity: "m" });
  /* And the rung handed to it is the completed body's reading, never the flag the caller passed: an example nothing closes runs to the end of the text and swallows the mark `withMark` appended (ISS-399, F1). */
  assert.equal(bodyOf({ title: TITLE, body: "prose\n\n```text\nunclosed", size: "fix" }).rung, null,
    "a filing whose appended mark landed inside an example claims no size at all");
});

/* Criteria 1 to 5: every one of the tracker's five values reads back as the rung it claims, and the
   table it reads through is the ladder's, which is where the flow reads the same values. */
test("the flow's size word and the tracker's value for it are one statement", () => {
  assert.deepEqual(inFlowWords({ complexity: "xs" }), { size: "trivial" });
  assert.deepEqual(inFlowWords({ complexity: "s" }), { size: "fix" });
  for (const held of ["m", "l", "xl"]) assert.deepEqual(inFlowWords({ complexity: held }), { size: "feature" });
  assert.deepEqual(inFlowWords({ complexity: "xxl" }), { size: "xxl" },
    "a value the ladder has no rung for is handed back as the tracker gave it");
});

test("the payload a call hands back is in the CLI's words, and the rest of it is untouched", () => {
  assert.deepEqual(inFlowWords({ issueId: "ISS-98", category: "bug", complexity: "xs", status: "open" }),
    { issueId: "ISS-98", kind: "bug", size: "trivial", status: "open" });
  assert.deepEqual(inFlowWords(null), null);
  assert.deepEqual(inFlowWords([{ category: "bug" }]), [{ category: "bug" }], "a list is not an issue");
});

/* A name a reader has to translate back costs a round, and this is the surface where both of the
   tracker's names would otherwise appear. `plugin/test/checks/tracker-names.test.mjs` holds the
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
