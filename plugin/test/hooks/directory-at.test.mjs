/* The one reading of which directory a command start stands in, which every gate asking it spends
   rather than composing `movedTo`, the sentinel and a `resolve` of its own (ISS-1455). Two copies of
   that composition had already drifted: one carried the sentinel out, the other nulled it. */
import assert from "node:assert/strict";
import test from "node:test";

import { NOWHERE, directoryAt } from "../../src/hooks/shell-spans.mjs";

const at = (text, word) => text.indexOf(word);

test("a compound command crossing checkouts stands in each checkout at its own command start", () => {
  const text = "cd /a && forge advance ISS-1; cd /b && forge advance ISS-2";
  assert.equal(directoryAt(text, at(text, "forge advance ISS-1"), "/cwd"), "/a");
  assert.equal(directoryAt(text, at(text, "forge advance ISS-2"), "/cwd"), "/b");
  assert.equal(directoryAt(text, 0, "/cwd"), "/cwd", "the first start, before any move, is the base");
});

test("a relative move is placed against the base, and without one comes back as the text spells it", () => {
  const text = "cd sub && forge advance ISS-1";
  assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), "/cwd/sub");
  assert.equal(directoryAt(text, at(text, "forge")), "sub", "a caller placing it later gets it unplaced");
  assert.equal(directoryAt("forge advance ISS-1", 0), null, "and no move at all is no directory of its own");
});

test("a destination the text does not carry is NOWHERE, whatever base is given", () => {
  for (const text of ["cd - && forge advance ISS-1", "cd && forge advance ISS-1", "cd \"$X\" && forge advance ISS-1"]) {
    assert.equal(directoryAt(text, at(text, "forge"), "/cwd"), NOWHERE, text);
    assert.equal(directoryAt(text, at(text, "forge")), NOWHERE, `${text}, with no base`);
  }
});
