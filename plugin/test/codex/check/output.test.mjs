import { test } from "node:test";
import assert from "node:assert/strict";
import { FAILED_CHARS, NAMED, SAID_CHARS, failuresIn, failuresSaid } from "../../../src/codex/check/output.mjs";
import { tapOf } from "./tap-of.mjs";

const named = (found, name) => found.find((one) => one.name === name);
const fieldOf = (one, key) => Object.fromEntries(one.fields)[key];

test("a failing case is named with the location and the assertion its own diagnostic carried", () => {
  const { out, file } = tapOf(`test("the one that fails", () => { throw new Error("nine is not ten"); });
test("the one that passes", () => {});
`);
  const found = failuresIn(out);
  assert.deepEqual(found.map((one) => one.name), ["the one that fails"], "the passing case is not a failure");
  assert.equal(fieldOf(found[0], "location"), `${file}:2:1`);
  assert.equal(fieldOf(found[0], "error"), "nine is not ten");
  assert.equal(fieldOf(found[0], "failureType"), "testCodeFailure");
  assert.equal(fieldOf(found[0], "stack"), undefined, "the stack is not carried: the location already places it");
});

/* The one red this issue was filed over would have read as this. The sentence comes from the
   fixture's own refusal, so a reviewer handed it can say the box refused rather than the tree. */
test("a case that failed because the machine refused it a room is named with that sentence", () => {
  const { out } = tapOf(`test("a room the machine refused", () => {
  throw new Error("Could not make the temporary room at /tmp/x: EDQUOT\\nThis is the machine refusing the room, not the tree under test being wrong.");
});
`);
  const said = failuresSaid(out);
  assert.match(said, /^1 failing case\(s\) its output named:\n {2}a room the machine refused$/mu);
  assert.match(said, /error: Could not make the temporary room at \/tmp\/x: EDQUOT This is the machine refusing the room/u);
});

test("a nested failure and the case above it are both named, each at its own indent", () => {
  const { out } = tapOf(`test("the outer case", async (t) => {
  await t.test("the inner leaf", () => { throw new Error("the leaf went red"); });
});
`);
  const found = failuresIn(out);
  assert.deepEqual(found.map((one) => one.name), ["the inner leaf", "the outer case"]);
  assert.equal(fieldOf(named(found, "the inner leaf"), "error"), "the leaf went red");
  assert.equal(fieldOf(named(found, "the outer case"), "failureType"), "subtestsFailed");
});

/* A stack frame reads `at: …` and an assertion may quote `error: …`; both sit inside a block scalar
   at a deeper indent than the diagnostic's own keys, and reading either as a field renames the case. */
test("a key inside a block scalar is that scalar's text and not a field of the case", () => {
  const { out } = tapOf(`test("the quoting case", () => {
  throw new Error("location: nowhere\\nerror: none\\nfailureType: invented");
});
`);
  const [one] = failuresIn(out);
  assert.equal(fieldOf(one, "error"), "location: nowhere error: none failureType: invented");
  assert.match(fieldOf(one, "location"), /s\.test\.mjs:2:1$/u, "the case's own location, not the one it quoted");
  assert.equal(fieldOf(one, "failureType"), "testCodeFailure");
});

test("a failure the output named with no diagnostic at all is still named, and carries no field", () => {
  const bare = failuresIn("TAP version 13\nnot ok 1 - the case a runner named and said nothing about\n1..1\n");
  assert.deepEqual(bare, [{ name: "the case a runner named and said nothing about", fields: [] }]);
});

test("a case TAP marked as not expected to pass is not a failure", () => {
  assert.deepEqual(failuresIn("TAP version 13\nnot ok 1 - the one still to write # TODO\n1..1\n"), []);
  assert.equal(failuresSaid("TAP version 13\nnot ok 1 - the one not run here # SKIP\n1..1\n"), null);
});

/* A case that is not a failure still has a diagnostic, and the scan has to be past it either way:
   left to the loop, every line of that block is a test point this would read. */
test("the diagnostic under a case that is not a failure is not scanned for cases of its own", () => {
  const skipped = "TAP version 13\nnot ok 1 - the one still to write # TODO\n  ---\n  error: |-\n    not ok 2 - a case nothing ran\n  ...\nnot ok 3 - the one that really failed\n1..3\n";
  assert.deepEqual(failuresIn(skipped).map((one) => one.name), ["the one that really failed"]);
});

