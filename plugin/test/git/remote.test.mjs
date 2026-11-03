/* remoteFor picks the remote a landing reads a branch's head from. It is the branch's own tracked
   remote, not an assumed origin, so a project pushing through a relay is read where its branches
   live (ISS-31). */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { git, tempRoom } from "../fixtures.mjs";
import { remoteFor } from "../../src/git/remote.mjs";

/** A repo on branch `main` whose upstream remote is named `relay`, not `origin`. */
const repoTrackingRelay = () => {
  const room = tempRoom("remote-");
  const relay = join(room, "relay.git");
  const main = join(room, "main");
  git(room, "init", "-q", "--bare", "-b", "main", relay);
  git(room, "init", "-q", "-b", "main", main);
  git(main, "config", "user.email", "t@t");
  git(main, "config", "user.name", "t");
  git(main, "commit", "-q", "--allow-empty", "-m", "base");
  git(main, "remote", "add", "relay", relay);
  git(main, "push", "-q", "-u", "relay", "main");
  return main;
};

test("the branch's tracked remote is read, not origin (ISS-31)", () => {
  const main = repoTrackingRelay();
  assert.equal(remoteFor("main", { cwd: main }), "relay");
});

test("a branch tracking nothing falls back to origin", () => {
  const main = repoTrackingRelay();
  git(main, "checkout", "-q", "-b", "untracked");
  assert.equal(remoteFor("untracked", { cwd: main }), "origin");
});

test("no branch falls back to origin", () => {
  const main = repoTrackingRelay();
  assert.equal(remoteFor(null, { cwd: main }), "origin");
});
