/* One landing at a time on a checkout, and what a rejected push leaves behind. The lock is
   exercised twice over: through the module, where a handoff can be made deterministic, and through
   the ship, where the span and the release are. The other two readers of `tools/run.mjs` are
   `run-script.test.mjs` for the steps and `run-review.test.mjs` for the count. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, committed, GATE, git, landIn, pushed, ROOT, runIn, scratch, withReview } from "./run-fixtures.mjs";

const MODULE = join(ROOT, "tools", "run", "lock.mjs");
const { dropShipLock, lockFile, takeShipLock, watching } = await import(MODULE);

const LOCK = "forge-ship-lock";
const BUMP = "forge-ship-bump";
const at = (work, name) => join(work, ".git", name);

const held = (work, one) => writeFileSync(at(work, LOCK), JSON.stringify(one));

/* A process this test can point a lock at and be sure of: alive until it is killed, and its exit
   awaited so a case about a dead holder never reads a pid that is still winding down. */
const idle = () => spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });

const ended = async () => {
  const one = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((done) => one.on("exit", done));
  return one.pid;
};

/* The remote moves under the gate, once: the second pass has to find a head that stays still, or a
   resume could never land at all. Written as the project's own `check`, which is what ship spends. */
const MOVES = "if [ ! -f ../moved ]; then rm -rf ../mover"
  + " && git clone -q ../origin.git ../mover"
  + " && git -C ../mover -c user.email=t@example.test -c user.name=Test commit -q --allow-empty -m 'a sibling landed'"
  + " && git -C ../mover push -q origin HEAD:master; touch ../moved; fi";

const remoted = (name, gate = GATE) => {
  const room = scratch(name, gate);
  git(room.at, "init", "--bare", "origin.git");
  git(room.work, "init", "-b", "master");
  committed(room.work, "one");
  git(room.work, "remote", "add", "origin", join(room.at, "origin.git"));
  git(room.work, "push", "origin", "HEAD:master");
  return room;
};

/* A landing from another machine, which no lock on this one reaches. */
const moveRemote = (room, nth) => {
  const mover = join(room.at, `mover-${nth}`);
  git(room.at, "clone", "-q", join(room.at, "origin.git"), mover);
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(mover, "config", key, value);
  git(mover, "commit", "-q", "--allow-empty", "-m", `a sibling landed ${nth}`);
  git(mover, "push", "-q", "origin", "HEAD:master");
};

/* `claude` is steps 8 and 9, and BARE carries none: a case that needs a whole ship past the push
   supplies one, and this one answers with whether the lock was there while it ran. */
const claudeSaying = (room, marker) => {
  const bin = join(room.at, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "claude"),
    `#!/bin/sh\nif [ -f .git/${LOCK} ]; then echo held > ../${marker}; else echo free > ../${marker}; fi\nexit 0\n`,
    { mode: 0o755 });
  return { ...BARE, PATH: `${bin}:${BARE.PATH}` };
};

const inChild = (body) => spawn(process.execPath, ["--input-type=module", "-e",
  `const { takeShipLock } = await import(${JSON.stringify(MODULE)});\n${body}`],
{ stdio: ["ignore", "pipe", "inherit"] });

test("the lock is one file for every worktree of a checkout, and not one per worktree", () => {
  const { at: room, work } = pushed("lock-shared");
  const beside = join(room, "wt-ISS-1");
  git(work, "worktree", "add", beside, "-b", "iss-1");

  assert.equal(lockFile(beside), lockFile(work),
    "a linked worktree and its checkout must contend on one file, or the lock serializes nothing");
  assert.ok(lockFile(work).endsWith(join(".git", LOCK)), lockFile(work));
});

/* The one property the acquire loop leans on: nothing changes after the await begins, so the case
   passes only if the notification that arrived before it was kept. */