// Assume the indent and the search for a delimiter that is not there eats the rest of the stream.
test("a diagnostic indented deeper than its case does not swallow the failures under it", () => {
  const deep = "TAP version 13\nnot ok 1 - pending # TODO\n    ---\n    error: 'pending'\n    ...\nnot ok 2 - the one that really failed\n1..2\n";
  assert.deepEqual(failuresIn(deep).map((one) => one.name), ["the one that really failed"]);
});

// This check prints four thousand passing diagnostics, any of which may quote a test point.
test("the diagnostic under a passing case is consumed, so nothing it quotes becomes a case", () => {
  const quoted = "TAP version 13\nok 1 - the one that passed\n  ---\n  error: |-\n    not ok 2 - a case nothing ran\n  ...\nnot ok 3 - the one that failed\n1..3\n";
  assert.deepEqual(failuresIn(quoted).map((one) => one.name), ["the one that failed"]);
});

test("a block whose diagnostic never closes ends at the first line no deeper than its case", () => {
  const torn = "TAP version 13\nnot ok 1 - the one whose block was cut off\n  ---\n  error: 'the assertion'\nnot ok 2 - the one after it\n1..2\n";
  const found = failuresIn(torn);
  assert.deepEqual(found.map((one) => one.name), ["the one whose block was cut off", "the one after it"]);
  assert.deepEqual(found[0].fields, [["error", "the assertion"]]);
});

// A producer on another platform ends its lines with a carriage return, and its failures still are.
test("a stream whose lines end the other way is read the same", () => {
  const crlf = "TAP version 13\r\nnot ok 1 - the one that failed\r\n  ---\r\n  error: 'the assertion'\r\n  ...\r\nnot ok 2 - the one after it\r\n1..2\r\n";
  const found = failuresIn(crlf);
  assert.deepEqual(found.map((one) => one.name), ["the one that failed", "the one after it"]);
  assert.deepEqual(found[0].fields, [["error", "the assertion"]]);
});

test("output that is not TAP names no failing case, so what the reviewer is handed is unchanged", () => {
  assert.deepEqual(failuresIn("make: *** [all] Error 2\nFAILED 1 of 3\n"), []);
  assert.equal(failuresSaid("make: *** [all] Error 2\nFAILED 1 of 3\n"), null);
  assert.equal(failuresSaid(""), null);
  assert.equal(failuresSaid(undefined), null);
});

/* A line of the shape is not a stream in the format, and the one thing promised of output this
   cannot read is that it comes back exactly as it did before. */
test("a stream that never says it is TAP names no failing case, whatever a line of it looks like", () => {
  assert.deepEqual(failuresIn("deploying\nnot ok - database unavailable\ngiving up\n"), []);
  assert.deepEqual(failuresIn("TAP version 13\nnot ok - database unavailable\n").map((one) => one.name),
    ["database unavailable"], "and the same line inside a stream that does say so is a failure");
  assert.deepEqual(failuresIn("not ok - database unavailable\n1..1\n").map((one) => one.name),
    ["database unavailable"], "a plan says it too, which is all the older version ever had");
});

// The plan a stream that gives up would have ended with never arrives; its own word for it does.
test("a stream that bails out before its plan is still TAP, and what it named before that stands", () => {
  const bailed = "not ok 1 - database setup\nBail out! database unavailable\n";
  assert.deepEqual(failuresIn(bailed).map((one) => one.name), ["database setup"]);
});

// Nothing separates the description from the directive where the description is the directive.
test("a case excused with no description of its own is still not a failure", () => {
  assert.deepEqual(failuresIn("TAP version 13\nnot ok 1 # TODO\nnot ok 2 - the one that failed\n1..2\n")
    .map((one) => one.name), ["the one that failed"]);
});

test("more failures than the bound are cut to it, and the block says how many it did not name", () => {
  const over = 3;
  const lines = Array.from({ length: NAMED + over }, (nothing, at) =>
    `not ok ${at + 1} - case number ${at + 1}`).join("\n");
  const said = failuresSaid(`TAP version 13\n${lines}\n1..${NAMED + over}\n`);
  assert.equal(said.split("\n")[0],
    `${NAMED + over} failing case(s) its output named, the first ${NAMED} of them, ${over} not named:`);
  assert.equal(said.split("\n").length, NAMED + 1, "one line of head and one per named case");
  assert.ok(!said.includes(`case number ${NAMED + 1}`), "and the ones past the bound are not in it");
});

