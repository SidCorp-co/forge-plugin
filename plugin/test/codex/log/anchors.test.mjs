/* Which findings a recorded file list admits, in its own file because the log's other questions fill one. A
   consult given only issue keys records the empty list, and a reviewer that may read the checkout anchors to it — the two landed a release apart and were lossy together (ISS-850). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the second test writes the log, and the developer's own is live. */
const sandbox = tempRoom("forge-codex-anchors-");
process.env.XDG_CONFIG_HOME = sandbox;

const { findingsIn, logConsult, logEntries, numbered } = await import("../../../src/codex/codex-log.mjs");
const { statsOf } = await import("../../../src/codex/codex-stats.mjs");

const REPLY = [
  "CODEX: 3 findings (1 blocker, 1 major, 1 minor)",
  "- **New — blocker:** `plugin/src/codex/codex-log.mjs:239` — the list admits nothing.",
  "- **New — major:** `ISS-850/body:12` — the outcome says so.",
  "- **New — minor:** `other.mjs:3` — about a file nobody named.",
].join("\n");

const ids = (files) => numbered(REPLY, files).map((one) => one.id);

test("a finding anchored to a file survives a file list the caller never filled", () => {
  assert.deepEqual(ids(null), ["F1", "F2", "F3"], "no list restricts nothing, which is the case that already worked");
  assert.deepEqual(ids([]), ["F1", "F2", "F3"], "and an empty one is that same case, not a range admitting no path");
  assert.equal(findingsIn(REPLY, []).length, 3, "by the other door onto the same filter");
  assert.deepEqual(ids(["plugin/src/codex/codex-log.mjs"]), ["F1", "F2"],
    "a list the caller did fill is still their range: the file nobody named drops, the tracker anchor stays");
  assert.deepEqual(ids(["nothing.mjs"]), ["F2"], "and a list naming none of the anchors keeps the tracker's alone");
});

/* The reader contract on a synthetic row, not integration evidence: `recheck` and the missing `newFindings` are set here to reach the stats fallback, which is the one exported reader that hands a row's own recorded list back to this filter, and `consult` never writes that pair. */
test("a row recorded with an empty file list keeps its code anchor when a reader filters by that list", () => {
  logConsult({
    kind: "consult", id: "k1", ok: true, at: "2026-09-09T11:00:00.000Z", root: "/a",
    files: [], issues: ["ISS-850"], recheck: true, reply: REPLY,
  });
  const row = logEntries().at(-1);
  assert.deepEqual(row.files, [], "the recorded list is empty and not absent, which is the value under test");
  assert.deepEqual(numbered(row.reply, row.files).map((one) => one.id), ["F1", "F2", "F3"]);
  assert.equal(statsOf([row]).newFindings, 3, "and the recheck fallback, recomputing from the reply, counts all three");
});
