/* The landing fixture's own setup under a git that fails. Its calls were read whatever they answered,
   so a commit refused under a quota several gates shared left a sha empty, and the landing under test
   said `not a valid object name` with nothing after it (ISS-2788). Each helper that builds the world
   stops at the call that failed instead. */
import assert from "node:assert/strict";
import test from "node:test";

import { BASE, serverPushes, serverRewrites, sha, state, tracker, world } from "./fixture.mjs";
import { gitFailing, noted } from "../room-refusals.mjs";

test.after(() => tracker.close());
/* These cases build the world a landing runs in and land nothing, so no route asks the tracker. */
state.unasked = ["forge_config", "forge_issues", "forge_comments"];

const QUOTA = "error: unable to write file .git/objects/ab/cdef: Disk quota exceeded";

const stoppedAt = (command) => (error) => {
  assert.match(error.message, new RegExp(`the room this case stands on was not built: ${command} in `, "u"), error.message);
  assert.match(error.message, /fatal: told to fail/u, `git's own output was not quoted:\n${error.message}`);
  return true;
};

test("a world whose first commit fails stops at that commit", () => {
  assert.throws(() => gitFailing("commit", "fatal: told to fail", () => world()),
    stoppedAt("git commit -qm the tree this landing starts from"));
});

test("a world whose commit is refused on a spent room throws the room refusal", () => {
  noted(() => assert.throws(() => gitFailing("commit", QUOTA, () => world()), (error) => {
    assert.match(error.message, /Could not make the temporary room at .*: EDQUOT$/mu, error.message);
    return true;
  }));
});

test("another clone's release whose push fails stops at that push", () => {
  const { at } = world();
  assert.throws(() => gitFailing("push", "fatal: told to fail", () => serverPushes(at, "1.0.1")),
    stoppedAt(`git push -q origin HEAD:${BASE}`));
});

test("another clone's rewrite whose clone fails stops at that clone", () => {
  const { at } = world();
  assert.throws(() => gitFailing("clone", "fatal: told to fail", () => serverRewrites(at, "gone", (text) => text)),
    stoppedAt("git clone"));
});

test("a sha that names no commit is refused at the read rather than handed on empty", () => {
  const { work } = world();
  assert.throws(() => sha(work, "refs/heads/no-such-branch"), (error) => {
    assert.match(error.message, /git rev-parse refs\/heads\/no-such-branch in .* named no commit/u, error.message);
    return true;
  });
});
