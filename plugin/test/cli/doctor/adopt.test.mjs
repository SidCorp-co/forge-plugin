/* A project's configuration is this machine's record of it, so these cases are about WHERE a value
   was read and written rather than about what it says: the entry one checkout resolves, the entry a
   worktree of it resolves, the committed file neither of them reads, and the one command between
   them. Spawned, because the path in every answer is the point and a call made in-process would
   resolve this suite's own checkout. ISS-1403, docs/cli/the-project-file.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

import { escaped, fakeTracker, git, ranAsync, tempRoom } from "../../fixtures.mjs";
import { projectFileAt } from "../../../src/resolve/settings.mjs";
import { configDir } from "../../../src/resolve/config.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const tracker = await fakeTracker({ answer: {} });
test.after(() => tracker.close());

const HOME = tracker.env.XDG_CONFIG_HOME;

/** A checkout of its own, and where this machine keeps its record of the project it belongs to. */
const checkout = (name, committed = null) => {
  const room = tempRoom(`adopt-${name}-`);
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  if (committed) writeFileSync(join(room, ".forge.json"), `${JSON.stringify(committed, null, 2)}\n`);
  return { room, entry: join(HOME, "forge", "projects", basename(room), "config.json") };
};

const ask = (cwd, ...argv) => ranAsync(FORGE, ["doctor", ...argv], tracker.env, cwd);

test("the committed file a checkout carries is adopted whole into this machine's record of it", async () => {
  const { room, entry } = checkout("whole", { slug: "adopted", runs: 3 });
  const run = await ask(room, "--adopt");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(readFileSync(entry, "utf8")), { slug: "adopted", runs: 3 },
    "every key of the committed file, and no key beside them");
});

test("each key the entry now holds is printed beside the file it was read back from", async () => {
  const { room, entry } = checkout("printed", { slug: "printed-here", runs: 4 });
  const run = await ask(room, "--adopt");
  assert.match(run.stdout, new RegExp(`^ {2}slug: "printed-here" {2}← ${escaped(entry)}$`, "mu"), run.stdout);
  assert.match(run.stdout, new RegExp(`^ {2}runs: 4 {2}← ${escaped(entry)}$`, "mu"),
    "read back off the disk, so the line says what that file holds rather than what was sent");
});

test("the checkout's own committed file is left byte-identical, adoption being a copy", async () => {
  const { room } = checkout("untouched", { slug: "untouched", runs: 1 });
  const path = join(room, ".forge.json");
  const before = readFileSync(path);
  const was = statSync(path).mtimeMs;
  await ask(room, "--adopt");
  assert.deepEqual(readFileSync(path), before, "the bytes");
  assert.equal(statSync(path).mtimeMs, was, "and the file was not rewritten with the same bytes either");
});

test("adopting over a record this machine already holds is refused, and writes nothing", async () => {
  const { room, entry } = checkout("twice", { slug: "twice", runs: 1 });
  await ask(room, "--adopt");
  writeFileSync(entry, JSON.stringify({ slug: "twice", runs: 9 }));
  const run = await ask(room, "--adopt");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /is this machine's record of this project already/u);
  assert.equal(JSON.parse(readFileSync(entry, "utf8")).runs, 9,
    "the key set since the first adoption is held here and nowhere else, so nothing may write over it");
});

test("the entry is created by the first --set, a project that has set nothing having no file yet", async () => {
  const { room, entry } = checkout("created");
  const run = await ask(room, "--set", "slug=made-here");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`^project\\.slug: "made-here" {2}← ${escaped(entry)}$`, "mu"));
  assert.equal(statSync(entry).mode & 0o777, 0o600, "at the mode everything under this directory keeps");
});

test("a key this machine owns is refused as a project key by name, with the route that writes it", async () => {
  const { room } = checkout("level", { slug: "level" });
  await ask(room, "--adopt");
  for (const [key, route] of [["token", "--token"], ["withheld", "--hide"], ["capabilities", "forge doctor tracker"]]) {
    const run = await ask(room, "--set", `${key}=x`);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, new RegExp(`\`${key}\` is this MACHINE's and not this project's`, "u"));
    assert.ok(run.stderr.includes(route), `${key} names its own route, and said: ${run.stderr}`);
  }
});