test("a wait armed before the lock file moves settles on what happened while nothing was awaiting", async () => {
  const { work } = pushed("lock-retained");
  const path = at(work, LOCK);
  writeFileSync(path, "{}");

  const wait = watching(path, 30_000);
  rmSync(path);
  assert.equal(await wait.settled, "changed", "a wait that armed first must keep what it was armed for");
  wait.cancel();
});

test("a waiter takes the lock the moment the landing ahead of it drops one", async () => {
  const { work } = pushed("lock-handoff");
  const path = at(work, LOCK);
  const drop = await takeShipLock(work, { tree: work, branch: "master" }, { say: () => {} });

  const waiter = inChild(
    `await takeShipLock(${JSON.stringify(work)}, { tree: "the waiter" }, { ms: 30000,`
    + ` say: () => process.stdout.write("waiting\\n") });\nprocess.stdout.write("took it\\n");`);

  let said = "";
  const heard = (want) => new Promise((done) => {
    const read = (chunk) => {
      said += chunk;
      if (said.includes(want)) {
        waiter.stdout.off("data", read);
        done();
      }
    };
    waiter.stdout.on("data", read);
  });

  await heard("waiting");
  assert.ok(existsSync(path), "the holder's lock is gone before the waiter ever saw it");
  drop();
  await heard("took it");
  await new Promise((done) => waiter.on("exit", done));
  assert.ok(existsSync(path), "the waiter took no lock of its own");
  rmSync(path, { force: true });
});

test("three landings on one checkout go through it one at a time", async () => {
  const { at: room, work } = pushed("lock-exclusive");
  const log = join(room, "span.log");
  writeFileSync(log, "");
  const one = (nth) => new Promise((done) => {
    inChild(`const { appendFileSync } = await import("node:fs");\n`
      + `const drop = await takeShipLock(${JSON.stringify(work)}, { tree: "run ${nth}" }, { ms: 60000, say: () => {} });\n`
      + `appendFileSync(${JSON.stringify(log)}, "in ${nth}\\n");\n`
      + `await new Promise((wake) => setTimeout(wake, 60));\n`
      + `appendFileSync(${JSON.stringify(log)}, "out ${nth}\\n");\ndrop();`).on("exit", done);
  });

  await Promise.all([one(1), one(2), one(3)]);
  const marks = readFileSync(log, "utf8").split("\n").filter(Boolean);
  assert.equal(marks.length, 6, marks.join(" "));
  for (let step = 0; step < marks.length; step += 2) {
    assert.match(marks[step], /^in /u, marks.join(" "));
    assert.equal(marks[step + 1], marks[step].replace("in", "out"),
      `two landings were inside the span at once: ${marks.join(" ")}`);
  }
});

test("a lock is never removed by a run that did not take it", () => {
  const { work } = pushed("lock-not-mine");
  const path = at(work, LOCK);
  held(work, { tree: "somebody else", pid: 1, since: "2026-09-06T00:00:00.000Z" });

  assert.equal(dropShipLock(path, process.pid), false, "a run removed a lock that was not its own");
  assert.ok(existsSync(path), "the other landing's lock is gone");
});

test("a ship waiting behind a landing names it, reaches no step, and refuses rather than hanging", () => {
  const { work } = remoted("lock-waits");
  const other = idle();
  held(work, { tree: "/run/wt-ISS-999", pid: other.pid, branch: "iss-999", since: "2026-09-06T06:00:00.000Z" });
  const was = git(work, "rev-parse", "HEAD").stdout.trim();

  const run = runIn(work, ["ship", "--wait", "0.05"], BARE);
  other.kill();

  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /waiting behind the landing in \/run\/wt-ISS-999/u, run.stdout);
  assert.ok(run.stdout.includes(`pid ${other.pid}`), run.stdout);
  assert.doesNotMatch(run.stdout, /step 2\/10/u, "a ship waiting for the lock took the fetch anyway");
  assert.match(run.stderr, /has been held by \/run\/wt-ISS-999/u, run.stderr);
  assert.ok(run.stderr.includes(`rm ${at(work, LOCK)}`), run.stderr);
  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), was, "a waiting ship committed a version");
});

