/* The table is a rule with a checker, so every assertion is watched failing on a table that breaks
   it: a row the tracker no longer serves, a replacement naming nothing, a list that leaked a slug
   the verb holds. The verb's half runs against a fake tracker, where the call it does not make is
   as much of the behaviour as the line it prints. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("guides").path;
const {
  GUIDE_TABLE,
  REVIEWED,
  dispositionOf,
  heldSlugs,
  reviewGuideTable,
  supersededSlugs,
  trackerHeader,
  visibleGuides,
} = await import("../../src/tracker/guides.mjs");
const { VERB_NAMES } = await import("../../src/resolve/visibility.mjs");
const { suggest } = await import("../../src/suggest.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
/* Inside the plugin and not inside the checkout: an installed copy is `plugin/` and nothing else, so
   a route naming a path only this tree holds is a route only this machine can follow (ISS-78). */
const review = (extra = {}) =>
  reviewGuideTable({
    served: REVIEWED,
    listed: visibleGuides(REVIEWED),
    verbs: new Set(VERB_NAMES),
    resolves: (ref) => existsSync(join(PLUGIN, ref)),
    ...extra,
  });

test("every disposition is one the verb acts on", () => {
  for (const row of GUIDE_TABLE) {
    assert.ok(["superseded", "partly"].includes(row.disposition), `${row.slug}: ${row.disposition}`);
    assert.ok(row.why.length > 20, `${row.slug} says nothing about why`);
    assert.ok(Array.isArray(row.by), `${row.slug} names no replacement list`);
  }
  assert.equal(supersededSlugs().size, 5, "five of the twelve, which is what the issue read");
  assert.equal(heldSlugs().size, GUIDE_TABLE.length, "and every row is one the verb withholds");
});

test("a row the tracker no longer serves is a finding", () => {
  assert.deepEqual(review().retired, [], "and today every row is served");
  const gone = [{ slug: "pipeline-and-issue-lifecycle-v2", disposition: "superseded", why: "x".repeat(30), replaced: [], by: [] }];
  assert.deepEqual(review({ table: gone }).retired, ["pipeline-and-issue-lifecycle-v2"]);
});

test("a served guide the table never reviewed is named, and judged by nobody", () => {
  assert.deepEqual(review().unreviewed, [], "the recorded list is the list that was read");
  assert.deepEqual(review({ served: [...REVIEWED, "release-trains"] }).unreviewed, ["release-trains"]);
});

test("every replacement resolves to a verb this CLI has or a path the installed copy carries", () => {
  assert.deepEqual(review().unresolved, []);
  const wrong = [{ slug: "agent-setup", disposition: "superseded", why: "x".repeat(30), replaced: [], by: ["forge remember", "docs/issue-flow-contract.md"] }];
  assert.deepEqual(
    review({ table: wrong }).unresolved.map((one) => one.ref),
    ["forge remember", "docs/issue-flow-contract.md"],
    "which is where every row of this table pointed until ISS-78: a file the checkout has and no install does",
  );
});

/* An absent resolver reports every path unresolved rather than passing them: a checker whose input
   nobody wired looks exactly like a table with nothing wrong. */
test("nothing resolves by default", () => {
  assert.equal(reviewGuideTable({ served: REVIEWED }).unresolved.length > 0, true);
});

/* Every row, not the superseded ones: a page half of which is the runner's is not one an agent can
   follow whole either, and ISS-85 hides it on the same reasoning. */
test("a list still carrying a slug the table holds is a finding", () => {
  assert.deepEqual(review().leaked, [], "the projection is what the verb prints");
  assert.deepEqual(review({ listed: REVIEWED }).leaked.length, 7, "and the raw list is what it must not");
  assert.equal(visibleGuides(REVIEWED).length, REVIEWED.length - 7);
  assert.equal(visibleGuides(REVIEWED).includes("memory-and-knowledge"), false, "the partly rows too");
});

