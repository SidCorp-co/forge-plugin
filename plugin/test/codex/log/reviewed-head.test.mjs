/* Which head a review was earned at, in its own file because the log's other questions fill one. The
   ship refuses a branch rewritten since that head (ISS-972) past a step with no flag through it, so
   a head off some other read refuses a run that did nothing wrong: every absence answers null, an
   absent read and a stale one being obliged not to read alike. Two are this reader's and not the
   recheck's shared `shortOfWhole` — a `dirty` head is where the pass was taken, not what it read. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("forge-reviewed-head-");
const { wholeReadOf } = await import("../../../src/codex/codex-log.mjs");

const RELS = ["a.mjs", "b.mjs"];
const SENT = RELS.map((rel) => ({ rel, chars: 9, clipped: false }));
const READ = {
  kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: RELS, sent: SENT,
  send: "bodies", head: "aaaaaaa", reply: "CODEX: 0 findings",
};

test("the head a review was earned at is the last whole-set read of this checkout", () => {
  assert.equal(wholeReadOf([READ], "/a", RELS).head, "aaaaaaa");
  assert.equal(wholeReadOf([READ], "/b", RELS), null, "another checkout's read answered for this one");
  assert.equal(wholeReadOf([], "/a", RELS), null, "an empty log is an absence, not a stale read");

  const later = { ...READ, id: "c2", at: "2", head: "bbbbbbb" };
  const after = { ...READ, id: "c3", at: "3", head: "ccccccc", send: "diffs" };
  assert.equal(wholeReadOf([READ, later, after], "/a", RELS).head, "bbbbbbb",
    "the last read that qualifies, not the last read of any kind");
});

test("a read that did not cover this set whole answers for no head", () => {
  assert.equal(wholeReadOf([{ ...READ, send: "diffs" }], "/a", RELS), null, "a diff read judges the diff");
  assert.equal(wholeReadOf([{ ...READ, ok: false, reply: null }], "/a", RELS), null, "the consult failed");
  assert.equal(wholeReadOf([{ ...READ, head: undefined }], "/a", RELS), null, "no head to compare with");
  assert.equal(wholeReadOf([{ ...READ, files: ["a.mjs"] }], "/a", RELS), null, "b.mjs was not in the set");
  assert.equal(
    wholeReadOf([{ ...READ, sent: [SENT[0], { rel: "b.mjs", chars: 9, clipped: true }] }], "/a", RELS),
    null, "b.mjs went clipped, so that much of the set is unread",
  );
});

test("a read taken over a working tree answers for no head", () => {
  assert.equal(wholeReadOf([{ ...READ, dirty: true }], "/a", RELS), null);
});

test("a set with no surviving path answers for no head", () => {
  assert.equal(wholeReadOf([READ], "/a", []), null);
});
