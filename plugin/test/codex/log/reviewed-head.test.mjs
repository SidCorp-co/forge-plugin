/* Which head a review was earned at, in its own file because the log's other questions fill one. The
   ship refuses a branch rewritten since that head (ISS-972) past a step with no flag through it, so
   a head off some other read refuses a run that did nothing wrong: every absence answers null, an
   absent read and a stale one being obliged not to read alike. The empty set is the absence this
   reader owns rather than the recheck's shared `shortOfWhole`; a `dirty` read it answers, the ship
   ruling on what a working tree makes of a head. */
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

test("a read taken over a working tree is answered, dirty and all", () => {
  const wet = wholeReadOf([{ ...READ, dirty: true }], "/a", RELS);
  assert.equal(wet.head, "aaaaaaa");
  assert.equal(wet.dirty, true, "the caller cannot rule on a working tree it is not told about");
  assert.equal(wholeReadOf([{ ...READ, dirty: true }, READ], "/a", RELS).dirty, undefined,
    "a clean read after it is still the last that qualifies");
});

test("a set with no surviving path answers for no head", () => {
  assert.equal(wholeReadOf([READ], "/a", []), null);
});

/* A set over the bundle cap is read across several passes, so the question the ship asks has to be
   answerable by a sequence. One writing run and one head is what makes it a sequence somebody took
   rather than two consults that happened to overlap, and a working tree breaks the head's promise
   that each pass saw the same bytes. */
const PASS = { ...READ, run: "r1", files: ["a.mjs"], sent: [SENT[0]] };
const REST = { ...PASS, id: "c2", at: "2", files: ["b.mjs"], sent: [SENT[1]] };

test("one run's passes at one clean head are together the read the review was earned by", () => {
  const found = wholeReadOf([PASS, REST], "/a", RELS);
  assert.equal(found.head, "aaaaaaa");
  assert.equal(found.covering, 2, "the answer does not say how many passes it took");
  assert.equal(found.id, "c2", "the newest pass of the sequence is not the one answered with");
  assert.equal(wholeReadOf([PASS], "/a", RELS), null, "one pass of two covered the set on its own");
});

test("a pass of one is answered as before, and says nothing about a sequence", () => {
  assert.equal(wholeReadOf([READ], "/a", RELS).covering, undefined,
    "a single whole-set read was reported as a sequence");
  assert.equal(wholeReadOf([{ ...READ, run: undefined }], "/a", RELS).head, "aaaaaaa",
    "an entry from before runs were recorded stopped answering");
});

test("passes that are no one sequence do not combine", () => {
  assert.equal(wholeReadOf([PASS, { ...REST, head: "bbbbbbb" }], "/a", RELS), null,
    "two heads were read as one snapshot");
  assert.equal(wholeReadOf([PASS, { ...REST, run: "r2" }], "/a", RELS), null,
    "two runs' unrelated passes were taken for one declared sequence");
  assert.equal(wholeReadOf([{ ...PASS, dirty: true }, { ...REST, dirty: true }], "/a", RELS), null,
    "a shared head pinned no shared bytes, the tree being dirty at each pass");
  assert.equal(wholeReadOf([{ ...PASS, run: undefined }, { ...REST, run: undefined }], "/a", RELS), null,
    "entries naming no run were combined, which no run declared");
  assert.equal(wholeReadOf([PASS, { ...REST, send: "diffs" }], "/a", RELS), null,
    "a diffs pass carried a body into the cover");
});

test("a whole read later than a sequence is the one answered with, and the other way round", () => {
  const whole = { ...READ, id: "c9", at: "9", head: "ddddddd" };
  assert.equal(wholeReadOf([PASS, REST, whole], "/a", RELS).id, "c9", "the sequence outranked a later read");
  assert.equal(wholeReadOf([whole, { ...PASS, at: "10" }, { ...REST, at: "11" }], "/a", RELS).covering, 2,
    "an earlier whole read outranked the sequence taken after it");
});