test("--tracker's header says whose text follows and every rule the contract replaces", () => {
  const header = trackerHeader(dispositionOf("pipeline-and-issue-lifecycle"));
  assert.match(header[0], /the tracker's own guide/u);
  assert.equal(header.length, 6, "the opening and one entry per replaced rule");
  assert.match(header.join("\n"), /sessionContext/u, "named in the guide's own terms");
  assert.match(trackerHeader(null)[0], /no disposition/u, "and a guide with no row says so");
});


const GUIDES = REVIEWED.map((slug) => ({ slug, summary: `what ${slug} is about` }));
const BODY = "## Heading\n\nThe tracker's own sentence, served whole.";
const state = {
  issues: [],
  answer: {
    forge_guide: (args) => {
      if (args.action === "list") return { guides: GUIDES };
      if (!REVIEWED.includes(args.slug)) return { refused: `No guide named ${args.slug}` };
      return { guide: { body: BODY } };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const asked = async (...argv) => {
  state.calls = [];
  const run = await ranAsync(FORGE, ["guide", ...argv], tracker.env);
  return { ...run, guideCalls: (state.calls ?? []).filter((one) => one.name === "forge_guide") };
};

test("the listing carries the five the plugin stands behind, under the contract that outranks them", async () => {
  const run = await asked();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.startsWith("contract\n"), true, `the contract is listed first:\n${run.stdout}`);
  assert.match(run.stdout.split("\n")[1], /this plugin's own, not the tracker's/u);
  for (const slug of heldSlugs()) {
    assert.equal(run.stdout.includes(slug), false, `${slug} is still named`);
  }
  assert.match(run.stdout, /attachments-and-uploads/u);
  /* The count line was the third trace ISS-85 took out: a guide that is not there costs nothing,
     and one an agent is told exists and is stale costs it a read and a weighing of two sources. */
  const last = GUIDES.find((one) => one.slug === visibleGuides(REVIEWED).at(-1));
  assert.equal(run.stdout.trim().endsWith(last.summary), true, `nothing follows the last:\n${run.stdout}`);
  assert.doesNotMatch(run.stdout, /not listed|withheld|supersede/u);
});

/* Exactly as an unknown slug, which is the rule: an answer that says the slug exists elsewhere is
   what makes an agent go and read it. Both dispositions, since both hide the same way now. */
for (const slug of ["what-is-an-issue", "memory-and-knowledge"]) {
  test(`a held slug is refused as the tracker's unknown, without asking for it: ${slug}`, async () => {
    const run = await asked(slug);
    const unknown = await asked("no-such-guide-here");
    assert.equal(run.status, 1, run.stdout);
    assert.equal(run.stderr, unknown.stderr.replace("no-such-guide-here", slug), run.stderr);
    assert.equal(run.stdout, "", "and nothing on stdout");
    assert.doesNotMatch(run.stderr, /supersede|kept as the tracker's|--tracker/u, "no trace of the row");
    assert.deepEqual(run.guideCalls.filter((one) => one.args.action === "get"), [], "no get for a body it hides");
  });
}

test("--tracker prints the body, under the header that says what it replaces", async () => {
  const run = await asked("what-is-an-issue", "--tracker");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /the tracker's own guide/u);
  assert.ok(run.stdout.includes(BODY), run.stdout);
  assert.equal(run.guideCalls.length, 1, "one get, and no list behind it");
});

test("a guide with no row prints what the tracker returned and nothing else", async () => {
  const run = await asked("deploy-safety");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), BODY, run.stdout);
});

/* A suggestion is output too, so a typo of a held slug must not name it — the `partly` rows are the
   case that passed before ISS-85 hid them. The guard is what keeps each string a near miss the
   suppression was actually asked about: a typo that has stopped ranking against anything held would
   run the loop over an answer the verb never had to withhold, and pass. */
test("a near miss is offered from the guides that stand", async () => {
  for (const typo of ["pipeline-and-issue-lifecycl", "memory-and-knowledg", "issue-dependencie"]) {
    assert.ok(suggest(typo, REVIEWED).some((slug) => heldSlugs().has(slug)), `${typo} misses nothing held`);
    const run = await asked(typo);
    assert.equal(run.status, 1);
    for (const slug of heldSlugs()) {
      assert.equal(run.stderr.includes(slug), false, `${typo} was answered with ${slug}: ${run.stderr}`);
    }
  }
});

/* The verb prints it first in the listing and answers it off disk, so a refusal that read only the
   tracker's list offered every slug but the one the caller was most likely reaching for. */
test("the slug this verb answers off disk is among the candidates", async () => {
  const run = await asked("contrct");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Did you mean: contract/u);
});

test("a flag the verb does not take is refused rather than kept", async () => {
  const run = await asked("deploy-safety", "--verbose", "yes");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No guide flag named --verbose\./u);
  assert.match(run.stderr, /Usage: forge guide/u);
  assert.doesNotMatch(run.stderr, /--tracker/u, "and the flag no help text names is named in none");
});

/* The whole point of moving it: a copy with no tracker reachable still reads the rule. The fake one
   here is reachable, so the assertion is on the calls it never received. */
test("the contract is answered off disk, by part, and costs no call at all", async () => {
  const contents = await asked("contract");
  assert.equal(contents.status, 0, contents.stderr);
  assert.match(contents.stdout, /^The issue-flow contract — this plugin's own, contract \d+/u);
  assert.deepEqual(contents.guideCalls, [], "no call for the listing");
  const part = await asked("contract", "released");
  assert.equal(part.status, 0, part.stderr);
  assert.match(part.stdout, /^### `released`/u);
  assert.deepEqual(part.guideCalls, [], "and none for a part");
  const refused = await asked("contract", "--tracker");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /--tracker does not apply to contract/u);
  assert.doesNotMatch(refused.stderr, /a guide's own text/u, "a refusal says nothing the flag does");
  assert.deepEqual(refused.guideCalls, []);
});

test("a second positional and a bare --tracker are refused, never dropped", async () => {
  const extra = await asked("deploy-safety", "elsewhere");
  assert.equal(extra.status, 1);
  assert.match(extra.stderr, /one slug/u);
  const two = await asked("contract", "released", "elsewhere");
  assert.equal(two.status, 1);
  assert.match(two.stderr, /contract takes one part/u, "and the contract's own second positional too");
  const bare = await asked("--tracker");
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /--tracker names no guide/u);
  assert.deepEqual(bare.guideCalls, [], "and it does not fall back to the listing");
});
