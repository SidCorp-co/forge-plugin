/* The table is a rule with a checker, so every assertion is watched failing on a table that breaks
   it: a row the tracker no longer serves, a replacement naming nothing, a list that leaked a
   superseded slug. The verb's half runs against a fake tracker, where the call it does not make is
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
  caveatLine,
  dispositionOf,
  replacementLine,
  reviewGuideTable,
  supersededSlugs,
  trackerHeader,
  visibleGuides,
  withheldLine,
} = await import("../../src/tracker/guides.mjs");
const { VERB_NAMES } = await import("../../src/resolve/visibility.mjs");

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

test("a list still carrying a superseded slug is a finding", () => {
  assert.deepEqual(review().leaked, [], "the projection is what the verb prints");
  assert.deepEqual(review({ listed: REVIEWED }).leaked.length, 5, "and the raw list is what it must not");
  assert.equal(visibleGuides(REVIEWED).length, REVIEWED.length - 5);
});

test("the replacement is one line, and none of it is the guide's own text", () => {
  const line = replacementLine(dispositionOf("pipeline-and-issue-lifecycle"));
  assert.equal(line.includes("\n"), false, line);
  assert.match(line, /superseded/u);
  assert.match(line, /forge guide contract/u, "and it says where to read instead");
  assert.match(line, /--tracker/u, "and how to read the tracker's own");
  assert.doesNotMatch(line, /RECONCILE|blockquote|runner slot/u, "no sentence of the body");
});

test("a guide kept with one half withdrawn says which half in its first line", () => {
  assert.match(caveatLine(dispositionOf("memory-and-knowledge")), /no memory verb/u);
  assert.match(caveatLine(dispositionOf("issue-dependencies-and-decompose")), /decompose/u);
});

test("--tracker's header says whose text follows and every rule the contract replaces", () => {
  const header = trackerHeader(dispositionOf("pipeline-and-issue-lifecycle"));
  assert.match(header[0], /the tracker's own guide/u);
  assert.equal(header.length, 6, "the opening and one entry per replaced rule");
  assert.match(header.join("\n"), /sessionContext/u, "named in the guide's own terms");
  assert.match(trackerHeader(null)[0], /no disposition/u, "and a guide with no row says so");
});

test("the count withheld and the way to each is on the listing", () => {
  assert.match(withheldLine(5), /5 guide\(s\)/u);
  assert.match(withheldLine(5), /--tracker/u);
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

test("the listing carries the seven the plugin stands behind, under the contract that outranks them", async () => {
  const run = await asked();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.startsWith("contract\n"), true, `the contract is listed first:\n${run.stdout}`);
  assert.match(run.stdout.split("\n")[1], /this plugin's own, not the tracker's/u);
  for (const slug of supersededSlugs()) {
    assert.equal(run.stdout.includes(`${slug}\n`), false, `${slug} is still listed`);
  }
  assert.match(run.stdout, /attachments-and-uploads/u);
  assert.match(run.stdout, /5 guide\(s\) the contract supersedes are not listed/u);
});

test("a superseded slug answers from the table, without asking the tracker for it", async () => {
  const run = await asked("what-is-an-issue");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /what-is-an-issue: superseded/u);
  assert.equal(run.stdout.includes(BODY), false, "and none of the body");
  assert.deepEqual(run.guideCalls, [], "no call was made at all");
});

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

test("a near miss is offered from the guides that stand", async () => {
  const run = await asked("pipeline-and-issue-lifecycl");
  assert.equal(run.status, 1);
  assert.equal(run.stderr.includes("pipeline-and-issue-lifecycle"), false, run.stderr);
});

test("a flag the verb does not take is refused rather than kept", async () => {
  const run = await asked("deploy-safety", "--verbose", "yes");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /no --verbose flag/u);
  assert.match(run.stderr, /Usage: forge guide/u);
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
  assert.match(refused.stderr, /the contract is this plugin's/u);
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
  assert.match(bare.stderr, /name it/u);
  assert.deepEqual(bare.guideCalls, [], "and it does not fall back to the listing");
});