test("a lock left by a ship that died is named with the command that clears it, never taken over", async () => {
  const { work } = remoted("lock-stale");
  const gone = await ended();
  held(work, { tree: "/run/wt-ISS-998", pid: gone, branch: "iss-998", since: "2026-09-06T06:00:00.000Z" });

  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /a ship that is no longer running left this checkout's landing lock behind/u, run.stderr);
  assert.match(run.stderr, /\/run\/wt-ISS-998/u, run.stderr);
  assert.ok(run.stderr.includes(`pid ${gone}`), run.stderr);
  assert.ok(run.stderr.includes(`rm ${at(work, LOCK)}`), run.stderr);
  assert.ok(existsSync(at(work, LOCK)), "the ship took over a lock it was told to leave alone");
});

/* The gate is inside the span and the install steps are outside it, and both are read from inside
   the step rather than from what is left when the run ends: a lock dropped only by the outer
   `finally` would look exactly the same afterwards. */
test("the lock is held through the gate and gone by the time an install step runs", () => {
  const room = remoted("lock-span",
    "node -e \"const f=require('fs');f.writeFileSync('../gate-saw',f.existsSync('.git/forge-ship-lock')?'held':'free')\"");
  landIn(room.work, join("plugin", "src", "one.mjs"), 4, "the change this release ships");
  const env = claudeSaying(room, "claude-saw");

  const run = runIn(room.work, ["ship"], env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.equal(readFileSync(join(room.at, "gate-saw"), "utf8").trim(), "held",
    "the gate ran with the branch unlocked, so a sibling could move it under the run");
  assert.equal(readFileSync(join(room.at, "claude-saw"), "utf8").trim(), "free",
    "an install step held the landing lock, which blocks a sibling for a landing already made");
  assert.ok(!existsSync(at(room.work, LOCK)), "the ship kept its lock past the push");
});

test("a resume that pushes nothing takes no lock and runs to its last step behind one", () => {
  const room = remoted("lock-install-only");
  const env = claudeSaying(room, "claude-saw");
  const other = idle();
  held(room.work, { tree: "/run/wt-ISS-997", pid: other.pid, since: "2026-09-06T06:00:00.000Z" });

  const run = runIn(room.work, ["ship", "--from", "8"], env);
  other.kill();
  assert.doesNotMatch(run.stdout, /waiting behind/u, "a resume that lands nothing waited for the branch");
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.ok(existsSync(at(room.work, LOCK)), "the resume removed a lock it never took");
});

test("a ship that stops inside the span leaves no lock behind", () => {
  const room = remoted("lock-red-gate", "node -e \"process.exit(1)\"");
  landIn(room.work, join("plugin", "src", "one.mjs"), 4, "the change");

  const run = runIn(room.work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 4 \(the gate\)/u, run.stderr);
  assert.ok(!existsSync(at(room.work, LOCK)),
    "a stopped ship left the branch locked, and the next run waits behind a landing that is over");
});

/* The push race the lock cannot reach: a landing from another machine. What the refusal asks for
   has to go through, and a version commit for a version the remote has taken is what stopped it. */
test("a rejected push undoes the version commit it made, and the resume lands the change with one release", () => {
  const room = remoted("push-race", MOVES);
  landIn(room.work, join("plugin", "src", "one.mjs"), 4, "the change this release ships (ISS-333)");
  const change = git(room.work, "rev-parse", "HEAD").stdout.trim();

  const first = runIn(room.work, ["ship"], BARE);
  assert.equal(first.status, 1, first.stdout);
  assert.match(first.stderr, /Rejected means the remote moved/u, first.stderr);
  assert.match(first.stderr, /the version commit this run made at 1\.0\.1 is undone/u, first.stderr);
  assert.equal(git(room.work, "rev-parse", "HEAD").stdout.trim(), change,
    "the tree a caller rebases still holds the version commit the rebase conflicts on");
  assert.ok(!existsSync(at(room.work, BUMP)), "the undone bump is still recorded as this run's to undo");
  assert.equal(git(room.work, "status", "--porcelain").stdout.trim(), "",
    "the unwind left the manifests raised on disk");

  const env = claudeSaying(room, "claude-saw");
  const again = runIn(room.work, ["ship", "--from", "2"], env);
  assert.match(again.stdout, /step 10\/10/u, `${again.stdout}${again.stderr}`);

  const subjects = git(room.work, "log", "--format=%s", "origin/master").stdout;
  assert.match(subjects, /the change this release ships \(ISS-333\)/u, subjects);
  assert.equal((subjects.match(/chore\(release\)/gu) ?? []).length, 1,
    `the pushed history carries more than one release commit:\n${subjects}`);
});

test("a release commit this run did not make is left where it is by a rejected push", () => {
  const room = remoted("push-race-not-mine");
  moveRemote(room, 1);
  const kept = JSON.parse(readFileSync(join(room.work, "package.json"), "utf8"));
  writeFileSync(join(room.work, "package.json"),
    JSON.stringify({ ...kept, version: "9.9.9", dependencies: { left: "1.0.0" } }, null, 2));
  git(room.work, "add", "package.json");
  git(room.work, "commit", "-m", "a manifest change somebody made by hand");
  const was = git(room.work, "rev-parse", "HEAD").stdout.trim();

  const run = runIn(room.work, ["ship", "--from", "6"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this run did not make the whole of it/u, run.stderr);
  assert.equal(git(room.work, "rev-parse", "HEAD").stdout.trim(), was,
    "a commit this script did not make was reset away by a rejected push");
});

test("a version step that swept somebody's manifest edit in records no undo, and the push leaves it", () => {
  const room = remoted("push-race-swept");
  moveRemote(room, 1);
  const kept = JSON.parse(readFileSync(join(room.work, "package.json"), "utf8"));
  writeFileSync(join(room.work, "package.json"), JSON.stringify({ ...kept, dependencies: { left: "1.0.0" } }, null, 2));

  const run = runIn(room.work, ["ship", "--from", "5"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /package\.json differed from HEAD before this step ran/u, run.stdout);
  assert.ok(!existsSync(at(room.work, BUMP)), "a commit carrying somebody's edit was recorded as this run's to undo");
  assert.match(run.stderr, /this run did not make the whole of it/u, run.stderr);
  assert.equal(JSON.parse(git(room.work, "show", "HEAD:package.json").stdout).dependencies.left, "1.0.0",
    "the swept edit was reset away");
});

/* A release file nobody tracked yet is still somebody's: `git add` by name takes it into the bump
   commit, and an undo resetting to a parent that never had it takes it off the disk. */
test("an untracked release file the version step would sweep in records no undo, and is still there after", () => {
  const room = remoted("push-race-untracked");
  moveRemote(room, 1);
  const lock = join(room.work, "package-lock.json");
  writeFileSync(lock, `${JSON.stringify({ name: "scratch", version: "1.0.0", lockfileVersion: 3, packages: {} }, null, 2)}\n`);

  const run = runIn(room.work, ["ship", "--from", "5"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /package-lock\.json differed from HEAD before this step ran/u, run.stdout);
  assert.ok(!existsSync(at(room.work, BUMP)),
    "a commit that swept in a file nobody tracked was recorded as this run's to undo");
  assert.match(run.stderr, /this run did not make the whole of it/u, run.stderr);
  assert.ok(existsSync(lock), "a rejected push deleted a file that was on the disk before the ship began");
});

/* The file is the lock, so an acquisition that creates it and then cannot finish has taken the
   branch and has no release to hand back. */
test("an acquisition that cannot write its record leaves no lock file behind", async () => {
  const { work } = pushed("lock-unwritable");
  const circular = { tree: work };
  circular.self = circular;

  await assert.rejects(() => takeShipLock(work, circular, { ms: 1000, say: () => {} }));
  assert.ok(!existsSync(at(work, LOCK)), "a lock nobody holds and no release names was left on the branch");
});

/* The record outlives the process that wrote it, so a resume at the push can meet a tree somebody
   has been working in since. A hard reset there takes that work with it, and does not run. */
test("uncommitted work at a rejected push stops the undo, and stays on disk", () => {
  const room = remoted("push-race-dirty");
  landIn(room.work, join("plugin", "src", "one.mjs"), 4, "the change");
  const kept = JSON.parse(readFileSync(join(room.work, "package.json"), "utf8"));
  writeFileSync(join(room.work, "package.json"), JSON.stringify({ ...kept, version: "1.0.1" }, null, 2));
  git(room.work, "add", "package.json");
  git(room.work, "commit", "-m", "chore(release): 1.0.1, so the installed copy is this head");
  const bump = git(room.work, "rev-parse", "HEAD").stdout.trim();
  writeFileSync(at(room.work, BUMP), `${bump}\n`);
  writeFileSync(join(room.work, "plugin", "src", "one.mjs"), "work somebody has not committed\n");
  moveRemote(room, 1);

  const run = runIn(room.work, ["ship", "--from", "6"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this tree has uncommitted work in it/u, run.stderr);
  assert.equal(git(room.work, "rev-parse", "HEAD").stdout.trim(), bump,
    "the undo ran over a tree it was told to leave");
  assert.equal(readFileSync(join(room.work, "plugin", "src", "one.mjs"), "utf8"),
    "work somebody has not committed\n", "a rejected push threw away work nobody had committed");
});

test("the reading threshold is the project's where it sets one, and reaches every sentence that prints it", () => {
  const { work } = pushed("review-lines-project");
  withReview(work, 40);
  runIn(work, ["review", "--done"], BARE);

  assert.match(runIn(work, ["-h"], BARE).stdout, /range holds 40 changed line\(s\)/u,
    "the help names a number the project has replaced");

  landIn(work, join("plugin", "src", "wide.mjs"), 39, "a module a run grew");
  assert.match(runIn(work, ["review"], BARE).stdout, /^Short of the 40 changed line\(s\)/mu, "39 is one short");

  landIn(work, join("plugin", "src", "wide.mjs"), 40, "the line that crosses it");
  assert.match(runIn(work, ["review"], BARE).stdout, /^A review is owed: 40 changed line\(s\)/mu, "40 is the boundary");
});

test("the threshold this script ships with stands where the project sets none", () => {
  const { work } = pushed("review-lines-default");
  runIn(work, ["review", "--done"], BARE);
  assert.match(runIn(work, ["review"], BARE).stdout, /^Short of the 1500 changed line\(s\)/mu, "the default is 1500");
  assert.match(runIn(work, ["-h"], BARE).stdout, /range holds 1500 changed line\(s\)/u, "the help says the same");
});

test("a review.lines that is no count of lines is refused by name rather than replaced", () => {
  for (const given of [0, -5, 1.5, null]) {
    const { work } = pushed(`review-lines-${String(given).replace(/[.-]/gu, "_")}`);
    runIn(work, ["review", "--done"], BARE);
    withReview(work, given);
    const run = runIn(work, ["review"], BARE);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /`review\.lines` in \.forge\.json is a whole number of changed lines above zero/u, run.stderr);
    assert.ok(run.stderr.includes(String(given)), `the value refused is not named:\n${run.stderr}`);
  }
});

test("the ship's own count is the project's too", () => {
  const room = remoted("review-lines-ship");
  withReview(room.work, 40);
  runIn(room.work, ["review", "--done"], BARE);
  landIn(room.work, join("plugin", "src", "wide.mjs"), 20, "a module a run grew");
  const env = claudeSaying(room, "claude-saw");

  const run = runIn(room.work, ["ship"], env);
  assert.match(run.stdout, /short of the 40 line\(s\) that call for a reading/u, `${run.stdout}${run.stderr}`);
});
