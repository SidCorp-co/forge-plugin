/* What the fold decides before it acts, and what the reply says of each outcome: which neighbour it would join, which filings can join one at all, and the block handed back on every one of them. The act itself, spawned against a tracker, is beside.test.mjs; the reasoning docs/cli/the-fold.md's. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

const home = tempHome("fold");
process.env.XDG_CONFIG_HOME = home.path;
const { FLOOR, foldFiling, foldOnto, foldedInto, suggestionLines } =
  await import("../../../src/tracker/filing/neighbours.mjs");
const { BAND_NAMES } = await import("../../../src/ladder.mjs");
const { placeIn, seedFor } = await import("../../../src/tracker/issue-shape.mjs");

const suggestion = (issueId, score, samePlace) =>
  ({ issueId, documentId: `uuid-${issueId}`, title: `${issueId}'s title`, score, samePlace });

test("the fold takes the nearest open neighbour that also names the place, and nothing else", () => {
  const near = suggestion("ISS-2", 0.81, true);
  assert.equal(foldOnto([suggestion("ISS-1", 0.9, false), near, suggestion("ISS-3", 0.7, true)]), near,
    "the higher-scoring ISS-1 names another place, and ISS-3 is the same place further away");
  assert.equal(foldOnto([suggestion("ISS-1", 0.9, false)]), null, "a neighbour elsewhere is no fold");
  assert.equal(foldOnto([suggestion("ISS-1", null, true)]), null,
    "and one the place query alone found is a place match nothing ranked");
  assert.equal(foldOnto([]), null);
});

test("the floor is one constant, and it is the one the measurement names", () => {
  assert.equal(FLOOR, 0.7);
});

test("the block prints the key, how near it reads and whether the place matched", () => {
  const lines = suggestionLines({
    suggestions: [suggestion("ISS-2", 0.83, true), suggestion("ISS-9", null, true)],
    notes: [],
    place: "plugin/src/commands.mjs",
  }).join("\n");
  assert.match(lines, /^ {2}ISS-2 {4}0\.83 {2}same place {2}ISS-2's title$/mu);
  assert.match(lines, /^ {2}ISS-9 {4} {2}— {2} {2}same place {2}ISS-9's title$/mu,
    "a place match the semantic query never ranked shows no score rather than a made-up one");
  assert.match(lines, /a duplicate filed anyway is one the filer was shown/u);
});

test("a filing that found nothing is told so, and one whose search failed is told which", () => {
  const empty = suggestionLines({ suggestions: [], notes: [], place: "forge issue" }).join("\n");
  assert.match(empty, /Nothing open reads like this filing or names `forge issue` — the check ran and found none/u);
  const broken = suggestionLines({
    suggestions: [],
    notes: ["the semantic query could not run: Forge answered 400: no"],
    place: null,
  }).join("\n");
  assert.match(broken, /the semantic query could not run: Forge answered 400/u);
  assert.match(broken, /this filing was made as it would have been without it/u);
  assert.doesNotMatch(broken, /or names/u, "and a filing with no place is not told about one");
  /* The two are what this exists to tell apart, so they cannot both be said of one filing. */
  assert.doesNotMatch(broken, /the check ran and found none/u);
  assert.match(broken, /the check did not run whole/u);
});

