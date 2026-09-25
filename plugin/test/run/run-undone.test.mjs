/* The reading both landing routes ask before they land a change: which hunks of commits that landed
   under the branch since it was cut the change takes back (ISS-369). Real histories, one per case,
   each the shape a run meets: a replay that dropped another run's section, a stale copy staged
   after one, and the edits that must pass beside them. The ship's own refusal is read at the end. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { BARE, git as plain, pushed, runIn } from "./run-fixtures.mjs";
import { tempRoom } from "../fixtures.mjs";

const { undoneBy, undoneLine } = await import("../../../tools/run/undone.mjs");

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

test("a replay that dropped another run's section is that commit taken back", () => {
  const { room, was, section, cutAt } = replayed("dropped");
  write(room, JOURNAL, read(room, JOURNAL).slice(0, -(SECTION.length + 1)));
  write(room, join("docs", "mine.md"), ["this change's own page"]);
  commit(room, "the change, replayed the wrong way", JOURNAL, join("docs", "mine.md"));
  const found = judged(room, was);
  assert.equal(found.judged, true);
  assert.equal(found.cut, cutAt, "the cut is not the reflog's first entry");
  assert.equal(found.landed, 2);
  assert.deepEqual(found.undone.map((one) => [one.commit, one.subject, one.files]),
    [[section, "another run's journal section", [JOURNAL]]]);
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
  const { room, was, section } = replayed("declared");
  write(room, JOURNAL, read(room, JOURNAL).slice(0, -(SECTION.length + 1)));
  commit(room, "the change drops that section on purpose", JOURNAL);
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
  assert.match(undoneLine(found), new RegExp(`nothing landed under this change since it was cut at ${cutAt.slice(0, 7)}`, "u"));
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

/* The ship end to end: a branch replayed onto what landed, then a commit dropping that landing's
   section. The step before the rebase refuses it, and nothing past it runs. */
const shipWorld = (name) => {
  const { at, work } = pushed(name);
  write(work, JOURNAL, ["# Journal", "", "## The first entry"]);
  plain(work, "add", JOURNAL);
  plain(work, "commit", "-qm", "the journal");
  plain(work, "push", "-q", "origin", "master:master");
  plain(work, "checkout", "-qb", "iss-369");
  plain(work, "checkout", "-q", "master");
  write(work, JOURNAL, [...read(work, JOURNAL), "", ...SECTION]);
  plain(work, "add", JOURNAL);
  plain(work, "commit", "-qm", "another run's journal section");
  const section = sha(work);
  plain(work, "push", "-q", "origin", "master:master");
  plain(work, "checkout", "-q", "iss-369");
  plain(work, "reset", "-q", "--hard", "master");
  return { work, section, remote: join(at, "origin.git") };
};

test("the ship refuses a change taking back landed work before its rebase, and lands nothing", () => {
  const { work, section, remote } = shipWorld("ship-undone");
  write(work, JOURNAL, ["# Journal", "", "## The first entry", "", "## This change's entry"]);
  plain(work, "add", JOURNAL);
  plain(work, "commit", "-qm", "the change, replayed the wrong way");
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
   prints on letting the change through, and no refusal. */
const PASSING = {
  rewrite: (work) => {
    write(work, JOURNAL, [...read(work, JOURNAL).slice(0, -1), "It landed first, and this change says more."]);
    return [JOURNAL];
  },
  move: (work) => {
    write(work, JOURNAL, read(work, JOURNAL).slice(0, -(SECTION.length + 1)));
    write(work, OTHER, ["# Elsewhere", "", ...SECTION]);
    return [JOURNAL, OTHER];
  },
  declared: (work, section) => {
    write(work, JOURNAL, read(work, JOURNAL).slice(0, -(SECTION.length + 1)));
    return [JOURNAL, `Undoes: ${section}`];
  },
};

for (const [shape, change] of Object.entries(PASSING)) {
  test(`the ship lets through a change that ${shape === "declared" ? "declares its take-back" : `makes a ${shape}`} of landed work`, () => {
    const { work, section } = shipWorld(`ship-${shape}`);
    const [paths, declares] = ((said) => [said.filter((one) => !one.startsWith("Undoes:")),
      said.find((one) => one.startsWith("Undoes:"))])(change(work, section));
    plain(work, "add", ...paths);
    plain(work, "commit", "-qm", `the change, as a ${shape}`, ...(declares ? ["-m", declares] : []));
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
