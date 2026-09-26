/* A recheck's REFUTED means "fixed, or never real", and only the bytes can tell which: with nothing
   moved since the consult no fix exists, so the finding goes on the record as rejected rather than as
   the accepted the eval counts as a finding worth having (ISS-2641). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

const sandbox = tempRoom("forge-codex-refuted-unchanged-");
process.env.XDG_CONFIG_HOME = sandbox;

const { verdictFromRulings } = await import("../../../src/codex/log/replies.mjs");
const { sameBytesSince } = await import("../../../src/codex/codex-log.mjs");
const { digestsAt } = await import("../../../src/codex/codex-set.mjs");
const { bundle } = await import("../../../src/codex/codex-api.mjs");

const judged = {
  id: "0183fa", files: ["a.mjs", "b.mjs"],
  reply: "CODEX: 2 findings\n- **F1 — New — major:** `a.mjs:1` — the importer points at the old path.\n- **F2 — New — minor:** `b.mjs:2` — y.",
};
const plan = { judged, ids: ["F1", "F2"], risks: [] };
const REFUTED = "1. **REFUTED** — no stale importer was found.\n2. **CONFIRMED** — still there.\n\nCODEX: 0 findings";

test("a refutation over a set unchanged since its consult records the finding as rejected, naming the recheck", () => {
  const auto = verdictFromRulings(plan, 0, REFUTED, "6b2a83", null, true);
  assert.deepEqual(auto.record.kept, [], "nothing the recheck refuted over unmoved bytes is accepted");
  assert.deepEqual(Object.keys(auto.record.dropped), ["F1"]);
  assert.match(auto.record.dropped.F1, /recheck 6b2a83 refuted it over files unchanged since consult 0183fa/u);
  assert.deepEqual(auto.record.auto, ["F2", "F1"], "the rejection is the recheck's own word, which a later recheck or the author may move");
  assert.deepEqual(auto.record.reopened, ["F2"], "a CONFIRMED ruling stays open whatever the bytes say");
  assert.match(auto.said, /accepted: none; rejected: F1, refuted over files unchanged since 0183fa; still open: F2\./u);
});

test("a refutation after the set changed records the finding as accepted, as before", () => {
  const auto = verdictFromRulings(plan, 0, REFUTED, "6b2a83", null, false);
  assert.deepEqual(auto.record.kept, ["F1"]);
  assert.deepEqual(auto.record.dropped, {});
  assert.match(auto.said, /accepted: F1; still open: F2\./u);
});

test("the author's own ruling still stands over a refutation on unmoved bytes", () => {
  const auto = verdictFromRulings(plan, 0, REFUTED, "6b2a83", { kept: ["F1"], dropped: {} }, true);
  assert.deepEqual(auto.record.kept, ["F1"], "the author accepted it, and a recheck does not rewrite that");
  assert.deepEqual(auto.record.stood, { F1: "REFUTED" });
});

test("a set is unchanged only where every file it was sent carries a sha that the digest now matches", () => {
  const row = { sent: [{ rel: "a.mjs", sha: "aaa" }, { rel: "b.mjs", sha: "bbb" }] };
  assert.equal(sameBytesSince(row, new Map([["a.mjs", "aaa"], ["b.mjs", "bbb"]])), true);
  assert.equal(sameBytesSince(row, new Map([["a.mjs", "aaa"], ["b.mjs", "ccc"]])), false, "one file moved");
  assert.equal(sameBytesSince(row, new Map([["a.mjs", "aaa"]])), false, "a file no digest answers is not proven unmoved");
  assert.equal(sameBytesSince({ sent: [{ rel: "a.mjs", sha: "aaa" }, { rel: "b.mjs" }] }, new Map([["a.mjs", "aaa"], ["b.mjs", undefined]])), false,
    "a row carrying no sha for a file reads as moved");
  assert.equal(sameBytesSince({ files: ["a.mjs"] }, new Map([["a.mjs", "aaa"]])), false, "a row from before `sent` proves nothing");
});

test("the digests at a recheck are of the files' bytes: the recheck's own send first, the disk for the rest", () => {
  const root = tempRoom("forge-codex-digests-");
  writeFileSync(join(root, "a.mjs"), "export const a = 1;\n");
  writeFileSync(join(root, "b.mjs"), "export const b = 2;\n");
  const consult = { sent: bundle(root, ["a.mjs", "b.mjs"]).map(({ rel, sha }) => ({ rel, sha })) };
  assert.equal(sameBytesSince(consult, digestsAt(root, consult)), true, "nothing moved on disk");
  writeFileSync(join(root, "b.mjs"), "export const b = 3;\n");
  assert.equal(sameBytesSince(consult, digestsAt(root, consult)), false, "an edit to one file of the set moves the set");
  const carried = [{ rel: "b.mjs", sha: consult.sent[1].sha }];
  assert.equal(sameBytesSince(consult, digestsAt(root, consult, carried)), true,
    "what the recheck itself sent answers for that file, being the bytes the reviewer was shown");
});