test("--new tells a fold it declined from one it was never going to make, and from neither", () => {
  const nearest = suggestion("ISS-2", 0.83, true);
  const block = { suggestions: [nearest], notes: [], place: "p" };
  const said = (options) => suggestionLines(block, { fresh: true, ...options }).join("\n");
  assert.match(said({ nearest, foldable: true }),
    /--new declined the fold: ISS-2 is the nearest of the neighbours naming the place this filing's cause names/u);
  assert.match(said({ nearest, foldable: false }),
    /would have qualified, and this filing is of a kind whose body names no cause/u);
  assert.match(said({ nearest, foldable: false, routed: true }),
    /would have qualified, and this filing rides another issue's branch/u,
    "the two reasons it was never foldable are two lines: one sends the filer to a kind, one to a flag");
  assert.match(said({ nearest: null, foldable: true }),
    /--new declined nothing: no open issue both reads like this filing at 0\.78/u);
  /* Without the flag none of the four is owed: what is open is said and no more. */
  assert.doesNotMatch(suggestionLines(block, { nearest, foldable: true }).join("\n"), /--new/u);
});

/* Asked with no neighbour, so the answer is the decision and nothing is posted. */
test("a category whose body owes a cause is foldable at every size, and one that owes none never is", async () => {
  const decided = async (kind, complexity = undefined) =>
    (await foldFiling({ suggestions: [] },
      { title: "the edge a token can write", body: "a body", kind, complexity })).said.foldable;
  for (const band of [...BAND_NAMES, undefined]) {
    assert.equal(await decided("bug", band), true, `bug at ${band ?? "no complexity"}`);
    assert.equal(await decided("feature", band), false, `feature at ${band ?? "no complexity"}`);
  }
  assert.equal(await decided("review"), false, "a reading of work already landed is a finding on nothing");
  assert.equal(await decided("enhancement"), false, "and a kind that owes no cause today owes no fold");
  assert.equal(await decided(null), false, "the kind a raw create is read as owes no cause either");
  assert.equal(
    (await foldFiling({ suggestions: [] }, { title: "t", body: "a body", kind: "bug", routed: true }))
      .said.foldable,
    false,
    "while a filing riding another issue's branch has that issue's flow and folds onto nothing",
  );
});

/* Nothing spawned can see this: the refusal a held fold ends in exits the process. */
test("the neighbours are handed to the caller once, before the fold acts on them", async () => {
  const beside = { suggestions: [suggestion("ISS-2", 0.83, true)], notes: [], place: "p" };
  const seen = [];
  const onBeside = (block, said) => seen.push({ block, said });
  await foldFiling(beside, { title: "t", body: "a body", kind: "feature", onBeside });
  assert.equal(seen.length, 1, "a kind that cannot fold is still shown what it was measured against");
  assert.equal(seen[0].block, beside);
  assert.equal(seen[0].said.foldable, false);
  seen.length = 0;
  await foldFiling({ suggestions: [], notes: [], place: null },
    { title: "t", body: "a body", kind: "bug", onBeside });
  assert.equal(seen.length, 1, "and so is one with no neighbour to fold onto");
});

test("the fold's reply names the issue and why it won, and claims no nearness it does not have", () => {
  const said = foldedInto(suggestion("ISS-2", 0.83, true));
  assert.match(said, /^ISS-2 is open, names the same place and is the nearest of the neighbours that do, at 0\.83/u);
  /* A neighbour reading closer under another place is not the nearest of all, and a reply saying
     so would be false on exactly the filings the fold is least sure about. */
  assert.doesNotMatch(said, /nearest to this filing/u);
  assert.match(said, /says where its subject comes from, so it lands there as a finding under its own title/u);
  assert.match(said, /No issue was filed and no lease was taken/u);
  assert.match(said, /the block above is everything it was measured against/u);
  assert.doesNotMatch(said, /marked|Size:/u, "the size it is marked at decides nothing here any more");
});

/* The two seeds, read off the body the shape reader already scanned. */
test("the place is the cause section's first path or verb, then Where's, then the body's own", () => {
  assert.equal(placeIn("## Where\n\n`plugin/src/commands.mjs`, the attach verb\n"), "plugin/src/commands.mjs");
  assert.equal(placeIn("`forge issue` takes `--json`, and `plugin/src/x.mjs` holds it"), "forge issue",
    "with no Where section the body's first names it");
  /* The Where section wins even where the body named something earlier: the place is where the
     defect is, and the prose above it names whatever it is being compared against. */
  assert.equal(placeIn("`forge record` already does it.\n\n## Where\n\n`forge attach`, the bare verb\n"),
    "forge attach");
  assert.equal(placeIn("nothing in here names a thing at all"), null);
  /* A *Where* whose prose names nothing does not suppress the body: an empty section is no place,
     and the filing that carries one would otherwise send no place query at all. */
  assert.equal(placeIn("`forge issue` writes it.\n\n## Where\n\nwherever the edge is written.\n"), "forge issue");
  /* A symptom shows in one file and comes from another, and it is the cause a second report of it
     shares. So where the two sections disagree the cause is what the fold aims at. */
  assert.equal(
    placeIn("## Why it happens\n\n`plugin/src/ladder.mjs` reads it\n\n## Where\n\n`forge advance`\n"),
    "plugin/src/ladder.mjs",
  );
  /* And the chain ends where it always did, so nothing written under the older shape is measured
     anywhere new. */
  assert.equal(placeIn("## Why it happens\n\nnothing here names a thing\n\n## Where\n\n`forge advance`\n"),
    "forge advance");
  assert.equal(placeIn("## Why it happens\n\nno place named\n\n`forge next` is where it shows\n"), "forge next");
});

test("the semantic seed is the title and the first section the kind requires", () => {
  const body = "## What happened\n\nthe verb refuses a name it should take\n\n## Outcome\n\nit takes it\n";
  assert.equal(seedFor({ title: "the verb takes the name", body, kind: "bug" }),
    "the verb takes the name\n\nthe verb refuses a name it should take");
  /* A feature has no past-tense section, so the same body seeds from the outcome instead. */
  assert.equal(seedFor({ title: "t", body, kind: "feature" }), "t\n\nit takes it");
  /* A marked body is read against no section and may carry no heading at all. */
  assert.equal(seedFor({ title: "t", body: "one line, no heading, marked\n\nSize: fix.\n" }),
    "t\n\none line, no heading, marked");
});
