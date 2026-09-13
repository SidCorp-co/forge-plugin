/* The two questions a gate asks per tool call and per run, against the reader that held the log as
   rows to answer them: the same answer, on the same rows, is all that earns the cheaper scan. */
import assert from "node:assert/strict";
import test from "node:test";

import { jsonlOf, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, since the module reaches the log's path and the developer's is live. */
const sandbox = tempRoom("forge-codex-asked-");
process.env.XDG_CONFIG_HOME = sandbox;

const { consultCount, sentShaOf } = await import("../../../src/codex/log/asked.mjs");
const { answered, logEntries } = await import("../../../src/codex/codex-log.mjs");

/* What the callers ran before ISS-1044: every row as an object, then the one field. */
const heldAsRows = (rows, root, rel) => {
  for (const one of answered(rows).reverse()) {
    if (one.root !== root) continue;
    const hit = (one.sent ?? []).find((sent) => sent.rel === rel);
    if (hit) return hit.sha ?? null;
  }
  return null;
};

const sent = (over) => ({ kind: "consult", ok: true, reply: "CODEX: 0 findings", root: "/a", ...over });
const QUOTED = 'docs/a"b.md';
const rows = [
  sent({ id: "c1", sent: [{ rel: "docs/one.md", sha: "aaa" }, { rel: QUOTED, sha: "qqq" }] }),
  sent({ id: "c2", root: "/other", sent: [{ rel: "docs/one.md", sha: "bbb" }] }),
  sent({ id: "c3", sent: [{ rel: "docs/two.md", sha: "ccc" }] }),
  sent({ id: "c4", ok: false, reply: null, sent: [{ rel: "docs/one.md", sha: "ddd" }] }),
  sent({ id: "c5", sent: [{ rel: "docs/nosha.md" }] }),
  { kind: "verdict", of: "c1" },
];
const bytes = jsonlOf(rows);

test("the sha a path was last sent under is the one the whole-log reader answered", () => {
  const asked = [
    ["a path this root sent", "/a", "docs/one.md"],
    ["a newer failed consult does not answer for it", "/a", "docs/one.md"],
    ["a path only another root sent", "/a", "docs/three.md"],
    ["the other root's own", "/other", "docs/one.md"],
    ["a root the log has never seen", "/nowhere", "docs/one.md"],
    ["a sent row carrying no sha", "/a", "docs/nosha.md"],
    ["a path whose name JSON escapes", "/a", QUOTED],
  ];
  for (const [what, root, rel] of asked) {
    assert.equal(sentShaOf(bytes, root, rel), heldAsRows(rows, root, rel), what);
  }
  assert.equal(sentShaOf(bytes, "/a", "docs/one.md"), "aaa", "and the answer is the sha itself");
  assert.equal(sentShaOf(bytes, "/a", "docs/nosha.md"), null, "a row with no sha is no hash, not undefined");
  assert.equal(sentShaOf(Buffer.alloc(0), "/a", "docs/one.md"), null, "an unwritten log answers null");
});

test("the consult count is the count the parsed log gives", () => {
  assert.equal(consultCount(bytes), rows.filter((one) => one.kind === "consult").length);
  assert.equal(consultCount(Buffer.alloc(0)), 0);
  const torn = Buffer.concat([bytes, Buffer.from(`{"kind":"consult","id":"c6"${JSON.stringify(sent({ id: "c7" }))}\n`)]);
  assert.equal(consultCount(torn), consultCount(bytes), "a row an append tore carries the mark and is no consult");
  assert.deepEqual(logEntries(), [], "the sandbox holds no log of its own, so nothing here read the developer's");
});
