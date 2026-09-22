/* The one switch about production, after it moved off the tracker (ISS-2190). Every reader of it
   spends `autoProd`, which is derived once, so what is judged here is the derivation and the three
   readers that would each have needed their own key had it been derived at the caller instead. */
import assert from "node:assert/strict";
import test from "node:test";

import { landingRoute, personOwedForRelease, releaseFrom, waitsForPerson }
  from "../../src/tracker/project-config.mjs";

const NONE = { value: null, from: null };
const PUBLISHES = { baseBranch: "master", releaseModel: "publish" };

/* What `releaseScope` hands `releaseFrom`, spelled here rather than read off a file: this file is
   about what the derivation does with each answer, and the file it came out of is the report's. */
const declared = (value) => ({ value, from: "the project's own record" });
const unset = { value: null, from: "the plugin's default" };
const mistyped = { value: null, from: "the plugin's default", unknown: "manul" };

const policy = (autoProdDeploy, release) =>
  releaseFrom({ ...PUBLISHES, pipelineConfig: { autoProdDeploy } }, release);

test("the project's own key answers the switch, over a tracker flag that says the opposite either way", () => {
  assert.equal(policy(false, declared("auto")).autoProd, true);
  assert.equal(policy(true, declared("manual")).autoProd, false);
  assert.equal(policy(false, declared("auto")).autoProdFrom, "the project's own record",
    "and the level that answered travels with the answer, for the row that prints it");
});

test("a project that declared nothing locally is the project the tracker's flag already described", () => {
  assert.equal(policy(true, unset).autoProd, true, "which is what it read before the key existed");
  assert.equal(policy(false, unset).autoProd, false);
  assert.equal(releaseFrom(PUBLISHES, unset).autoProd, false,
    "and neither level having spoken is the reading that stops rather than the one that ships");
});

/* A word the key does not take falls back with the rest, as every key of that file does: the report
   is where it is named, and the behaviour is the one the project had before the typo. */
test("a word the key does not take leaves the tracker's flag answering, and is carried for the report", () => {
  assert.equal(policy(true, mistyped).autoProd, true);
  assert.match(policy(true, mistyped).autoProdFrom, /holding `manul`, which is no value of it/u);
});

/* The three readers that make this one derivation rather than one key each. Each of them read the
   tracker's flag directly until the move, and none of them is edited by it. */
test("the landing route, the person's look and the closing rung all follow the one derivation", () => {
  assert.equal(landingRoute(policy(false, declared("auto")), NONE).value, "before-merge",
    "a model that moves no ref and deploys on its own means the push IS the deploy");
  assert.equal(landingRoute(policy(true, declared("manual")), NONE).value, "after-merge");
  assert.equal(waitsForPerson(policy(false, declared("auto"))), false,
    "a change that ships without a person's look waits for nobody");
  assert.equal(waitsForPerson(policy(true, declared("manual"))), true);
  assert.equal(personOwedForRelease(policy(false, declared("auto"))), null,
    "and a production that deploys on its own is what takes a person out of the closing rung");
  assert.match(personOwedForRelease(policy(true, declared("manual"))),
    /act on this project's live deploy binding/u);
});
