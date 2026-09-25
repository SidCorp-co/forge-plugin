/* The reading both landing routes ask before they land a change: which hunks of commits that landed
   under the branch since it was cut the change takes back (ISS-369). Real histories, one per case,
   each the shape a run meets: a replay that dropped another run's section, a stale copy staged
   after one, and the edits that must pass beside them. The ship's own refusal is read at the end. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { BARE, git as plain, pushed, runIn } from "../run-fixtures.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

const { undoneBy, undoneLine } = await import("../../../run/land-ready/undone.mjs");

const git = (room, ...args) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: room, encoding: "utf8" });
const sha = (room, rev = "HEAD") => git(room, "rev-parse", rev).stdout.trim();

const JOURNAL = join("docs", "journal.md");
const SOURCE = join("plugin", "src", "value.mjs");
const OTHER = join("docs", "other.md");
const SECTION = ["## Another run's section", "", "What that run found and wrote down.", "It landed first."];
const OLD_SOURCE = ["export const name = \"value\";", "export const value = 1;", "export const unit = \"ms\";"];

const write = (room, path, lines) => {
  mkdirSync(join(room, dirname(path)), { recursive: true });
  writeFileSync(join(room, path), `${lines.join("\n")}\n`);
};
const read = (room, path) => readFileSync(join(room, path), "utf8").replace(/\n$/u, "").split("\n");
const commit = (room, message, ...paths) => {
  git(room, "add", ...paths);
  git(room, "commit", "-qm", message);
  return sha(room);
};

/* The base the branch is cut from, the branch, then two commits landing under it — a section added
   to the journal and a value changed — and the branch replayed onto them, as a rebase leaves it. */
const replayed = (name, { replay = true } = {}) => {
  const room = join(tempRoom(`undone-${name}-`), "work");
  mkdirSync(room, { recursive: true });
  git(room, "init", "-qb", "master");
  write(room, JOURNAL, ["# Journal", "", "## The first entry", "", "Written before anybody branched."]);
  write(room, SOURCE, OLD_SOURCE);
  const cutAt = commit(room, "the base", JOURNAL, SOURCE);
  git(room, "checkout", "-qb", "iss-1");
  git(room, "checkout", "-q", "master");
  write(room, JOURNAL, [...read(room, JOURNAL), "", ...SECTION]);
  const section = commit(room, "another run's journal section", JOURNAL);
  write(room, SOURCE, OLD_SOURCE.map((one) => one.replace("= 1;", "= 2;")));
  const value = commit(room, "another run's value", SOURCE);
  git(room, "checkout", "-q", "iss-1");
  if (replay) git(room, "reset", "-q", "--hard", "master");
  return { room, cutAt, section, value, was: sha(room) };
};

const judged = (room, was, branch = "iss-1") => undoneBy(room, { was, head: sha(room), branch });

/* The first route the filing met: the change was committed before the section landed, and the
   rebase onto it conflicted and was resolved by keeping the change's side. The replayed commit keeps
   the hour it was written at, which is before the branch first held that section. */
const HOUR_AGO = String(Math.floor(Date.now() / 1000) - 3600);
const droppedOnReplay = (name) => {
  const room = join(tempRoom(`undone-${name}-`), "work");
  mkdirSync(room, { recursive: true });
  git(room, "init", "-qb", "master");
  write(room, JOURNAL, ["# Journal", "", "## The first entry"]);
  const cutAt = commit(room, "the base", JOURNAL);
  git(room, "checkout", "-qb", "iss-1");
  const mine = [...read(room, JOURNAL), "", "## This change's entry"];
  write(room, JOURNAL, mine);
  git(room, "add", JOURNAL);
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "the change"], {
    cwd: room, encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: `@${HOUR_AGO}`, GIT_COMMITTER_DATE: `@${HOUR_AGO}` },
  });
  git(room, "checkout", "-q", "master");
  write(room, JOURNAL, [...read(room, JOURNAL), "", ...SECTION]);
  const section = commit(room, "another run's journal section", JOURNAL);
  git(room, "checkout", "-q", "iss-1");
  git(room, "rebase", "-q", "master");
  write(room, JOURNAL, mine);
  git(room, "add", JOURNAL);
  git(room, "-c", "core.editor=true", "rebase", "--continue");
  return { room, cutAt, section, was: sha(room, "master") };
};

test("a replay that dropped another run's section is that commit taken back", () => {
  const { room, was, section, cutAt } = droppedOnReplay("dropped");
  assert.deepEqual(read(room, JOURNAL).slice(-1), ["## This change's entry"], "the replay did not keep the change's side");
  const found = judged(room, was);
  assert.equal(found.judged, true);
  assert.equal(found.cut, cutAt, "the cut is not the reflog's first entry");
  assert.equal(found.landed, 1);
  assert.deepEqual(found.undone.map((one) => [one.commit, one.subject, one.files]),
    [[section, "another run's journal section", [JOURNAL]]]);
});

