/* Which `blocked` park is a landing's own conflict park, and which is a person's or the triage's
   that only happens to share its kind or its words: text alone is not proof, so what settles it is
   the checkpoint's own head, which nobody composing a park by hand is holding (ISS-2832). */
import assert from "node:assert/strict";
import test from "node:test";

import { CONFLICT_MARK, CONFLICT_PARK_KIND, isConflictPark } from "../../../src/flow/landing/conflict-park.mjs";

const HEAD = "9e24c2af0000000000000000000000000000abcd";
const PIN = "c4890050000000000000000000000000000dcba";
const OTHER = "1111111000000000000000000000000000002222";

const why = (tail = "") => `iss-673 does not merge onto master at 9e24c2a: plugin/src/one.mjs conflict. `
  + `${CONFLICT_MARK}${tail}`;

test("the landing's own conflict park is the kind, the phrase and the checkpoint's own head, all three", () => {
  const fields = { kind: CONFLICT_PARK_KIND, why: why(), evidence: [HEAD, PIN] };
  assert.equal(isConflictPark(fields, HEAD), true);
});

test("the evidence naming the pin alone, not the head, still pairs — either commit answers for it", () => {
  const fields = { kind: CONFLICT_PARK_KIND, why: why(), evidence: [PIN, HEAD] };
  assert.equal(isConflictPark(fields, HEAD), true, "the head is the second entry here and still matches");
});

test("a park whose reason carries the phrase but whose evidence names another head is not the landing's", () => {
  const fields = { kind: CONFLICT_PARK_KIND, why: why(), evidence: [OTHER, PIN] };
  assert.equal(isConflictPark(fields, HEAD), false,
    "the phrase alone is free text a person's own park could carry too; only the head is proof");
});

test("a park of any other kind is never the landing's conflict park, evidence or no", () => {
  const fields = { kind: "unshippable", why: why(), evidence: [HEAD, PIN] };
  assert.equal(isConflictPark(fields, HEAD), false);
});

test("a blocked park whose reason carries none of the phrase is not the landing's, evidence or no", () => {
  const fields = { kind: CONFLICT_PARK_KIND, why: "the triage rules the expectation not in the specification", evidence: [HEAD, PIN] };
  assert.equal(isConflictPark(fields, HEAD), false);
});

test("no record at all, or none of its fields, answers false rather than throwing", () => {
  assert.equal(isConflictPark(null, HEAD), false);
  assert.equal(isConflictPark({ kind: CONFLICT_PARK_KIND, why: why() }, HEAD), false, "no evidence array at all");
});
