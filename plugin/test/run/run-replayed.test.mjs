/* The one step of the ship that is about a landing somebody else made: the base the review judged
   is still the base. Its own file because `run-script` was at the god-file ceiling, and because
   every case here builds the same two-branch state and no other case in that file wants it. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, git, pushed, runIn } from "./run-fixtures.mjs";

/* Two branches off one base. The change is built on one; the other lands on master and moves a file
   under review. Before this step the ship rebased, gated and pushed, and the mark it wrote named a
   reviewed head the landing did not carry — consistent and wrong (ISS-962). The shared file is
   seeded with room in it, so the two writes are the same path and not the same lines: a rebase that
   conflicts is refused two steps later anyway and proves nothing about this one. */
const UNDER_REVIEW = join("plugin", "src", "under-review.mjs");

const rewrote = (work, path, at, message) => {
  mkdirSync(join(work, "plugin", "src"), { recursive: true });
  const held = readFileSync(join(work, path), "utf8").split("\n");
  held[at] = `${held[at]} rewritten`;
  writeFileSync(join(work, path), held.join("\n"));
  git(work, "add", path);
  git(work, "commit", "-m", message);
  return git(work, "rev-parse", "HEAD").stdout.trim();
};

const baseMoved = (name, landing) => {
  const { at, work } = pushed(name);
  for (const path of new Set([UNDER_REVIEW, landing])) {
    mkdirSync(join(work, "plugin", "src"), { recursive: true });
    writeFileSync(join(work, path), [...Array(40).keys()].map((one) => `line ${one}`).join("\n"));
    git(work, "add", path);
  }
  git(work, "commit", "-m", "the files the two sides write");
  git(work, "push", "origin", "master:master");
  const base = git(work, "rev-parse", "HEAD").stdout.trim();

  git(work, "checkout", "-b", "iss-962");
  const mine = rewrote(work, UNDER_REVIEW, 1, "the change under review");
  git(work, "checkout", "master");
  const pin = rewrote(work, landing, 38, "what landed between the read and the ship");
  git(work, "push", "origin", "master:master");
  git(work, "checkout", "iss-962");
  return { at, work, base, mine, pin, remote: join(at, "origin.git") };
};

