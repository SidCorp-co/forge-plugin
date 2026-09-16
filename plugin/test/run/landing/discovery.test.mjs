/* The empty call: what this project left ready, read off the checkpoints the way a named call reads
   one, said with its order before a gate is spent, and landed as the batch the verb already builds.
   A state the lander's turn does not name is read for what the output says about it, because a
   branch left out in silence and one left out with a reason look the same from here (ISS-1632). */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BASE, NEXT_BRANCH, NEXT_OWNED, PAIRED_GATE, THIRD_BRANCH, THIRD_OWNED,
  forgetGateRuns, forgetInstall, gateRuns, git, landingRan, ready, seeded, sha, tracker, world,
} from "./fixture.mjs";

test.after(() => tracker.close());

const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);
const holds = (work, rev, head) => git(work, "merge-base", "--is-ancestor", head, rev).status === 0;

const EARLIER = "2026-01-01T09:00:00.000Z";
const LATER = "2026-01-02T09:00:00.000Z";

test("an empty call lands what the checkpoints say is ready, and says the set and its order first", async () => {
  const { at, work, head, next, last, base } = world({ base: "other", second: true, third: true, gate: PAIRED_GATE });
  const pinned = remote(at);
  seeded({
    landing: ready(head, base, { at: LATER }),
    next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED], at: EARLIER }),
    last: ready(last, base, { branch: THIRD_BRANCH, files: [THIRD_OWNED], state: "builder-owed" }),
  });
  forgetGateRuns();
  forgetInstall();
  const said = await landingRan([], work);
  assert.match(said, /off the checkpoints of every issue at in_progress, developed, testing, awaiting_release, needs_info, waiting, on_hold:/u,
    `the statuses it read are named, so what the bound cannot see is said:\n${said}`);
  assert.match(said, /ISS-675 {2}`builder-owed` {2}iss-675 {2}— left out: read where it is, forge resume ISS-675/u,
    `a state naming another turn is printed and left out:\n${said}`);
  assert.match(said, /ISS-674 {2}`ready`[^\n]+this landing's/u, said);
  /* The earlier capture first, and the line that says so before the candidate is built: a batch a
     caller learns the membership of from the result is one they could not have refused. */
  assert.ok(said.indexOf("land-ready ISS-674 ISS-673") < said.indexOf("as one candidate"),
    `the order is stated before the candidate:\n${said}`);
  assert.match(said, /=== ISS-674 ISS-673, as one candidate/u, said);
  assert.deepEqual(gateRuns(), ["green"], `one gate for the pair it found:\n${said}`);
  const landed = remote(at);
  assert.notEqual(landed, pinned, said);
  assert.ok(holds(work, landed, head) && holds(work, landed, next), `both ready heads landed:\n${said}`);
  assert.equal(holds(work, landed, last), false, `and the one it left out did not:\n${said}`);
});

test("an empty call where no checkpoint names the pin lands nothing and says what writes one", async () => {
  const { at, work, head, next, last, base } = world({ base: "other", second: true, third: true });
  const pinned = remote(at);
  seeded({
    landing: ready(head, base, { state: "builder-owed" }),
    next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED], state: "qa-owed" }),
    last: ready(last, base, { branch: THIRD_BRANCH, files: [THIRD_OWNED], state: "done" }),
  });
  forgetGateRuns();
  const said = await landingRan([], work);
  assert.match(said, /nothing ready to land/u, said);
  assert.match(said, /forge claim ISS-45 --pushed --ready/u,
    `and the refusal carries what writes a checkpoint:\n${said}`);
  assert.deepEqual(gateRuns(), [], `no gate is spent on a set it did not find:\n${said}`);
  assert.equal(remote(at), pinned, `and nothing landed:\n${said}`);
});
