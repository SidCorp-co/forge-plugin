/* The one step of the ship that is about when a read was taken rather than about the change: that
   the base under it has not moved, and that the head it was taken at is still carried. Its own file
   because `run-script` was at the god-file ceiling, and because every case here builds the same
   two-branch state and no other case in that file wants it. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, git, pushed, runIn } from "./run-fixtures.mjs";
import { tempRoom } from "../fixtures.mjs";

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
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u, run.stderr);
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
    assert.match(past.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u,
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
  assert.match(past.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u,
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
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u, run.stderr);
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
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u,
    `a rename hid the path the landing moved:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(UNDER_REVIEW),
    `the refusal names the destination and not the source the landing moved:\n${run.stderr}`);
  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "master").stdout.trim(), "the refused change was pushed");
});

/* The replay above clears the base question and answers the other one not at all: nothing in git
   tells a branch replayed and re-read from one replayed and shipped, because the two leave the same
   tree. What separates them is when the read was taken, which the consult log records (ISS-972). */
const readTaken = (root, head, files, more = {}) => {
  const home = tempRoom("run-replayed-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
    kind: "consult", id: "c1", at: "1", ok: true, reply: "CODEX: 0 findings", send: "bodies",
    root: realpathSync(root), head, files, sent: files.map((rel) => ({ rel, chars: 40, clipped: false })),
    ...more,
  })}\n`);
  return { ...BARE, XDG_CONFIG_HOME: home };
};

/* One ship per case: a pass runs the release out and moves master, so a second assertion in the
   same checkout would be about a branch with nothing left on it. `beside.mjs` is what the landing
   writes throughout, so the base half of this step passes and the read is what is left to judge. */
const ELSEWHERE = join("plugin", "src", "beside.mjs");

test("a read taken at the head the ship would land leaves it alone", () => {
  const { work, mine } = baseMoved("read-at-head", ELSEWHERE);
  const run = runIn(work, ["ship"], readTaken(work, mine, [UNDER_REVIEW]));
  assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
    `the read is at HEAD and nothing moved it, so there was nothing to refuse:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes(`taken at ${mine.slice(0, 7)}`), run.stdout);
});

test("a branch rebased after its read is refused, and a read at the head it would land clears it", () => {
  const { work, mine, remote } = baseMoved("read-outrun", ELSEWHERE);
  const env = readTaken(work, mine, [UNDER_REVIEW]);

  assert.equal(git(work, "rebase", "origin/master").status, 0);
  const landed = git(work, "rev-parse", "HEAD").stdout.trim();
  const run = runIn(work, ["ship"], env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u, run.stderr);
  assert.ok(run.stderr.includes(mine.slice(0, 7)),
    `the head the read was taken at is not named:\n${run.stderr}`);
  assert.ok(run.stderr.includes(landed.slice(0, 7)), `the head it would land is not named:\n${run.stderr}`);
  assert.match(run.stderr, /what is missing is the read at the head that would land/u,
    `the refusal has to say which of the two reads is missing:\n${run.stderr}`);
  assert.match(run.stderr, /replaying again would not clear it/u,
    `a second replay reads as the recovery:\n${run.stderr}`);
  assert.match(run.stderr, /Nothing here re-reads for you/u, run.stderr);
  assert.ok(run.stderr.includes(`--send bodies ${UNDER_REVIEW}`),
    `the read it wants does not name the whole set:\n${run.stderr}`);

  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), landed, "the ship moved the branch it refused");
  assert.equal(git(remote, "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "master").stdout.trim(), "the refused change was pushed");

  /* --from is the ship's only way past a step, and every one of these can still reach the push. */
  for (const step of ["4", "5", "6", "7"]) {
    const past = runIn(work, ["ship", "--from", step], env);
    assert.match(past.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u,
      `--from ${step} got past a read nobody took:\n${past.stderr}`);
    assert.doesNotMatch(past.stdout, /scratch gate ran/u, `--from ${step} paid a gate for a refusal`);
  }

  const reread = runIn(work, ["ship"], readTaken(work, landed, [UNDER_REVIEW]));
  assert.match(reread.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
    `a read taken at the head that would land does not clear the refusal:\n${reread.stdout}${reread.stderr}`);
  assert.ok(reread.stdout.includes(`taken at ${landed.slice(0, 7)}`), reread.stdout);
});