test("a field longer than the bound is cut to it, and says it was", () => {
  const long = "x".repeat(SAID_CHARS * 2);
  const { out } = tapOf(`test("the long one", () => { throw new Error("${long}"); });\n`);
  const error = fieldOf(failuresIn(out)[0], "error");
  assert.equal(error.length, SAID_CHARS);
  assert.ok(error.endsWith("…"), "and the cut is marked rather than left to look like the whole of it");
});

/* Nothing above the tail may be unbounded, and a name is not a field: a case named from a large
   input can be longer than every diagnostic on the page put together. */
test("a case name longer than the bound is cut to it as a field is", () => {
  const { out } = tapOf(`test("${"n".repeat(SAID_CHARS * 400)}", () => { throw new Error("red"); });\n`);
  const [one] = failuresIn(out);
  assert.equal(one.name.length, SAID_CHARS);
  assert.ok(one.name.startsWith("nnnn") && one.name.endsWith("…"));
  assert.ok(failuresSaid(out).length < SAID_CHARS * 4, "so the block above the tail stays bounded");
});

/* A bound on the count and on each value leaves the block unbounded: one case's fields are however
   many the diagnostic repeats, and the block is meant never to cost more than the tail below it. */
test("the block above the tail is never longer than the tail, whatever the output named", () => {
  const long = "e".repeat(SAID_CHARS * 2);
  const one = (at) => `not ok ${at} - case ${at}\n  ---\n  location: 'a.test.mjs:${at}:1'\n  error: |-\n    ${long}\n  ...`;
  const many = Array.from({ length: NAMED * 2 }, (nothing, at) => one(at + 1)).join("\n");
  const said = failuresSaid(`TAP version 13\n${many}\n1..${NAMED * 2}\n`);
  assert.ok(said.length <= FAILED_CHARS, "the block is held to its own bound, the count leading it included");
  assert.match(said, /^40 failing case\(s\) its output named, the first \d+ of them, \d+ not named:$/mu);
  assert.ok(said.split("\n")[0].startsWith("40 failing case(s) its output named, the first 1"),
    "the count cut by the block's own bound, below the count the case bound would have allowed");
});

test("a key a diagnostic repeats is carried once, at the value it first gave", () => {
  const twice = "TAP version 13\nnot ok 1 - the one that says it twice\n  ---\n  error: 'the first answer'\n  error: 'the second answer'\n  ...\n1..1\n";
  assert.deepEqual(failuresIn(twice)[0].fields, [["error", "the first answer"]]);
});

/* A diagnostic ends at its own indent and nowhere else. Read a `...` inside an assertion as the end
   and the scan resumes in the middle of that assertion, where a quoted `not ok` is a case nothing
   ever ran and the count the reviewer reads is wrong in both directions. */
test("a line of three dots inside an assertion is that assertion's text, not the end of its diagnostic", () => {
  const { out } = tapOf(`test("the one that quotes a terminator", () => {
  throw new Error("before\\n...\\nnot ok 9 - a case nothing ran\\nafter");
});
`);
  const found = failuresIn(out);
  assert.deepEqual(found.map((one) => one.name), ["the one that quotes a terminator"]);
  assert.equal(fieldOf(found[0], "error"), "before ... not ok 9 - a case nothing ran after");
});

/* The decision was to read TAP, and TAP makes the number and the dash optional; reading only node's
   spelling of it would hand back an unattributable red for every other producer of the format. */
test("a test point TAP spells without a number or a dash is a failure all the same", () => {
  const spellings = ["not ok 1 - with both", "not ok - without a number", "not ok 2 without a dash", "not ok"];
  assert.deepEqual(failuresIn(`TAP version 13\n${spellings.join("\n")}\n1..4\n`).map((one) => one.name),
    ["with both", "without a number", "without a dash", ""]);
  assert.deepEqual(failuresIn("TAP version 13\nnot okay 1 - a word that merely opens with it\n1..1\n"), [],
    "and a word that only begins that way is not a test point");
});
