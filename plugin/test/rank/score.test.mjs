/* A weight nothing can be shown to move is a weight nobody can trust: one case per row of the
   table, each changing one field of one issue and reading the order back. */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULTS } from "../../src/rank/weights.mjs";
import { bandOf, bandSaid, chainOf, holdingKeys, ordered, scoreOf, takeableKeys } from "../../src/rank/score.mjs";

const NOW = Date.parse("2026-09-05T00:00:00.000Z");

const row = (issueId, held = {}) => ({
  issueId,
  documentId: `u-${issueId}`,
  status: "open",
  priority: "medium",
  category: "feature",
  complexity: null,
  reopenCount: 0,
  createdAt: "2026-09-05T00:00:00.000Z",
  title: `${issueId} as it is filed`,
  ...held,
});

const rank = (rows, { chains = {} } = {}) =>
  ordered(rows.map((one) => ({
    issueId: one.issueId,
    row: one,
    score: scoreOf(one, { weights: DEFAULTS, chain: chains[one.issueId] ?? [], now: NOW }),
  }))).map((one) => one.issueId);

/* One field at a time: the pair is identical but for the field named, so the order it comes back in
   is that field's doing and nothing else's. */
test("every weight in the table moves the order on its own", () => {
  const cases = [
    ["priority", { priority: "critical" }, {}],
    ["kind", { category: "bug" }, {}],
    ["band", { complexity: "xs" }, { complexity: "xl" }],
    ["reopened", { reopenCount: 2 }, {}],
    ["age", { createdAt: "2026-08-30T00:00:00.000Z" }, {}],
  ];
  for (const [name, moved, other] of cases) {
    const order = rank([row("ISS-2", other), row("ISS-1", moved)]);
    assert.deepEqual(order, ["ISS-1", "ISS-2"], `${name} did not move the order`);
  }
  const blocked = rank([row("ISS-2"), row("ISS-1")], { chains: { "ISS-1": ["ISS-9"] } });
  assert.deepEqual(blocked, ["ISS-1", "ISS-2"], "blocks did not move the order");
});

/* Five values and five weights: a rung is three names over them, and the score weighs none of it. */
test("the band's own weight moves the order, the five values ranking apart", () => {
  const BANDS = ["xs", "s", "m", "l", "xl"];
  /* Handed in the opposite order to the one asserted: rows tie-break on arrival, so five already in rank order would pass this with two bands weighing the same. */
  const rows = BANDS.map((band, at) => row(`ISS-${at + 1}`, { complexity: band })).reverse();
  assert.deepEqual(rank(rows), ["ISS-1", "ISS-2", "ISS-3", "ISS-4", "ISS-5"],
    "the cheapest band first, and no two of the five sharing a weight");
  assert.equal(bandSaid(bandOf(row("ISS-1", { complexity: "l" }))), "the tracker's complexity",
    "and what the report names as having decided is the field, in the words the CLI says it in");
});

/* One source, so a `Size:` line is prose the score cannot read: the defect it closes is an issue
   sized `xs` on the tracker and marked `Size: fix.` in its body, which scored as the cheapest band
   on the ladder while `forge advance --owed` held the run to a fix (ISS-394). */
test("the field is the whole of the band, and a size named in a body moves nothing", () => {
  const marked = { description: "## Why\n\nA small thing.\n\nSize: fix.\n" };
  const band = bandOf(row("ISS-1", marked));
  assert.deepEqual([band, bandSaid(band)],
    ["unset", "no complexity on the tracker"], "a body naming a size is banded as an issue holding none");
  assert.deepEqual(["xs", "s", "m", "l", "xl"].map((one) => bandOf(row("ISS-1", { complexity: one }))),
    ["xs", "s", "m", "l", "xl"], "and every one of the five is its own value, three rungs or not");
  const order = rank([row("ISS-2", { complexity: "s" }), row("ISS-1", { ...marked, complexity: "xs" })]);
  assert.deepEqual(order, ["ISS-1", "ISS-2"], "so an xs outranks an s whatever the body beside it claims");
});

test("two issues equal on every weight break on the filing date, oldest first", () => {
  const older = row("ISS-9", { createdAt: "2026-09-04T23:00:00.000Z" });
  const newer = row("ISS-1", { createdAt: "2026-09-04T23:00:00.001Z" });
  assert.deepEqual(rank([newer, older]), ["ISS-9", "ISS-1"]);
  assert.deepEqual(rank([older, newer]), ["ISS-9", "ISS-1"], "and the order they arrived in is not it");
});