test("a landing that moved a file this change writes stops the ship before the rebase", () => {
  const shared = UNDER_REVIEW;
  const { work, base, mine, pin, remote } = baseMoved("base-moved", shared);

  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 3 \(the base the review judged is still the base\)/u, run.stderr);
  assert.ok(run.stderr.includes(shared), `the refusal names the fact and not the path:\n${run.stderr}`);
  assert.ok(run.stderr.includes(base.slice(0, 7)),
    `the base the review was taken at is not named:\n${run.stderr}`);
  assert.ok(run.stderr.includes(pin.slice(0, 7)), `the head master holds now is not named:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`git rebase ${pin}`),
    `the replay to run is not named, or not at the head it pinned:\n${run.stderr}`);
  assert.match(run.stderr, /earn the review again at that head/u,
    `a replay alone reads as the whole recovery:\n${run.stderr}`);
  assert.match(run.stderr, /Nothing here replays or re-reads for you/u,
    `the refusal has to say the ship does neither:\n${run.stderr}`);

  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), mine, "the ship rebased the branch it refused");
  assert.equal(git(remote, "rev-parse", "master").stdout.trim(), pin, "the refused change was pushed");
  assert.equal(JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version, "1.0.0",
    "a version was raised past the step that refused");

  /* --from is the ship's only way of skipping a step, so it is the only bypass this can have. Every
     step up to and including the push is covered; past the push there is no head left to protect. */
  for (const step of ["4", "5", "6", "7"]) {
    const past = runIn(work, ["ship", "--from", step], BARE);
    assert.match(past.stderr, /stopped at step 3 \(the base the review judged is still the base\)/u,
      `--from ${step} got past a read nobody took:\n${past.stderr}`);
    assert.doesNotMatch(past.stdout, /scratch gate ran/u, `--from ${step} paid a gate for a refusal`);
    assert.equal(git(remote, "rev-parse", "master").stdout.trim(), pin, `--from ${step} pushed the refused change`);
  }
});

/* A resume skips the fetch, so the remote-tracking ref is as old as the last one: the pin is read
   from the remote itself, or this step passes on a head nobody has looked at since. */
test("the step reads the remote and not a ref a resume never refreshed", () => {
  const { work, remote } = baseMoved("base-moved-unfetched", UNDER_REVIEW);
  git(work, "update-ref", "refs/remotes/origin/master", `${git(work, "rev-parse", "HEAD~1").stdout.trim()}`);

  const past = runIn(work, ["ship", "--from", "4"], BARE);
  assert.match(past.stderr, /stopped at step 3 \(the base the review judged is still the base\)/u,
    `a stale remote-tracking ref got a resume past the step:\n${past.stderr}`);
  assert.doesNotMatch(past.stdout, /scratch gate ran/u, "a resume on a stale ref paid a gate");
  assert.equal(git(remote, "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "master").stdout.trim(), "the refused resume pushed");
});

/* The pin is a head, not a ref, so it can name a commit this checkout has never seen: what that
   landing moved is unreadable here, which is the same staleness from the object store's side. */
test("a pinned head this checkout has not fetched is refused naming the fetch", () => {
  const { at, work, remote } = baseMoved("base-moved-unheld", join("plugin", "src", "beside.mjs"));
  const mover = join(at, "mover");
  git(at, "clone", "-q", remote, mover);
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) {
    git(mover, "config", key, value);
  }
  git(mover, "commit", "-q", "--allow-empty", "-m", "a landing from another machine");
  git(mover, "push", "-q", "origin", "HEAD:master");
  const unheld = git(mover, "rev-parse", "HEAD").stdout.trim();

  const run = runIn(work, ["ship", "--from", "4"], BARE);
  assert.match(run.stderr, /stopped at step 3 \(the base the review judged is still the base\)/u, run.stderr);
  assert.ok(run.stderr.includes(unheld.slice(0, 7)), `the head it could not read is not named:\n${run.stderr}`);
  assert.match(run.stderr, /a commit this checkout has not fetched/u, run.stderr);
  assert.match(run.stderr, /ship --from 2/u, `no route to the fetch that clears it:\n${run.stderr}`);
  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refusal it could not judge spent the gate");
  assert.equal(git(remote, "rev-parse", "master").stdout.trim(), unheld, "the refused resume pushed");
});

/* With rename detection on, `git diff --name-only` names a rename's destination alone, so an
   upstream edit to the source is outside the set this intersects and lands unread. */
test("a rename under review puts both of its paths in the set the landing is intersected with", () => {
  const { at, work } = pushed("base-moved-renamed");
  mkdirSync(join(work, "plugin", "src"), { recursive: true });
  writeFileSync(join(work, UNDER_REVIEW), [...Array(40).keys()].map((one) => `line ${one}`).join("\n"));
  git(work, "add", UNDER_REVIEW);
  git(work, "commit", "-m", "the file the change renames and the landing edits");
  git(work, "push", "origin", "master:master");

  git(work, "checkout", "-b", "iss-962");
  git(work, "mv", UNDER_REVIEW, join("plugin", "src", "renamed.mjs"));
  git(work, "commit", "-m", "the change under review renames it");
  git(work, "checkout", "master");
  rewrote(work, UNDER_REVIEW, 38, "what landed between the read and the ship");
  git(work, "push", "origin", "master:master");
  git(work, "checkout", "iss-962");

  const run = runIn(work, ["ship"], BARE);
  assert.match(run.stderr, /stopped at step 3 \(the base the review judged is still the base\)/u,
    `a rename hid the path the landing moved:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(UNDER_REVIEW),
    `the refusal names the destination and not the source the landing moved:\n${run.stderr}`);
  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "master").stdout.trim(), "the refused change was pushed");
});

test("a landing that moved nothing this change writes leaves the ship alone, and the replay clears it", () => {
  const { work, base, pin } = baseMoved("base-moved-elsewhere", join("plugin", "src", "beside.mjs"));

  const run = runIn(work, ["ship"], BARE);
  assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
    `a landing outside this change's paths stopped the ship:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes(`${pin.slice(0, 7)}, moved from ${base.slice(0, 7)}`),
    `the step names neither head it compared:\n${run.stdout}`);
  assert.match(run.stdout, /landing moved nothing/u,
    `the clause the mark owes is not printed:\n${run.stdout}`);

  /* Replaying is the whole of what clears the refusal, which is why no flag has to. */
  const { work: second } = baseMoved("base-moved-replayed", UNDER_REVIEW);
  assert.match(runIn(second, ["ship"], BARE).stderr, /stopped at step 3/u, "the fixture proves nothing");
  const replay = git(second, "rebase", "origin/master");
  assert.equal(replay.status, 0, `the replay this refusal names does not apply:\n${replay.stderr}`);
  const again = runIn(second, ["ship"], BARE);
  assert.match(again.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
    `a replayed change is still refused:\n${again.stdout}${again.stderr}`);
  assert.match(again.stdout, /landing moved nothing/u, again.stdout);
});
