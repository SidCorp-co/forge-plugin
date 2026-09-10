/* What the section reader counts as a section, which is a question of heading depth and not of the
   words in a heading. ISS-633, met twice in three days and worked around both times by rewording
   the title: the body's own `#` line was in the set the reader searched, so a title saying what the
   change was about answered for the section named after the same word, which was already full. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

const home = tempHome("issue-heading-level");
process.env.XDG_CONFIG_HOME = home.path;
const { shapeOf } = await import("../../../src/tracker/issue-shape.mjs");

const SECTIONS = {
  bug: [
    ["What happened", "The refusal named a section this body carries in full."],
    ["Why it happens", "The reader took the first heading of the family, which was the title."],
    ["Outcome", "A title is read as a title, and the section under it answers for its family."],
    ["Rules", "- A heading at the top level is a title and never one of the sections."],
    ["Out of scope", "Which sections each kind requires."],
    ["Where", "The section reader in plugin/src/tracker/issue-shape.mjs, and every verb that files."],
  ],
  enhancement: [
    ["What happens today", "The reader searches every heading level for a section of the family."],
    ["Outcome", "A title is read as a title, and the section under it answers for its family."],
    ["Rules", "- A heading at the top level is a title and never one of the sections."],
    ["Out of scope", "Which sections each kind requires."],
    ["Why", "Two filings have each spent two refusals and a read of the checker."],
  ],
};
const bodyUnder = (kind, title = null) => [
  ...(title === null ? [] : [`# ${title}`, ""]),
  ...SECTIONS[kind].flatMap(([name, text]) => [`## ${name}`, "", text, ""]),
].join("\n").trim();

const RULE_TITLE = "A rule heading is found by the level it sits at, not by the title above it";

/* One title per family a kind reads for, required or nice: a filing about a check, a rule or a
   behaviour is a large share of this backlog, and no title of one avoids every word below. */
const SHADOWS = [
  ["enhancement", "outcome", "The outcome of a filing stops turning on the words in its own title"],
  ["enhancement", "rule", RULE_TITLE],
  ["enhancement", "invariant", "The per-row-invariant reader stops taking a title for one of the sections"],
  ["enhancement", "acceptance", "Acceptance of a body stops turning on the words its title happens to use"],
  ["enhancement", "behaviour", "The behaviour of the shape reader is decided by the heading level"],
  ["enhancement", "scope", "What is out of scope for a filing is read off the body's own section"],
  ["enhancement", "today", "Filing a finding today costs two refusals and a read of the checker"],
  ["enhancement", "why", "Why a filing was refused is said with the heading the reader matched"],
  ["bug", "what happened", "What happened to a filing is said by the heading the reader read"],
  ["bug", "cause", "The cause of a refusal is named by the heading it actually matched"],
  ["bug", "where", "Where a section is read from is the body, and never the title above it"],
];

test("a body's own title is not one of its sections, whatever word that title carries", () => {
  for (const [kind, word, title] of SHADOWS) {
    const { gaps, said } = shapeOf({ title, body: bodyUnder(kind, title), kind });
    assert.deepEqual(gaps, [], `${kind}, on the word ${word}: ${JSON.stringify(gaps.map((one) => one.read))}`);
    assert.equal(said, null, `${kind}, on the word ${word}: no nice-to-have is reported missing either`);
  }
});

test("the heading list a refusal prints is the sections it read, and the title is not among them", () => {
  const body = bodyUnder("enhancement", RULE_TITLE).replace("## Rules", "## Notes");
  const [gap] = shapeOf({ title: RULE_TITLE, body, kind: "enhancement" }).gaps;
  assert.match(gap.read, /among `What happens today`, `Outcome`, `Notes`, `Out of scope`, `Why`/u);
  assert.doesNotMatch(gap.read, /the level it sits at/u, "the title was never a heading this reader could take");
  assert.equal(gap.clear, "add `## Rules` and re-send the same command");
});

test("a section that really is thin is still refused, and the refusal quotes the heading it read", () => {
  const body = bodyUnder("enhancement", RULE_TITLE)
    .replace("- A heading at the top level is a title and never one of the sections.", "TBD");
  const [gap] = shapeOf({ title: RULE_TITLE, body, kind: "enhancement" }).gaps;
  assert.equal(gap.read, "a rule heading `Rules` with nothing under it of 4 words or more");
  assert.equal(gap.clear, "write one line of 4 words or more under the heading `Rules` already there and re-send the same command");
});

/* The first-of-a-family rule is deliberate and survives the carve-out: a second heading added below
   a thin one leaves the thin one answering, which is what the quoted heading now says out loud. */
test("two headings of one family leave the first answering, and the refusal names that one", () => {
  const body = bodyUnder("enhancement", RULE_TITLE)
    .replace("- A heading at the top level is a title and never one of the sections.",
      "TBD\n\n## Acceptance\n\n- A heading at the top level is a title and never one of the sections.");
  const [gap] = shapeOf({ title: RULE_TITLE, body, kind: "enhancement" }).gaps;
  assert.match(gap.read, /a rule heading `Rules` with nothing under it/u);
  assert.match(gap.clear, /under the heading `Rules`/u);
  assert.doesNotMatch(`${gap.read} ${gap.clear}`, /Acceptance/u,
    "the full sibling below it is not the heading a filer is sent to");
});

test("a body whose headings are all of one level carries no title among them, and they are its sections", () => {
  const flat = bodyUnder("enhancement").replace(/^## /gmu, "# ");
  assert.deepEqual(shapeOf({ title: RULE_TITLE, body: flat, kind: "enhancement" }).gaps, [],
    "nothing that files today starts being refused by the carve-out");
});

/* `# Outcome` above `## Rules` is a title above its sections and a section above its siblings at
   once, and no reading of the text tells the two apart. It is decided as markdown decides it: the
   shallowest heading, first and alone at its depth, is the title. What a body sectioned at two
   depths gets is a refusal it can act on — the sections read, and the one heading to add. */
test("a body sectioned at two depths is read as titled, and the refusal it earns is one to act on", () => {
  const body = [
    "# Outcome", "", "A filing keeps every section that its kind requires.", "",
    "## Rules", "", "- Every refusal names the heading it matched.", "",
    "## Out of scope", "", "Which sections each kind requires.",
  ].join("\n");
  const [gap] = shapeOf({ title: RULE_TITLE, body, kind: "feature" }).gaps;
  assert.equal(gap.read, "no heading naming the outcome, among `Rules`, `Out of scope`");
  assert.equal(gap.clear, "add `## Outcome` and re-send the same command");
});

/* A deeper heading proves a subsection and not a title: a body sectioned at the top level keeps its
   sections however many of them are broken up underneath. This is what a level filter alone got wrong. */
test("a section broken into subsections is still a section, and the sections above it stay sections", () => {
  const nested = bodyUnder("enhancement").replace(/^## /gmu, "# ")
    .replace("A title is read as a title, and the section under it answers for its family.",
      "A title is read as a title, and the section under it answers for its family.\n\n## Details\n\nThe reader takes the first heading of the family it wants.");
  assert.deepEqual(shapeOf({ title: RULE_TITLE, body: nested, kind: "enhancement" }).gaps, [],
    "the top-level headings are the sections, and one subsection under one of them changes nothing");
});