test("a section somebody rewrites after the replay put it in front of them is no take-back", () => {
  const { room, was } = replayed("rewritten-section");
  write(room, JOURNAL, [...read(room, JOURNAL).slice(0, -SECTION.length), "## That section, said again", "", "In this change's words."]);
  commit(room, "the change rewrites that section", JOURNAL);
  assert.deepEqual(judged(room, was).undone, []);
});

/* The same drop made by a merge instead of a rebase: the branch merges the base in, conflicts, and
   keeps its own side. That merge is where the branch first held the section, and where it went. */
const mergedIn = (name, { conflict }) => {
  const room = join(tempRoom(`undone-${name}-`), "work");
  mkdirSync(room, { recursive: true });
  git(room, "init", "-qb", "master");
  write(room, JOURNAL, ["# Journal", "", "## The first entry"]);
  commit(room, "the base", JOURNAL);
  git(room, "checkout", "-qb", "iss-1");
  const mine = conflict ? [...read(room, JOURNAL), "", "## This change's entry"] : null;
  if (mine) write(room, JOURNAL, mine);
  else write(room, OTHER, ["this change's own page"]);
  commit(room, "the change", mine ? JOURNAL : OTHER);
  git(room, "checkout", "-q", "master");
  write(room, JOURNAL, [...read(room, JOURNAL), "", ...SECTION]);
  const section = commit(room, "another run's journal section", JOURNAL);
  git(room, "checkout", "-q", "iss-1");
  git(room, "merge", "-q", "--no-edit", "master");
  if (mine) {
    write(room, JOURNAL, mine);
    commit(room, "merge master, keeping this change's side", JOURNAL);
  }
  return { room, section, was: sha(room, "master") };
};

test("a merge that brought another run's section in and dropped it in the conflict takes it back", () => {
  const { room, was, section } = mergedIn("merge-dropped", { conflict: true });
  assert.equal(git(room, "rev-list", "--parents", "-n1", "HEAD").stdout.trim().split(" ").length, 3, "no merge was made");
  assert.deepEqual(judged(room, was).undone.map((one) => one.commit), [section]);
});

test("a section rewritten after a clean merge brought it in is no take-back", () => {
  const { room, was } = mergedIn("merge-rewritten", { conflict: false });
  write(room, JOURNAL, [...read(room, JOURNAL).slice(0, -SECTION.length), "## That section, said again", "", "In this change's words."]);
  commit(room, "the change rewrites that section", JOURNAL);
  assert.deepEqual(judged(room, was).undone, []);
});

test("a stale copy staged over the replay is the commit it predates taken back", () => {
  const { room, was, value } = replayed("stale");
  write(room, SOURCE, OLD_SOURCE);
  commit(room, "the change, staged with git add -u", SOURCE);
  assert.deepEqual(judged(room, was).undone.map((one) => [one.commit, one.files]), [[value, [SOURCE]]]);
});

test("a rewrite of a landed line into new content takes nothing back", () => {
  const { room, was } = replayed("rewrite");
  write(room, SOURCE, OLD_SOURCE.map((one) => one.replace("= 1;", "= 3;")));
  commit(room, "the change moves the value on", SOURCE);
  const found = judged(room, was);
  assert.deepEqual(found.undone, []);
  assert.match(undoneLine(found), /2 commit\(s\) landed under this change .* takes back no hunk/u);
});

test("a landed section moved to another file takes nothing back", () => {
  const { room, was } = replayed("moved");
  write(room, JOURNAL, read(room, JOURNAL).slice(0, -(SECTION.length + 1)));
  write(room, OTHER, ["# Elsewhere", "", ...SECTION]);
  commit(room, "the change moves that section", JOURNAL, OTHER);
  assert.deepEqual(judged(room, was).undone, []);
});

test("a take-back the change declares with Undoes: is its own decision", () => {
  const { room, was, section } = droppedOnReplay("declared");
  git(room, "commit", "-q", "--allow-empty", "-m", "the section is wrong", "-m", `Undoes: ${section.slice(0, 9)}`);
  assert.deepEqual(judged(room, was).undone, []);
});

test("an old line the change edits is no landed work, whatever it does to it", () => {
  const { room, was } = replayed("old-line");
  write(room, JOURNAL, read(room, JOURNAL).filter((one) => one !== "Written before anybody branched."));
  commit(room, "the change drops a line older than its branch", JOURNAL);
  assert.deepEqual(judged(room, was).undone, []);
});

test("a branch nothing landed under since it was cut is said to be, and costs no reading", () => {
  const { room, cutAt } = replayed("unreplayed", { replay: false });
  write(room, SOURCE, ["export const other = true;"]);
  commit(room, "the change on its own base", SOURCE);
  const found = judged(room, cutAt);
  assert.deepEqual([found.judged, found.landed, found.undone], [true, 0, []]);
  assert.ok(undoneLine(found).includes(`nothing landed under this change since it was cut at ${cutAt.slice(0, 7)}`),
    undoneLine(found));
});