const graph = (pairs) => {
  const blocks = new Map();
  for (const [from, to] of pairs) blocks.set(from, [...(blocks.get(from) ?? []), to]);
  return blocks;
};

/* The whole reason the count is chained: a low-priority issue at the head of a chain is worth more
   than a critical one nothing waits on, and a count of direct edges would say the opposite. */
test("a blocker of a blocker outranks a lone critical issue by what the chain holds", () => {
  const under = ["ISS-3", "ISS-4", "ISS-5", "ISS-6"];
  const blocks = graph([["ISS-1", "ISS-2"], ...under.map((one) => ["ISS-2", one])]);
  const open = new Set(["ISS-1", "ISS-2", ...under, "ISS-7"]);
  const chain = chainOf("ISS-1", blocks, open);
  assert.deepEqual(chain.sort(), ["ISS-2", ...under], "the one it blocks, and the four under that");
  const held = [row("ISS-7", { priority: "critical" }), row("ISS-1", { priority: "high" })];
  assert.deepEqual(rank(held, { chains: { "ISS-1": chain } }), ["ISS-1", "ISS-7"]);
  assert.deepEqual(rank(held, { chains: { "ISS-1": ["ISS-2"] } }), ["ISS-7", "ISS-1"],
    "and the edge alone does not do it: the chaining is what outranks the tier");
  assert.equal(chainOf("ISS-1", blocks, new Set(["ISS-2"])).length, 1, "a closed issue is not counted");
});

/* A -> B -> C with B landed: C waited on B and B is gone, so landing A frees nothing. Counting C
   would pay A for a landing that releases no one. */
test("the chain stops at an issue that has already landed", () => {
  const blocks = graph([["ISS-1", "ISS-2"], ["ISS-2", "ISS-3"]]);
  const open = new Set(["ISS-1", "ISS-3"]);
  assert.deepEqual(chainOf("ISS-1", blocks, open), [], "ISS-2 landed, so ISS-3 is not ISS-1's to free");
  assert.deepEqual(chainOf("ISS-1", blocks, new Set(["ISS-1", "ISS-2", "ISS-3"])).sort(), ["ISS-2", "ISS-3"],
    "and with the middle still open it is");
});

/* What a run may take and what still holds work up are two sets, and the second is the flow's own
   answer: `forge advance` moves an issue past a blocker at `developed`, so a rank that called that
   blocker a wall would name one the transition does not. */
test("the set the chain stops at is what still gates, not what a run may take", () => {
  const rows = [
    { issueId: "ISS-1", status: "open" },
    { issueId: "ISS-2", status: "in_progress" },
    { issueId: "ISS-3", status: "waiting" },
    { issueId: "ISS-4", status: "developed" },
    { issueId: "ISS-5", status: "released" },
    { issueId: "ISS-6", status: "closed" },
  ];
  assert.deepEqual([...takeableKeys(rows)], ["ISS-1"]);
  assert.deepEqual([...holdingKeys(rows)], ["ISS-1", "ISS-2", "ISS-3"]);
  const blocks = graph([["ISS-1", "ISS-2"], ["ISS-2", "ISS-3"]]);
  assert.deepEqual(chainOf("ISS-1", blocks, holdingKeys(rows)).sort(), ["ISS-2", "ISS-3"],
    "an in-flight blocker is walked through, not stopped at");
  assert.deepEqual(chainOf("ISS-1", blocks, takeableKeys(rows)), [],
    "and reading the dispatch set instead loses the whole chain");
});

test("a cycle in the graph terminates rather than recursing", () => {
  const blocks = graph([["ISS-1", "ISS-2"], ["ISS-2", "ISS-3"], ["ISS-3", "ISS-1"]]);
  const open = new Set(["ISS-1", "ISS-2", "ISS-3"]);
  assert.deepEqual(chainOf("ISS-1", blocks, open).sort(), ["ISS-2", "ISS-3"], "and never itself");
});

test("the parts add up to the total, so --why accounts for the number beside it", () => {
  const held = scoreOf(row("ISS-1", { priority: "high", category: "bug", reopenCount: 1, complexity: "xs" }),
    { weights: DEFAULTS, chain: ["ISS-2"], now: NOW });
  assert.equal(held.total, held.parts.reduce((sum, one) => sum + one[2], 0));
  assert.equal(held.total, 30 + 8 + 8 + 0 + 5 + 3);
});
