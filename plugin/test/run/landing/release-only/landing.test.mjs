/* A change that edits a file a release writes its number into, landed across a release: what the
   base moved there is the release's version field and nothing a builder wrote, so the chain carries
   the change and the mark lets its verdicts stand. A base that moved any other field of that file is
   an edit, and the branch still goes back to its builder (ISS-2516). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  BASE, BRANCH, KEY, OWNED, context, forgetInstall, git, landingRan, marks, ready, seeded,
  serverPushes, sha, tracker, world,
} from "../fixture.mjs";

const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");
const { RELEASE_FILES, releaseOnly } = await import("../../../../../tools/run/landing.mjs");

test.after(() => tracker.close());

const MANIFEST = "package.json";
const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);
const landing = () => landingOf(context());

/** The change on the branch writes a field of the manifest the release never writes. */
const editsManifest = (work) => {
  git(work, "checkout", "-q", BRANCH);
  const held = JSON.parse(readFileSync(join(work, MANIFEST), "utf8"));
  writeFileSync(join(work, MANIFEST), JSON.stringify({ ...held, description: "the change's own field" }, null, 2));
  git(work, "add", MANIFEST);
  git(work, "commit", "-qm", "the change writes the manifest too");
  git(work, "push", "-q", "origin", BRANCH);
  git(work, "checkout", "-q", BASE);
  return sha(work, BRANCH);
};

/** Another clone's commit that moves the manifest's name as well as its version: an edit, not a release. */
const serverEdits = (at, version) => {
  const clone = join(at, `clone-edit-${version}`);
  spawnSync("git", ["clone", "-q", join(at, "origin.git"), clone], { cwd: dirname(clone), encoding: "utf8" });
  const held = JSON.parse(readFileSync(join(clone, MANIFEST), "utf8"));
  writeFileSync(join(clone, MANIFEST), JSON.stringify({ ...held, name: "renamed", version }, null, 2));
  git(clone, "add", MANIFEST);
  git(clone, "commit", "-qm", `another clone renames the package at ${version}`);
  git(clone, "push", "-q", "origin", `HEAD:${BASE}`);
  return sha(clone, "HEAD");
};

test("a base that moved the change's manifest only by a release's version carries the change into the release", async () => {
  const { at, work, base } = world();
  const head = editsManifest(work);
  seeded({ landing: ready(head, base, { files: [OWNED, MANIFEST] }) });
  forgetInstall();
  const theirs = serverPushes(at, "1.0.5");

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.notEqual(held.state, "builder-owed", `the release's version is no move of the change:\n${said}`);
  assert.equal(held.moved, undefined, `and nothing was recorded as moved:\n${said}`);
  assert.match(said, new RegExp(`${MANIFEST} moved between ${head.slice(0, 7)} and [0-9a-f]{7} only in the version fields a release writes`, "u"), said);
  const landed = remote(at);
  assert.notEqual(landed, theirs, `the release landed:\n${said}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", head, landed).status, 0, `carrying the judged head:\n${said}`);
  const shipped = JSON.parse(git(work, "show", `${landed}:${MANIFEST}`).stdout);
  assert.equal(shipped.description, "the change's own field", `the change's field is in what landed:\n${said}`);
  assert.equal(shipped.version, "1.0.6", `above the release the base carried:\n${said}`);
});

test("the mark over a release-only move says the landing moved nothing, so the judged head's verdicts stand", async () => {
  const { at, work, base } = world();
  const head = editsManifest(work);
  seeded({ landing: ready(head, base, { files: [OWNED, MANIFEST] }) });
  forgetInstall();
  serverPushes(at, "1.0.5");

  const said = await landingRan([KEY], work);
  assert.equal(marks().length, 1, `one mark:\n${said}`);
  const note = marks()[0].body;
  assert.match(note, /landing moved nothing;/u, note);
  assert.ok(note.includes(`judged head ${head}`), note);
});

test("the release commit a landing makes differs from its parent only in the declared version fields", async () => {
  const { at, work, base } = world();
  const head = editsManifest(work);
  seeded({ landing: ready(head, base, { files: [OWNED, MANIFEST] }) });
  forgetInstall();
  serverPushes(at, "1.0.5");

  const said = await landingRan([KEY], work);
  const landed = remote(at);
  const touched = git(work, "diff", "--name-only", `${landed}^`, landed).stdout.split("\n").filter(Boolean);
  assert.ok(touched.length > 0, `the release wrote something:\n${said}`);
  for (const path of touched) {
    assert.ok(RELEASE_FILES.includes(path), `${path} is a file the declaration names:\n${said}`);
    assert.ok(releaseOnly(work, `${landed}^`, landed, path), `${path} moved in no undeclared field:\n${said}`);
  }
});

test("a base that moved another field of the change's manifest still hands the branch back, naming it", async () => {
  const { at, work, base } = world();
  const head = editsManifest(work);
  seeded({ landing: ready(head, base, { files: [OWNED, MANIFEST] }) });
  forgetInstall();
  const theirs = serverEdits(at, "1.0.5");

  const said = await landingRan([KEY], work);
  const held = landing();
  assert.equal(held.state, "builder-owed", said);
  assert.equal(held.moved, MANIFEST, said);
  assert.match(said, new RegExp(`the landing moved ${MANIFEST}, so this change's own paths are not what was judged`, "u"), said);
  assert.doesNotMatch(said, /only in the version fields a release writes/u, said);
  assert.equal(remote(at), theirs, `nothing was pushed:\n${said}`);
});
