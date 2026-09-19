import { test } from "node:test";
import assert from "node:assert/strict";
import { NAMED, SAID_CHARS, failuresIn, failuresSaid } from "../../src/codex/check-output.mjs";
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

test("output that is not TAP names no failing case, so what the reviewer is handed is unchanged", () => {
  assert.deepEqual(failuresIn("make: *** [all] Error 2\nFAILED 1 of 3\n"), []);
  assert.equal(failuresSaid("make: *** [all] Error 2\nFAILED 1 of 3\n"), null);
  assert.equal(failuresSaid(""), null);
  assert.equal(failuresSaid(undefined), null);
});

test("more failures than the bound are cut to it, and the block says how many it did not name", () => {
  const over = 3;
  const lines = Array.from({ length: NAMED + over }, (nothing, at) =>
    `not ok ${at + 1} - case number ${at + 1}`).join("\n");
  const said = failuresSaid(`TAP version 13\n${lines}\n1..${NAMED + over}\n`);
  assert.match(said, new RegExp(`^${NAMED + over} failing case\\(s\\) its output named, the first ${NAMED} of them, ${over} not named:$`, "mu"));
  assert.equal(said.split("\n").length, NAMED + 1, "one line of head and one per named case");
  assert.ok(!said.includes(`case number ${NAMED + 1}`), "and the ones past the bound are not in it");
});

test("a field longer than the bound is cut to it", () => {
  const long = "x".repeat(SAID_CHARS * 2);
  const { out } = tapOf(`test("the long one", () => { throw new Error("${long}"); });\n`);
  assert.equal(fieldOf(failuresIn(out)[0], "error").length, SAID_CHARS);
});
