/* One member of a batch named, and the batch landed: a batch tree is one branch and one head for every
   key its run id names, so a landing handed one of them takes the siblings whose own records agree,
   and names every sibling it leaves with why (ISS-2656). */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_UUID, OWNED, UUID,
  context, git, issue, landingRan, marks, ready, seeded, sha, tracker, world,
} from "./fixture.mjs";

const { landingOf } = await import("../../../../plugin/src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const BATCH = `${KEY}, ${NEXT_KEY}`;
const landing = (documentId) => landingOf(context(documentId));
const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);

/** Both issues on the record as a batch tree leaves them: each worklog naming `batches[i]`, and the
 *  sibling's plan naming the file the shared head writes, which is the change it shares. */
const batched = (first, second, batches = [BATCH, BATCH]) => {
  seeded({ landing: first, next: second });
  issue(UUID).sessionContext.worklog = batches[0] ? { batch: batches[0] } : {};
  issue(NEXT_UUID).sessionContext.worklog = batches[1] ? { batch: batches[1] } : {};
  issue(NEXT_UUID).plan = issue(UUID).plan;
};

test("one member of a batch named at one branch and head lands both as one candidate, each with its own mark", async () => {
  const { at, work, head, base } = world({ base: "other" });
  const pinned = sha(work, BASE);
  batched(ready(head, base), ready(head, base));
  const said = await landingRan([KEY], work);
  assert.match(said, new RegExp(`${NEXT_KEY}, on ${KEY}'s batch at the same branch and head, is taken with it`, "u"), said);
  assert.match(said, new RegExp(`=== ${KEY} ${NEXT_KEY}, as one candidate`, "u"), said);
  const landed = remote(at);
  assert.equal(git(work, "merge-base", "--is-ancestor", head, landed).status, 0, `the head landed:\n${said}`);
  assert.equal(git(work, "rev-list", "--count", `${pinned}..${landed}`, "--", "package.json").stdout.trim(), "1",
    `one version for the batch:\n${said}`);
  assert.equal(git(work, "rev-list", "--count", "--first-parent", `${pinned}..${landed}`).stdout.trim(), "2",
    `one merge and one version commit, the shared head merged once:\n${said}`);
  for (const uuid of [UUID, NEXT_UUID]) {
    assert.equal(marks(uuid).length, 1, `one mark on ${uuid}:\n${said}`);
    assert.notEqual(landing(uuid).state, "ready", `${uuid}'s checkpoint moved past ready:\n${said}`);
  }
  assert.equal(landing(NEXT_UUID).state, landing(UUID).state, said);
});

test("a batch sibling at another head is named as left out, and its checkpoint and record do not move", async () => {
  const { work, head, next, base } = world({ base: "other", second: true });
  const theirs = ready(next, base, { branch: NEXT_BRANCH });
  batched(ready(head, base), theirs);
  const said = await landingRan([KEY], work);
  assert.match(said, new RegExp(`${NEXT_KEY}, on ${KEY}'s batch, is left out: its checkpoint names ${NEXT_BRANCH} `
    + `at ${next.slice(0, 7)}, and this landing takes iss-673 at ${head.slice(0, 7)}`, "u"), said);
  assert.match(said, new RegExp(`forge resume ${NEXT_KEY}`, "u"), said);
  assert.deepEqual(landing(NEXT_UUID), theirs, `its checkpoint is unchanged:\n${said}`);
  assert.equal(marks(NEXT_UUID).length, 0, said);
  assert.equal(marks(UUID).length, 1, `the named key still lands:\n${said}`);
});

test("a same-head sibling whose own worklog names no batch is left out, and its checkpoint does not move", async () => {
  const { work, head, base } = world({ base: "other" });
  const theirs = ready(head, base);
  batched(ready(head, base), theirs, [BATCH, null]);
  const said = await landingRan([KEY], work);
  assert.match(said, new RegExp(`${NEXT_KEY}, on ${KEY}'s batch, is left out: its own worklog names no batch`, "u"), said);
  assert.deepEqual(landing(NEXT_UUID), theirs, said);
  assert.equal(marks(NEXT_UUID).length, 0, said);
});

test("a same-head sibling whose own worklog names another batch is left out, and its checkpoint does not move", async () => {
  const { work, head, base } = world({ base: "other" });
  const theirs = ready(head, base);
  batched(ready(head, base), theirs, [BATCH, `${NEXT_KEY}, ISS-9`]);
  const said = await landingRan([KEY], work);
  assert.match(said, new RegExp(`${NEXT_KEY}, on ${KEY}'s batch, is left out: its own worklog names another batch`, "u"), said);
  assert.deepEqual(landing(NEXT_UUID), theirs, said);
});

test("a same-head sibling at another turn is left out, and its checkpoint does not move", async () => {
  const { work, head, base } = world({ base: "other" });
  const theirs = ready(head, base, { state: "builder-owed", candidate: head, moved: OWNED });
  batched(ready(head, base), theirs);
  const said = await landingRan([KEY], work);
  assert.match(said, new RegExp(`${NEXT_KEY}, on ${KEY}'s batch, is left out: its checkpoint reads \`builder-owed\``, "u"), said);
  assert.deepEqual(landing(NEXT_UUID), theirs, said);
  assert.equal(marks(NEXT_UUID).length, 0, said);
});
