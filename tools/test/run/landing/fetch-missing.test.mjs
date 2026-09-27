/* A landing whose fetch fails reads why from the remote's own listing of its branches, so a branch
   the remote lacks is named with the push that clears it, and a remote that does not answer still
   reads as unreachable (ISS-2663). */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BRANCH, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_UUID, NEXT_OWNED,
  context, git, landingRan, ready, seeded, tracker, world,
} from "./fixture.mjs";

const { landingOf } = await import("../../../../plugin/src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const pair = (head, next, base) => seeded({
  landing: ready(head, base),
  next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
});

test("a member branch the remote lacks is named with its push and its capture, and the other member is not", async () => {
  const { work, head, next, base } = world({ base: "other", second: true });
  pair(head, next, base);
  git(work, "push", "-q", "origin", "--delete", NEXT_BRANCH);
  const said = await landingRan([KEY, NEXT_KEY], work);
  assert.match(said, new RegExp(`origin holds no branch ${NEXT_BRANCH}, which the checkpoint on ${NEXT_KEY} names`, "u"), said);
  assert.match(said, new RegExp(`git push -u origin ${NEXT_BRANCH}\\n\\s+forge claim ${NEXT_KEY} --pushed --ready`, "u"), said);
  assert.doesNotMatch(said, new RegExp(`holds no branch ${BRANCH}\\b`, "u"), said);
  assert.doesNotMatch(said, /Check the remote is reachable/u, said);
  assert.equal(landingOf(context(NEXT_UUID)).state, "ready", `nothing of it moved:\n${said}`);
});

test("a remote that does not answer still reads as unreachable and names no branch as missing", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  pair(head, next, base);
  git(work, "remote", "set-url", "origin", join(at, "gone.git"));
  const said = await landingRan([KEY, NEXT_KEY], work);
  assert.match(said, /Check the remote is reachable\./u, said);
  assert.doesNotMatch(said, /holds no branch/u, said);
});