/* Each of these is a read this step cannot use, and the branch below every one of them is rebased
   past its own read: refusing on absence would stop every ship whose review came by another route,
   so it passes and says which absence it found rather than reading like a check that judged. */
for (const [name, held, said] of [
  ["no consult in the log at all", null, /no consult in this log read the whole of this change's 1 file\(s\)/u],
  ["a read that named none of this change's files", [], /no consult in this log read the whole/u],
  ["a read at a head this checkout cannot resolve", [UNDER_REVIEW], /is no commit this checkout can resolve/u],
]) {
  test(`${name} leaves the ship alone and is said`, () => {
    const { work, mine } = baseMoved(`read-${name.slice(0, 12).replace(/\W/gu, "-")}`, ELSEWHERE);
    assert.equal(git(work, "rebase", "origin/master").status, 0);
    const head = held === null ? null : (held.length ? "9".repeat(7) : mine);
    const run = runIn(work, ["ship"], held === null ? BARE : readTaken(work, head, held));
    assert.match(run.stdout, said, `${name} was not reported:\n${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
      `${name} stopped a ship it cannot judge:\n${run.stdout}${run.stderr}`);
  });
}

/* The rebase a step later rewrites the branch too, and `owed` puts this step back ahead of the gate
   on every resume that can still push: a run whose gate failed once would be refused for the replay
   the ship itself made and printed the resume for, which is a false refusal with no flag past it. */
test("the ship's own rebase does not cost the run a second read", () => {
  const { work } = pushed("read-then-resume");
  const pkg = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  pkg.scripts.check = "node -e \"process.exit(1)\"";
  writeFileSync(join(work, "package.json"), JSON.stringify(pkg, null, 2));
  mkdirSync(join(work, "plugin", "src"), { recursive: true });
  for (const path of [UNDER_REVIEW, ELSEWHERE]) {
    writeFileSync(join(work, path), [...Array(40).keys()].map((one) => `line ${one}`).join("\n"));
    git(work, "add", path);
  }
  git(work, "add", "package.json");
  git(work, "commit", "-m", "the files the two sides write, and a gate that refuses");
  git(work, "push", "origin", "master:master");

  git(work, "checkout", "-b", "iss-962");
  const mine = rewrote(work, UNDER_REVIEW, 1, "the change under review");
  git(work, "checkout", "master");
  rewrote(work, ELSEWHERE, 38, "what landed between the read and the ship");
  git(work, "push", "origin", "master:master");
  git(work, "checkout", "iss-962");

  const env = readTaken(work, mine, [UNDER_REVIEW]);
  const first = runIn(work, ["ship"], env);
  assert.match(first.stderr, /stopped at step 5 \(the gate\)/u, `${first.stdout}${first.stderr}`);
  assert.notEqual(git(work, "rev-parse", "HEAD").stdout.trim(), mine,
    "the ship never rebased, so nothing here is about its own replay");

  const again = runIn(work, ["ship", "--from", "5"], env);
  assert.doesNotMatch(again.stderr, /does not carry/u,
    `the resume was refused for the ship's own replay:\n${again.stdout}${again.stderr}`);
  assert.ok(again.stdout.includes(`taken at ${mine.slice(0, 7)}`), again.stdout);
  assert.match(again.stderr, /stopped at step 5 \(the gate\)/u, "the resume never reached the gate");

  /* Two failed gates are two replays, and a record holding only the last of them refuses the read
     the first was taken before — the same false refusal, one attempt further on. */
  git(work, "checkout", "master");
  rewrote(work, ELSEWHERE, 30, "a second landing, still nothing this change writes");
  git(work, "push", "origin", "master:master");
  git(work, "checkout", "iss-962");
  assert.match(runIn(work, ["ship", "--from", "4"], env).stderr, /stopped at step 5 \(the gate\)/u);
  const third = runIn(work, ["ship", "--from", "5"], env);
  assert.doesNotMatch(third.stderr, /does not carry/u,
    `a second replay by the ship lost the first:\n${third.stdout}${third.stderr}`);

  /* And nothing else rides on it: a rewrite by hand after that takes the recorded head off the
     lineage, so the record forgives the ship's replay and not the run's. */
  git(work, "commit", "--amend", "-m", "the change under review, amended after the ship replayed it");
  const byHand = runIn(work, ["ship", "--from", "5"], env);
  assert.match(byHand.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u,
    `the recorded replay waived a rewrite the run made:\n${byHand.stdout}${byHand.stderr}`);
});

/* `--name-only` quotes a path outside ASCII where a log entry holds the real one, so the set and the read would never match and a branch rebased past its review would pass as an absence. */
test("a path git quotes in its own output is still matched against the read", () => {
  const { work } = baseMoved("read-quoted-path", ELSEWHERE);
  const cafe = join("plugin", "src", "café.mjs");
  writeFileSync(join(work, cafe), "the change\n");
  git(work, "add", cafe);
  git(work, "commit", "-m", "a path git quotes in its own output");
  const env = readTaken(work, git(work, "rev-parse", "HEAD").stdout.trim(), [UNDER_REVIEW, cafe]);

  assert.equal(git(work, "rebase", "origin/master").status, 0);
  const run = runIn(work, ["ship"], env);
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u,
    `a quoted path left the read unmatched and the rebase unrefused:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(cafe), `the read it asks for does not name the path:\n${run.stderr}`);
});

/* The help says which of the three absences it found, and this is the one a run can mistake for the
   first: it did take a whole-set read, so being told none is in the log sends it nowhere. */
test("a read taken over a working tree is said to be one", () => {
  const { work, mine } = baseMoved("read-of-a-worktree", ELSEWHERE);
  assert.equal(git(work, "rebase", "origin/master").status, 0);

  const run = runIn(work, ["ship"], readTaken(work, mine, [UNDER_REVIEW], { dirty: true }));
  assert.match(run.stdout, /but over a working tree/u,
    `a read of a working tree read as no read at all:\n${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u, run.stdout);
});

/* A file the change deleted has no body a read could have carried, so it is out of the set matched
   against one. In it, this branch would find no read at all and pass for the wrong reason, which is
   why the head has to be named here and not just the rebase reached. */
test("a file the change deleted is not a file the read had to carry", () => {
  const { work } = pushed("read-with-a-deletion");
  const going = join("plugin", "src", "going.mjs");
  mkdirSync(join(work, "plugin", "src"), { recursive: true });
  for (const path of [UNDER_REVIEW, going]) {
    writeFileSync(join(work, path), [...Array(40).keys()].map((one) => `line ${one}`).join("\n"));
    git(work, "add", path);
  }
  git(work, "commit", "-m", "the file the change reads back and the one it drops");
  git(work, "push", "origin", "master:master");

  git(work, "checkout", "-b", "iss-962");
  rewrote(work, UNDER_REVIEW, 1, "the change under review");
  git(work, "rm", "-q", going);
  git(work, "commit", "-m", "and the file it deletes, which no read can have carried");
  const head = git(work, "rev-parse", "HEAD").stdout.trim();

  const run = runIn(work, ["ship"], readTaken(work, head, [UNDER_REVIEW]));
  assert.ok(run.stdout.includes(`taken at ${head.slice(0, 7)}`),
    `the deleted file kept a read of the whole surviving set out of the set:\n${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u, run.stdout);
});

/* A finding fixed after the review lands above the head that was read, which is the flow's own
   shape: the read's commit is still carried, so ancestry holds and equality would have refused it. */
test("a commit made after the read leaves the ship alone", () => {
  const { work, mine } = baseMoved("read-then-fix", ELSEWHERE);
  const env = readTaken(work, mine, [UNDER_REVIEW]);
  rewrote(work, UNDER_REVIEW, 5, "the review's finding, fixed above the head that was read");

  const run = runIn(work, ["ship"], env);
  assert.match(run.stdout, /step 4\/10 {2}rebase onto origin\/master/u,
    `a fix committed after the review was refused:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes(`taken at ${mine.slice(0, 7)}`), run.stdout);
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