test("a branch with no reflog is not judged, and the line says why", () => {
  const { room, was } = replayed("no-reflog");
  write(room, SOURCE, OLD_SOURCE);
  commit(room, "a stale copy nobody can place", SOURCE);
  rmSync(join(room, ".git", "logs", "refs", "heads", "iss-1"));
  const found = judged(room, was);
  assert.equal(found.judged, false);
  assert.match(undoneLine(found), /cannot be read — refs\/heads\/iss-1 holds no reflog .* not judged here/u);
  assert.match(undoneLine(judged(room, was, null)), /HEAD is on no branch/u);
});

/* The ship end to end. Replayed, the branch holds a change written an hour before another run's
   section landed, rebased onto it with the conflict resolved to the change's side; otherwise it is
   put on what landed and the case commits its own change over it. */
const MINE = ["# Journal", "", "## The first entry", "", "## This change's entry"];
const shipWorld = (name, { replayed: replay = false } = {}) => {
  const { at, work } = pushed(name);
  write(work, JOURNAL, MINE.slice(0, 3));
  plain(work, "add", JOURNAL);
  plain(work, "commit", "-qm", "the journal");
  plain(work, "push", "-q", "origin", "master:master");
  plain(work, "checkout", "-qb", "iss-369");
  if (replay) {
    write(work, JOURNAL, MINE);
    plain(work, "add", JOURNAL);
    spawnSync("git", ["commit", "-qm", "the change"], { cwd: work, encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_DATE: `@${HOUR_AGO}`, GIT_COMMITTER_DATE: `@${HOUR_AGO}` } });
  }
  plain(work, "checkout", "-q", "master");
  write(work, JOURNAL, [...MINE.slice(0, 3), "", ...SECTION]);
  plain(work, "add", JOURNAL);
  plain(work, "commit", "-qm", "another run's journal section");
  const section = sha(work);
  plain(work, "push", "-q", "origin", "master:master");
  plain(work, "checkout", "-q", "iss-369");
  if (!replay) plain(work, "reset", "-q", "--hard", "master");
  else {
    plain(work, "rebase", "-q", "master");
    write(work, JOURNAL, MINE);
    plain(work, "add", JOURNAL);
    plain(work, "-c", "core.editor=true", "rebase", "--continue");
  }
  return { work, section, remote: join(at, "origin.git") };
};

test("the ship refuses a change taking back landed work before its rebase, and lands nothing", () => {
  const { work, section, remote } = shipWorld("ship-undone", { replayed: true });
  assert.deepEqual(read(work, JOURNAL), MINE, "the replay did not keep the change's side");
  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 3 \(the review answers for the head this lands\)/u, run.stderr);
  assert.match(run.stderr, /takes back work that landed under it/u, run.stderr);
  assert.ok(run.stderr.includes(`${section.slice(0, 7)} another run's journal section — ${JOURNAL}`),
    `the commit, its subject and the file are not named:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`git show --format= ${section} -- ${JOURNAL} | git apply --3way`),
    `the command putting that work back is not printed:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`-m "Undoes: ${section}"`), `the declaration is not printed:\n${run.stderr}`);
  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(plain(remote, "rev-parse", "master").stdout.trim(), section, "the refused change was pushed");
  assert.equal(JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version, "1.0.0",
    "a version was raised past the step that refused");
});

/* The three shapes that are no take-back, each through the ship: what reached the step is the line it
   prints on letting the change through, and no refusal. Each returns the commit it makes. */
const PASSING = {
  rewrite: (work) => {
    write(work, JOURNAL, [...read(work, JOURNAL).slice(0, -1), "It landed first, and this change says more."]);
    return ["-m", "the change extends that section"];
  },
  move: (work) => {
    write(work, JOURNAL, read(work, JOURNAL).slice(0, -(SECTION.length + 1)));
    write(work, OTHER, ["# Elsewhere", "", ...SECTION]);
    return ["-m", "the change moves that section"];
  },
  declared: (work, section) => ["--allow-empty", "-m", "that section is wrong", "-m", `Undoes: ${section}`],
};

for (const [shape, change] of Object.entries(PASSING)) {
  test(`the ship lets through a change that ${shape === "declared" ? "declares its take-back" : `makes a ${shape}`} of landed work`, () => {
    const { work, section } = shipWorld(`ship-${shape}`, { replayed: shape === "declared" });
    const message = change(work, section);
    plain(work, "add", "-A", "docs");
    plain(work, "commit", "-q", ...message);
    const run = runIn(work, ["ship"], BARE);
    assert.match(run.stdout, /1 commit\(s\) landed under this change since it was cut at .* takes back no hunk/u,
      `${run.stdout}\n${run.stderr}`);
    assert.doesNotMatch(run.stderr, /takes back work that landed under it/u, run.stderr);
  });
}

test("the ship says what the step refuses as taken-back work and what clears it", () => {
  const { work } = pushed("ship-help");
  const help = runIn(work, ["-h"], BARE).stdout.replace(/\s+/gu, " ");
  assert.match(help, /whether the change takes back work that landed under it/u);
  assert.match(help, /the command that reapplies that commit's patch, and the line `Undoes: <sha>`/u);
});
