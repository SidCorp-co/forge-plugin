/* A weight nothing can be shown to move is a weight nobody can trust: one case per row of the
   table, each changing one field of one issue and reading the order back. */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULTS } from "../../src/rank/weights.mjs";
import { bandOf, chainOf, ordered, scoreOf } from "../../src/rank/score.mjs";

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

const rank = (rows, { chains = {}, fixes = {} } = {}) =>
  ordered(rows.map((one) => ({
    issueId: one.issueId,
    row: one,
    score: scoreOf(one, { weights: DEFAULTS, chain: chains[one.issueId] ?? [], fix: fixes[one.issueId] ?? false, now: NOW }),
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

test("the band's own weight moves it, from the Size line as from the field", () => {
  const bySize = rank([row("ISS-2"), row("ISS-1")], { fixes: { "ISS-1": true } });
  assert.deepEqual(bySize, ["ISS-1", "ISS-2"], "a fix-size body outranks an unset one");
  assert.equal(bandOf(row("ISS-1", { complexity: "l" }), { fix: true }).from, "the tracker's size",
    "the field decides where the tracker gives one, and the word for it is this CLI's");
  assert.equal(bandOf(row("ISS-1"), { fix: true }).band, "xs");
  assert.equal(bandOf(row("ISS-1"), { fix: true }).from, "the Size line");
  assert.equal(bandOf(row("ISS-1"), { fix: null }).from, "the body unread");
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

test("a cycle in the graph terminates rather than recursing", () => {
  const blocks = graph([["ISS-1", "ISS-2"], ["ISS-2", "ISS-3"], ["ISS-3", "ISS-1"]]);
  const open = new Set(["ISS-1", "ISS-2", "ISS-3"]);
  assert.deepEqual(chainOf("ISS-1", blocks, open).sort(), ["ISS-2", "ISS-3"], "and never itself");
});

test("the parts add up to the total, so --why accounts for the number beside it", () => {
  const held = scoreOf(row("ISS-1", { priority: "high", category: "bug", reopenCount: 1 }),
    { weights: DEFAULTS, chain: ["ISS-2"], fix: true, now: NOW });
  assert.equal(held.total, held.parts.reduce((sum, one) => sum + one[2], 0));
  assert.equal(held.total, 30 + 8 + 8 + 0 + 5 + 3);
});
