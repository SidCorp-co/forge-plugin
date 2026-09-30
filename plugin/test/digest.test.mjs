/* The short key five modules spent as five spellings. Each reader's key is pinned against the
   spelling it held, since a stamp, a plan-scope file and a shown-ledger credit written by the last
   release are read by this one. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempHome } from "./fixtures.mjs";

import { digestOf } from "../src/digest.mjs";

const ROOT = tempHome("digest").path;
process.env.TMPDIR = ROOT;
process.env.XDG_CONFIG_HOME = join(ROOT, "config");

const { askedAlready, stampRoom } = await import("../src/hooks/stamps.mjs");
const { scopePath } = await import("../src/flow/record/plan-scope.mjs");

const was = (input) => createHash("sha1").update(input).digest("hex").slice(0, 16);

test("a text is keyed as the ledger keyed it, and anything else as its string", () => {
  assert.equal(digestOf("the text shown"), was("the text shown"));
  assert.equal(digestOf(""), was(""));
  assert.equal(digestOf(42), was("42"));
  assert.match(digestOf("x"), /^[0-9a-f]{16}$/u);
});

test("bytes are keyed as they are, so two files decoding alike keep two names", () => {
  const one = Buffer.from([0xff, 0x61]);
  const two = Buffer.from([0xfe, 0x61]);
  assert.equal(digestOf(one), was(one), "the code-quality gate's key for a file");
  assert.notEqual(digestOf(one), digestOf(two));
  assert.notEqual(digestOf(one), was(one.toString("utf8")), "and not the key of their decoding");
});

test("a plan-scope file is named as it was, so an entry the last release wrote is still found", () => {
  assert.equal(scopePath("/a/tree", "iss-9").split("/").at(-1), `${was("/a/tree")}-ISS-9.json`);
});

test("a stamp is named as it was, so a gate does not ask again across the release", () => {
  askedAlready({ session_id: "s1" }, "/w/one.md", "learning-gate");
  assert.deepEqual(readdirSync(stampRoom()), [`learning-gate-${was("s1\0/w/one.md")}`]);
});