test("a committed file standing unread is said once, with the command that takes it over", async () => {
  const { room, entry } = checkout("said", { slug: "said" });
  const run = await ask(room);
  const rows = run.stdout.split("\n").filter((one) => one.includes("project file"));
  assert.equal(rows.length, 1, `one fact about one file, said once per call:\n${run.stdout}`);
  assert.match(rows[0], /is this checkout's own and is read by nothing/u);
  assert.ok(rows[0].includes(`\`forge doctor --adopt\` takes its contents over into ${entry}`), rows[0]);
});

test("a key the committed file carries moves no value the report prints", async () => {
  const { room } = checkout("inert", { slug: "inert", runs: 7 });
  await ask(room, "--adopt");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "inert", runs: 99 }));
  const run = await ask(room);
  assert.match(run.stdout, /parallel runs\s+7 /u, "the entry answers");
  assert.doesNotMatch(run.stdout, /parallel runs\s+99 /u, "and the file in the checkout does not");
});

test("a worktree and the checkout it was cut from resolve one and the same record", async () => {
  const { room, entry } = checkout("shared", { slug: "shared" });
  writeFileSync(join(room, "a.txt"), "one\n");
  git(room, "add", "a.txt");
  git(room, "commit", "-qm", "base");
  const linked = join(tempRoom("adopt-linked-"), "wt");
  git(room, "worktree", "add", "-q", "-b", "side", linked);
  await ask(room, "--adopt");
  const run = await ask(linked);
  assert.match(run.stdout, new RegExp(`project slug\\s+shared {2}← ${escaped(entry)}`, "u"),
    `the worktree reads the repository's own entry, not one of its own:\n${run.stdout}`);
});

test("two checkouts whose root folders differ resolve records of their own", async () => {
  const one = checkout("first", { slug: "first-project" });
  const two = checkout("second", { slug: "second-project" });
  assert.notEqual(one.entry, two.entry, "different root folders, different records");
  await ask(one.room, "--adopt");
  await ask(two.room, "--adopt");
  assert.equal(JSON.parse(readFileSync(one.entry, "utf8")).slug, "first-project");
  assert.equal(JSON.parse(readFileSync(two.entry, "utf8")).slug, "second-project");
});

test("a call needing a project slug refuses naming the command that adopts, where one is standing there", async () => {
  const { room } = checkout("unadopted", { slug: "unadopted" });
  const run = await ranAsync(FORGE, ["issue", "--search", "anything"], tracker.env, room);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /is read by nothing/u);
  assert.match(run.stderr, /`forge doctor --adopt`/u);
});

test("the row about a stranded file names no command where there is no project to adopt it into", async () => {
  const room = tempRoom("adopt-rootless-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "rootless" }));
  const run = await ask(room);
  const rows = run.stdout.split("\n").filter((one) => one.includes("project file"));
  assert.equal(rows.length, 1, run.stdout);
  assert.match(rows[0], /belongs to no checkout, so there is no project of it to configure/u);
  assert.doesNotMatch(rows[0], /null/u, "a row naming a route that cannot work recommends a second one");
});

test("a directory belonging to no checkout resolves no record, and --set says so rather than making one", async () => {
  const room = tempRoom("adopt-no-tree-");
  mkdirSync(join(room, "inner"), { recursive: true });
  const run = await ask(join(room, "inner"), "--set", "slug=nowhere");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /belongs to no checkout/u);
});

/* Called rather than spawned: the point is that the answer is the NAMED directory's and not this
   process's, and a process standing somewhere else is the whole of the condition. Three verbs read
   a directory they are not standing in — the stats corpus, the eval and the release's publication —
   and each is served by this one walk off the path it was handed. */
test("the record a named directory resolves is that directory's own repository's, not this process's", async () => {
  const { room } = checkout("named", { slug: "named-elsewhere" });
  /* This call is in-process, so the configuration home it reads is this process's own rather than
     the one the spawned cases hand their children. */
  const mine = join(configDir("forge"), "projects", basename(room), "config.json");
  mkdirSync(join(mine, ".."), { recursive: true });
  writeFileSync(mine, JSON.stringify({ slug: "named-elsewhere", runs: 5 }));
  assert.notEqual(room, process.cwd(), "the case is only a case while this process stands elsewhere");
  assert.deepEqual(projectFileAt(room), { slug: "named-elsewhere", runs: 5 });
  assert.deepEqual(projectFileAt(join(room, ".git")), { slug: "named-elsewhere", runs: 5 },
    "and off any path inside that checkout, the repository being what answers");
});
