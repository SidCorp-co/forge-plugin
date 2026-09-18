import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGE_KINDS, directedEdge, edgeRow, ordersEdge, relationsOf } from "../../../src/tracker/edges/kinds.mjs";

/* The kinds were two bare names and six readers each said what one meant, agreeing only because
   there were two of them (ISS-769). What each column answers is asserted here once, and the readers
   above are asserted against the column rather than against the name. */
describe("an edge kind is a row", () => {
  const dep = (kind, to) => ({ id: `e-${to}`, kind, fromIssueId: "u-1", toIssueId: to,
    toDisplayId: to, fromDisplayId: "ISS-1", toStatus: "open", fromStatus: "open" });

  it("every kind the CLI names has a row, and a kind the tracker did not name has none", () => {
    for (const kind of EDGE_KINDS) assert.ok(edgeRow(kind), `${kind} is on no row`);
    assert.equal(edgeRow("duplicates"), null);
    assert.equal(edgeRow(undefined), null);
  });

  it("the four columns are what the readers ask, and each kind answers all four", () => {
    assert.deepEqual(edgeRow("blocks"),
      { kind: "blocks", orders: true, directed: true, writtenOn: "other", readsBack: "blockedBy" });
    assert.deepEqual(edgeRow("relates"),
      { kind: "relates", orders: false, directed: false, writtenOn: "subject", readsBack: "relates" });
  });

  it("a directed edge reads back by which end read it, and an undirected one from either end", () => {
    const both = relationsOf({ outgoing: [dep("blocks", "u-2")], incoming: [dep("blocks", "u-3")] });
    assert.deepEqual(both.blocks.map((one) => one.otherIssueId), ["u-2"]);
    assert.deepEqual(both.blockedBy.map((one) => one.fromIssueId), ["u-1"]);
    assert.deepEqual(both.relates, [], "a directed edge is in neither of the other two lists");
    const out = relationsOf({ outgoing: [dep("relates", "u-2")], incoming: [] });
    const held = relationsOf({ outgoing: [], incoming: [dep("relates", "u-2")] });
    assert.equal(out.relates.length, 1, "read from the end that wrote it");
    assert.equal(held.relates.length, 1, "and from the end that did not");
    assert.deepEqual([...out.blocks, ...out.blockedBy, ...held.blocks, ...held.blockedBy], []);
  });

  /* The one reading that moved: such an edge kept its place in the two directed lists, where it is
     still visible, and stopped gating a dispatch or answering a prose blocking claim on a guess. */
  it("a kind this table does not name keeps its direction and orders nothing", () => {
    const unknown = { kind: "duplicates" };
    assert.equal(directedEdge(unknown), true);
    assert.equal(ordersEdge(unknown), false);
    const read = relationsOf({ outgoing: [dep("duplicates", "u-2")], incoming: [] });
    assert.equal(read.blocks.length, 1, "and is read back where a directed edge is, not dropped");
    assert.deepEqual(read.relates, []);
  });

  it("an edge carrying no kind at all is read the same way, rather than crashing a reader", () => {
    assert.equal(directedEdge({}), true);
    assert.equal(ordersEdge({}), false);
    assert.equal(directedEdge(null), true);
    assert.equal(ordersEdge(undefined), false);
  });
});
