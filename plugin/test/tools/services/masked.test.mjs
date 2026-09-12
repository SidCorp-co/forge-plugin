/* One function shows a credential's shape and one shows an identifier's, and the scheme strip is the
   whole of the difference between them (ISS-951). What each call is showing is the thing under test:
   a call reaching for the wrong one of these is what the naming exists to make visible. */
import assert from "node:assert/strict";
import test from "node:test";

import { masked, abbreviated } from "../../../src/tools/services/masked.mjs";

const TOKEN = "Bearer abcdefghijklmnopqrstuvwxyz";
const IDENTIFIER = "abcdefghijklmnopqrstuvwxyz1234567";

test("a token written with its scheme and an identifier of the same length are counted differently, and only one loses a prefix", () => {
  assert.equal(TOKEN.length, IDENTIFIER.length, "the two differ in what they are, not in how long they are");
  assert.equal(masked(TOKEN, false), "set (26 chars)", "the seven characters of `Bearer ` are not the credential");
  assert.equal(abbreviated(IDENTIFIER, false), "set (33 chars)", "an identifier has no scheme to take off");
  assert.equal(masked(TOKEN, true), "abcdef…wxyz (26 chars)", "the head is the token's own, never `Bearer`");
  assert.equal(abbreviated(IDENTIFIER, true), "abcdef…4567 (33 chars)");
});

test("a value short enough that a head and a tail would be most of it says only that it is set", () => {
  assert.equal(abbreviated("123456789012", true), "set", "twelve is inside the boundary");
  assert.equal(abbreviated("1234567890123", true), "123456…0123 (13 chars)", "thirteen is past it");
  assert.equal(masked("Bearer 123456789012", true), "set", "the boundary is read after the scheme comes off");
});

test("a token carrying no scheme is untouched by the strip", () => {
  assert.equal(masked(IDENTIFIER, false), abbreviated(IDENTIFIER, false));
  assert.equal(masked(IDENTIFIER, true), abbreviated(IDENTIFIER, true));
});
