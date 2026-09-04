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

/* The listing every node is ranked against comes back cut; the marker SEARCH still reaches the
   whole set, which is exactly the seam — the graph looks complete because its candidates are all
   there, while the set they were ranked against is half missing. */
const cutTo = (fits) => {
  const page = pageOf(ROWS, fits);
  state.answer.forge_issues = (args) =>
    (args.action === "list" && !args.filters?.search
      ? page(args)
      : { issues: ROWS.filter((one) => !args.filters?.search
        || JSON.stringify(one).toLowerCase().includes(String(args.filters.search).toLowerCase())),
      returned: ROWS.length,
      hasMore: false });
};

test("a graph ranked against a cut page says so", async () => {
  cutTo(2);
  const run = await ran(["deps"]);
  assert.match(run.stderr, /was cut to the 2 row\(s\) read, by response-size/u,
    "two rows of four, against an ask of 500 — the length test read that as the whole backlog");
});

test("the warning states the nodes it read and never the limit it asked for", async () => {
  cutTo(2);
  const run = await ran(["deps"]);
  const said = run.stderr.split("\n").find((line) => line.includes("was cut to")) ?? "";
  assert.match(said, /2 row\(s\)/u);
  assert.doesNotMatch(said, /at least 500|\b500\b/u, "the old line named 500 as the count it had read");
});

test("the warning says what the cut costs the graph", async () => {
  cutTo(2);
  const run = await ran(["deps"]);
  assert.match(run.stderr, /an edge whose end fell outside those rows cannot appear/u);
});

test("the tracker's own notice reaches the reader here too", async () => {
  cutTo(2);
  const run = await ran(["deps"]);
  assert.match(run.stderr, /A higher limit will NOT help/u);
});

test("a page the tracker reports whole warns about nothing", async () => {
  state.answer.forge_issues = undefined;
  const run = await ran(["deps"]);
  assert.doesNotMatch(run.stderr, /was cut to/u);
});
