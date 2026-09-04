/* The dependency graph's own reading of a cut page (ISS-203). The graph ranks every node against
   one unfiltered listing, so a page the tracker cut is a graph missing nodes — and the warning that
   said so fired only at a page of exactly MAX_LIMIT, which the byte cap never returns. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, pageOf, ranAsync } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

/* The marker sentence is the built-in English default: an issue carrying none is no node at all,
   so at least one body has to claim an edge or the verb refuses before it warns about anything. */
const claim = (blocker) => `It is blocked by the ${blocker} issue, and those edges are recorded.`;

const ROWS = Array.from({ length: 4 }, (_, at) => ({
  issueId: `ISS-${at + 20}`,
  documentId: `u-${at + 20}`,
  status: "open",
  priority: "medium",
  title: `a node of the graph, number ${at + 1}`,
  description: at === 0 ? claim("ISS-21") : "Nothing is claimed here.",
  createdAt: `2026-0${at + 1}-01T00:00:00.000Z`,
  touched: 4 - at,
}));

const state = { issues: ROWS, comments: {}, calls: [], answer: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv) => ranAsync(FORGE, argv, tracker.env, ROOT);

/* The listing every node is ranked against came back cut while the marker SEARCH reached the whole
   set: the graph looked complete because its candidates were all there (ISS-203, ISS-221). */
const cutTo = (fits, rows = ROWS) => {
  const page = pageOf(rows, fits);
  state.answer.forge_issues = (args) =>
    (args.action === "list" && !args.filters?.search
      ? page(args)
      : { issues: rows.filter((one) => !args.filters?.search
        || JSON.stringify(one).toLowerCase().includes(String(args.filters.search).toLowerCase())),
      returned: rows.length,
      hasMore: false });
};

test("a graph whose listing came back cut is ranked against every node anyway", async () => {
  cutTo(2);
  const run = await ran(["deps"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /of 4 carry prose/u, "four nodes, two of which one answer could hold");
  assert.doesNotMatch(run.stderr, /incomplete/u, "the walk reached them, so nothing is owed to say so");
});

/* One timestamp on every row: the only interval a walk cannot subdivide, so the only shape left
   that costs the graph nodes. */
const ONE_TIMESTAMP = ROWS.map((one) => ({ ...one, createdAt: "2026-01-01T00:00:00.000Z" }));

test("a graph the walk could not finish reading says so, in the nodes it read", async () => {
  cutTo(2, ONE_TIMESTAMP);
  const run = await ran(["deps"]);
  const said = run.stderr.split("\n").find((line) => line.includes("incomplete")) ?? "";
  assert.match(said, /2 issue\(s\)/u);
  assert.doesNotMatch(said, /at least 500|\b500\b/u, "the old line named 500 as the count it had read");
});

test("the warning says what the short reading costs the graph", async () => {
  cutTo(2, ONE_TIMESTAMP);
  const run = await ran(["deps"]);
  assert.match(run.stderr, /an edge whose end fell outside what was reached cannot appear/u);
});

test("the tracker's own notice reaches the reader here too", async () => {
  cutTo(2, ONE_TIMESTAMP);
  const run = await ran(["deps"]);
  assert.match(run.stderr, /A higher limit will NOT help/u);
});

test("a page the tracker reports whole warns about nothing", async () => {
  state.answer.forge_issues = undefined;
  const run = await ran(["deps"]);
  assert.doesNotMatch(run.stderr, /incomplete/u);
});

/* The verb's other whole-set read: the carriers ARE the nodes, so a search answer the byte cap cut
   costs the graph nodes rather than their rank — and walking the universe alone left that silent,
   the universe having come back whole (codex F1 on ISS-221). The first two rows carry a claim. */
const CLAIMING = 2;
const CARRIERS = ROWS.map((one, at) => (at < CLAIMING ? { ...one, description: claim(`ISS-${at + 22}`) } : one));
const cutSearch = (fits, rows = CARRIERS) => {
  const page = pageOf(rows.slice(0, CLAIMING), fits);
  state.answer.forge_issues = (args) => {
    if (args.action !== "list") return { documentId: args.documentId, ...(args.data ?? {}) };
    return args.filters?.search ? page(args) : { issues: rows, returned: rows.length, hasMore: false };
  };
};

test("a carrier no single search answer could hold is still a node", async () => {
  cutSearch(1);
  const run = await ran(["deps"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /2 of 4 carry prose/u, "one carrier per answer, and both were reached");
  assert.doesNotMatch(run.stderr, /claiming an edge/u);
});

test("a carrier set the walk could not finish reading is said out loud", async () => {
  cutSearch(1, CARRIERS.map((one) => ({ ...one, createdAt: "2026-01-01T00:00:00.000Z" })));
  const run = await ran(["deps"]);
  assert.match(run.stderr, /the set of issues claiming an edge reached 1 issue\(s\)/u);
  assert.match(run.stderr, /a node this graph does not show may claim edges anyway/u);
});
