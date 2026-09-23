/* What a void takes with it and what it leaves. A builder answers a hand-back about that change's
   own paths, so a base that moves without touching them leaves the answer true and the sha it was
   filed under wrong; keying the void to the sha spent a second dispatched run to ask the same
   question again, once per movement of the base (ISS-1636). Every case here is read for whether the
   branch went back, because a landing that carried the reading and one that rebuilt it both release. */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BASE, KEY, OWNED, builderRan, context, forgetInstall, git, landingRan, marks, ready, seeded,
  serverPushes, serverRewrites, sha, tracker, world,
} from "./fixture.mjs";

const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const landing = () => landingOf(context());
const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);
const CARRIED = /is not void with it/u;
const WENT_BACK = /goes back to the run that built it/u;

/** The hand-back and the builder's answer to it, which four of the five cases below start from: the
 *  landing is run for real rather than seeded, so the candidate a case names is one it built. */
const answered = async (work) => {
  await landingRan([KEY], work);
  const handed = landing();
  assert.equal(handed.state, "builder-owed", "the base moved the change's own file, so it goes back");
  const took = await builderRan(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  const wrote = await builderRan(["claim", KEY, "--reconciled", handed.candidate]);
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  return handed.candidate;
};

test("a base that moved none of the change's own paths carries the builder's reading to the rebuilt candidate", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const first = await answered(work);
  const theirs = serverPushes(at, "1.0.5");
  assert.notEqual(theirs, base, "the base moved, over files this change does not own");

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.match(said, CARRIED, said);
  assert.ok(said.includes(first.slice(0, 7)), `the candidate the reading was taken at:\n${said}`);
  assert.ok(said.includes(held.candidate.slice(0, 7)), `and the one it was carried to:\n${said}`);
  assert.notEqual(held.candidate, first, `which is a candidate of the new pin:\n${said}`);
  assert.equal(held.reconciled, held.candidate, `filed under that sha:\n${said}`);
  assert.doesNotMatch(said, WENT_BACK, `and no second dispatch was spent:\n${said}`);
  assert.equal(held.state, "records-owed", said);
  assert.notEqual(remote(at), theirs, `the release landed:\n${said}`);
  assert.equal(marks().length, 1, `one release, one mark:\n${said}`);
});

test("a base that moved the change's own paths again voids the reading and hands the branch back once more", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const first = await answered(work);
  const theirs = serverRewrites(at, "again", (text) =>
    text.replace("line 8\n", "line 8, as a later base moved it\n"));

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.doesNotMatch(said, CARRIED, `the merge resolves those paths differently now:\n${said}`);
  assert.match(said, WENT_BACK, said);
  assert.equal(held.state, "builder-owed", said);
  assert.notEqual(held.candidate, first, `at the candidate this pin makes:\n${said}`);
  assert.equal(held.moved, OWNED, said);
  assert.equal(remote(at), theirs, `and nothing was pushed:\n${said}`);
});

test("a base that put back what it had moved needs no reading at all, carried or fresh", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  await answered(work);
  serverRewrites(at, "undone", (text) =>
    text.replace("line 9, as the base moved it\n", "line 9\n"));

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.doesNotMatch(said, CARRIED, `there is nothing left for a reading to be about:\n${said}`);
  assert.match(said, /landing moved nothing/u, said);
  assert.doesNotMatch(said, WENT_BACK, said);
  assert.equal(held.state, "records-owed", said);
  assert.equal(held.reconciled, held.candidate, `the landing's own reconciliation, not the builder's:\n${said}`);
});

test("a reconciliation the pin it names does not rebuild is void, and the branch goes back", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  /* A reading filed against the judged head rather than against any candidate of `base`: the sha
     this checkout rebuilds from the pin the checkpoint names is not the one the field holds, so
     there is nothing here to vouch for, whatever the paths say. */
  seeded({
    landing: ready(head, base, {
      state: "reconciled", pinned: base, candidate: head, reconciled: head, moved: OWNED,
    }),
  });
  forgetInstall();
  const theirs = serverPushes(at, "1.0.5");

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.doesNotMatch(said, CARRIED, said);
  assert.match(said, WENT_BACK, said);
  assert.equal(held.state, "builder-owed", said);
  assert.equal(remote(at), theirs, `and nothing was pushed:\n${said}`);
});

test("the judge's turn and the deployment it was spent on go with the pin, and the builder's reading does not", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const first = await answered(work);
  /* The same checkpoint one route further on: a candidate that was judged, at the sha the judgement
     names. Those two are readings of the whole tree, which a moved base changes whatever this
     change's own paths do. */
  seeded({
    landing: ready(head, base, {
      state: "judged", pinned: base, candidate: first, reconciled: first, moved: OWNED,
      deployment: first, judge: "the-qa-run",
    }),
  });
  serverPushes(at, "1.0.5");

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.match(said, CARRIED, said);
  assert.equal(held.reconciled, held.candidate, `the reading is carried:\n${said}`);
  assert.equal(held.deployment, undefined, `the deployment is not:\n${said}`);
  assert.equal(held.judge, undefined, `nor the judge's turn:\n${said}`);
  assert.equal(held.state, "records-owed", said);
});

test("a base that moves after the gate has run costs the retry no builder dispatch", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base) });
  forgetInstall();
  const first = await answered(work);
  const theirs = serverPushes(at, "1.0.5");
  /* Where a landing dies between its version commit and its push, holding a builder's reading: the
     push step finds the base past its pin and voids there rather than at the pin step. */
  seeded({
    landing: ready(head, base, {
      state: "promoting", pinned: base, candidate: first, reconciled: first, moved: OWNED,
      intended: head, release: "1.0.1",
    }),
  });

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.ok(said.includes(`is at ${theirs.slice(0, 7)}`), said);
  assert.match(said, CARRIED, said);
  assert.doesNotMatch(said, WENT_BACK, `the reading came through the retry:\n${said}`);
  assert.equal(held.state, "records-owed", said);
  assert.equal(held.reconciled, held.candidate, said);
  assert.equal(git(work, "merge-base", "--is-ancestor", theirs, remote(at)).status, 0,
    `on top of the release this landing pinned past:\n${said}`);
});
