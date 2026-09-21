/* A project's configuration is this machine's record of it, so these cases are about WHERE a value
   was read and written rather than about what it says: the entry one checkout resolves, the entry a
   worktree of it resolves, the committed file neither of them reads, and the one command between
   them. Spawned, because the path in every answer is the point and a call made in-process would
   resolve this suite's own checkout. ISS-1403, docs/cli/the-project-file.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, statSync, symlinkSync,
  writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { escaped, fakeTracker, git, ranAsync, tempRoom } from "../../fixtures.mjs";
import { projectFileAt, projectWorkPattern } from "../../../src/resolve/settings.mjs";
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

/** Written straight to the entry above, so a case needing keys does not spend an adoption on them. */
const recorded = (entry, keys) => {
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(entry, `${JSON.stringify(keys, null, 2)}\n`);
};

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

/* The other side of the row above, and this repository's own shape since ISS-2055: a checkout that
   carries no committed file is a checkout with nothing to say about one, and a row saying so anyway
   would send its reader looking for a file that is not there. */
test("a checkout carrying no committed file is told nothing about one", async () => {
  const { room, entry } = checkout("none");
  recorded(entry, { slug: "recorded", runs: 5 });
  const run = await ask(room);
  assert.deepEqual(run.stdout.split("\n").filter((one) => one.includes("project file")), [],
    `nothing stands in that checkout, so nothing is reported about it:\n${run.stdout}`);
  assert.match(run.stdout, /parallel runs\s+5 /u, "and the record still answers for the keys");
});

test("no project key is reported against a file inside the checkout", async () => {
  const { room, entry } = checkout("sources");
  recorded(entry, { slug: "recorded", runs: 5 });
  const run = await ask(room);
  const within = run.stdout.split("\n").filter((one) => one.includes("\u2190"))
    .filter((one) => one.slice(one.indexOf("\u2190")).includes(room));
  assert.deepEqual(within, [], "a key read out of the checkout is the second store this shape "
    + `removed, and every source named is the record or the plugin's default:\n${run.stdout}`);
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

/* The refusal a project-scoped verb gives there, both ways round. Neither reading may name a route:
   the record is keyed on a repository's root folder, so there is nowhere for one to go and both
   `--adopt` and `--set` would refuse if a reader followed them. */
test("a project-scoped call in no checkout is told that, and offered no command that cannot run", async () => {
  for (const carries of [null, { slug: "rootless" }]) {
    const room = tempRoom("adopt-scoped-");
    if (carries) writeFileSync(join(room, ".forge.json"), JSON.stringify(carries));
    const run = await ranAsync(FORGE, ["issue", "--search", "anything"], tracker.env, room);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /this directory is in no checkout, so there is no\nproject for it to be scoped to/u);
    assert.doesNotMatch(run.stderr, /null/u, "a path that never resolved is not a path to print");
    assert.doesNotMatch(run.stderr, /forge doctor --(adopt|set)/u,
      "neither command can run here, and a refusal naming one that cannot is recommending a second");
    if (carries) assert.match(run.stderr, /\.forge\.json is read by nothing/u);
  }
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
  /* This call is in-process, so it reads THIS process's configuration home. Pointed at a temporary
     one for the length of the case and put back after: a suite that writes the real one writes the
     state of whoever is running it, and this case is the only one here not spawning a child that
     could be handed a home instead. */
  const held = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tempRoom("adopt-named-home-");
  try {
    const mine = join(configDir("forge"), "projects", basename(room), "config.json");
    mkdirSync(join(mine, ".."), { recursive: true });
    writeFileSync(mine, JSON.stringify({ slug: "named-elsewhere", runs: 5 }));
    assert.notEqual(room, process.cwd(), "the case is only a case while this process stands elsewhere");
    assert.deepEqual(projectFileAt(room), { slug: "named-elsewhere", runs: 5 });
    assert.deepEqual(projectFileAt(join(room, ".git")), { slug: "named-elsewhere", runs: 5 },
      "and off any path inside that checkout, the repository being what answers");
  } finally {
    if (held === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = held;
  }
});

/* The three the whole-set review found, each one a way the first write and the adoption could reach
   a state the other could not get out of. */

test("a first --set the judge refuses leaves no entry behind, so the committed file can still be adopted", async () => {
  const { room, entry } = checkout("refused-first", { slug: "refused-first", runs: 3 });
  const refused = await ask(room, "--set", "runs=every");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /Nothing was written/u);
  assert.equal(existsSync(entry), false,
    "an entry made on the way to a refusal is an entry --adopt then refuses to write over");
  const run = await ask(room, "--adopt");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(readFileSync(entry, "utf8")), { slug: "refused-first", runs: 3 });
});

test("a record holding keys but no slug is answered with the key to set, not with an adoption that would refuse", async () => {
  const { room, entry } = checkout("slugless", { slug: "slugless", runs: 6 });
  const set = await ask(room, "--set", "runs=2");
  assert.equal(set.status, 0, set.stderr);
  assert.equal(JSON.parse(readFileSync(entry, "utf8")).slug, undefined, "the entry exists and names no project");
  const run = await ranAsync(FORGE, ["issue", "--search", "anything"], tracker.env, room);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /`forge doctor --set slug=<project>`/u, run.stderr);
  assert.doesNotMatch(run.stderr, /forge doctor --adopt/u,
    "adoption refuses against an entry that exists, so naming it here is naming the one command that cannot run");
  assert.match(run.stderr, /is read by nothing/u, "while the file standing unread is still said");
});

test("a machine key with no flag of its own is refused as a project key too, by the same table", async () => {
  const { room, entry } = checkout("recorded", { slug: "recorded" });
  await ask(room, "--adopt");
  const run = await ask(room, "--set", "retrySeconds=30");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /`retrySeconds` is this MACHINE's and not this project's/u, run.stderr);
  assert.match(run.stderr, /forge doctor, which names the retry ladder and where it was read/u, run.stderr);
  assert.equal(JSON.parse(readFileSync(entry, "utf8")).retrySeconds, undefined, "and nothing was written");
});

/* The window the review's second read named: with the entry created before the bytes, a write that
   failed between the two left `{}` standing and the adoption refused against it ever after. The
   only failure this filesystem can be made to give is the directory refusing the create, which is
   the same window from the outside — the first write did not land, so what it would have made is
   not there. */
test("a first --set that could not land leaves nothing behind, and the committed file still adopts", async () => {
  const { room, entry } = checkout("failed-first", { slug: "failed-first", runs: 8 });
  const under = dirname(dirname(entry));
  mkdirSync(under, { recursive: true });
  chmodSync(under, 0o500);
  try {
    const run = await ask(room, "--set", "slug=written-nowhere");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /could not write it, so nothing was written/u, run.stderr);
  } finally {
    chmodSync(under, 0o700);
  }
  assert.equal(existsSync(entry), false, "nothing was created on the way to the refusal");
  const adopted = await ask(room, "--adopt");
  assert.equal(adopted.status, 0, adopted.stderr);
  assert.deepEqual(JSON.parse(readFileSync(entry, "utf8")), { slug: "failed-first", runs: 8 });
});

/* The race the recheck found in the cleanup that answered the finding above: a call that reads no
   entry and then meets one at the write must leave that one alone, the file being another call's.
   A dangling symlink is that race made to hold still — `existsSync` follows it and answers no, and
   an exclusive create on it is refused EEXIST, which is exactly the two readings the race gives. */
test("an entry that appeared between the reading and the write is left standing, not swept", async () => {
  const { room, entry } = checkout("raced", { slug: "raced" });
  mkdirSync(dirname(entry), { recursive: true });
  symlinkSync(join(dirname(entry), "written-by-another-call.json"), entry);
  assert.equal(existsSync(entry), false, "the reading this call takes is that there is no entry");
  const run = await ask(room, "--set", "slug=mine");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /was created between this call reading that there was none and writing/u, run.stderr);
  assert.match(run.stderr, /Run it again/u, "and the refusal carries what to do about it");
  assert.ok(lstatSync(entry).isSymbolicLink(), "what was standing there was another call's to keep");
});

/* The three the whole-set read at the landing head found, all on the one surface this change adds:
   which file the adoption reads, what it may hold, and what a copy that did not land leaves. */

test("a repository nested in another reads no committed file but its own", async () => {
  const outer = checkout("outer", { slug: "the-outer-project", runs: 9 });
  const inner = join(outer.room, "inner");
  mkdirSync(inner, { recursive: true });
  spawnSync("git", ["init", "-q", inner], { cwd: inner, encoding: "utf8" });
  const held = join(HOME, "forge", "projects", "inner", "config.json");
  const run = await ask(inner, "--adopt");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /no \.forge\.json is standing in this checkout/u, run.stderr);
  assert.match(run.stderr, /a file above its root belongs to whatever repository holds it/u,
    "and the refusal says why the outer project's file is not an answer here");
  assert.equal(existsSync(held), false, "the outer project's file is not this one's to adopt");
  const report = await ask(inner);
  assert.doesNotMatch(report.stdout, /the-outer-project/u,
    "and no row of the report names it either, a walk past this checkout's root leaving its own repository");
});

test("a committed file that is no table of keys is refused before anything is written", async () => {
  for (const [name, body] of [["list", "[1, 2]"], ["string", '"a slug, in a file that is not one"'],
    ["broken", "{ slug: nope }"]]) {
    const { room, entry } = checkout(`shape-${name}`);
    writeFileSync(join(room, ".forge.json"), body);
    const run = await ask(room, "--adopt");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /where a JSON object with this project's keys in it belongs/u, run.stderr);
    assert.equal(existsSync(entry), false,
      `${name}: an entry landed and was refused after, which every later adoption then refuses against`);
  }
});

/* The adoption creates an entry through the same writer the first `--set` does, so it owns what it
   creates on the same terms: an entry that appeared between the reading and the write is another
   call's and is left exactly where it stands. Held still the same way, by a dangling symlink. */
test("an adoption meeting an entry at the write leaves it standing and says what happened", async () => {
  const { room, entry } = checkout("adopt-raced", { slug: "adopt-raced" });
  mkdirSync(dirname(entry), { recursive: true });
  symlinkSync(join(dirname(entry), "written-by-another-call.json"), entry);
  assert.equal(existsSync(entry), false, "the reading this call takes is that there is no entry");
  const run = await ask(room, "--adopt");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /was created between this call reading that there was none and writing/u, run.stderr);
  assert.ok(lstatSync(entry).isSymbolicLink(), "what was standing there was another call's to keep");
});

/* Every message that recommends the adoption reads one predicate, so a record that exists and names
   no project is answered with the key to set wherever the question comes up rather than in the one
   place the last case happened to ask it. */
test("a record naming no project is answered with the key to set, in the report and in the stop alike", async () => {
  const { room, entry } = checkout("slugless-rows", { slug: "slugless-rows", runs: 5 });
  const set = await ask(room, "--set", "runs=3");
  assert.equal(set.status, 0, set.stderr);
  assert.equal(JSON.parse(readFileSync(entry, "utf8")).slug, undefined);
  const report = await ask(room);
  const row = report.stdout.split("\n").filter((one) => one.includes("project file"));
  assert.equal(row.length, 1, report.stdout);
  assert.match(row[0], /names no project slug yet, which adoption cannot write over/u, row[0]);
  assert.match(row[0], /`forge doctor --set slug=<project>`/u, row[0]);
  assert.doesNotMatch(row[0], /--adopt/u, "the command that would refuse is not the way out of this");
  const asked = await ask(room, "tracker");
  const stop = asked.stdout.split("\n").filter((one) => one.includes("] project slug"));
  assert.equal(stop.length, 1, asked.stdout);
  assert.match(stop[0], /`forge doctor --set slug=<project>`/u, stop[0]);
  assert.doesNotMatch(stop[0], /--adopt/u, "and the subject that stops names the same one");
});

/* Provenance is the file that answered (BR-08), so a value read off a named directory has to report
   that directory's record and not this one's: a reader sent to correct it would open a file the
   value was never in. In-process for the reason the case above gives. */
test("a value read off a named directory is reported against that directory's own record", () => {
  const one = checkout("pattern-here", { slug: "pattern-here", lease: { workingRe: "^src/" } });
  const two = checkout("pattern-there", { slug: "pattern-there", lease: { workingRe: "^lib/" } });
  const held = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tempRoom("pattern-home-");
  try {
    const mine = (room, config) => {
      const at = join(configDir("forge"), "projects", basename(room), "config.json");
      mkdirSync(join(at, ".."), { recursive: true });
      writeFileSync(at, JSON.stringify(config));
      return at;
    };
    mine(one.room, { slug: "pattern-here", lease: { workingRe: "^src/" } });
    const there = mine(two.room, { slug: "pattern-there", lease: { workingRe: "^lib/" } });
    const read = projectWorkPattern(two.room);
    assert.equal(read.value, "^lib/", "the value is the named directory's");
    assert.equal(read.from, there, "and so is the file it says it came from");
    mine(two.room, { slug: "pattern-there", lease: { workingRe: "^(" } });
    const unreadable = projectWorkPattern(two.room);
    assert.equal(unreadable.unreadable, "^(", "a pattern that does not compile is no declaration");
    assert.equal(unreadable.from, there,
      "and the file to go and correct it in is the named directory's, not this process's");
  } finally {
    if (held === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = held;
  }
});

/* The third state the same sentence has to answer for: outside a checkout neither command can run,
   because there is nowhere for a record to go. Naming the key to set there sends a reader to a
   write that refuses, which is the finding the two states above were each fixed for in turn. */
test("a subject that needs the slug names no command at all outside a checkout", async () => {
  const room = tempRoom("adopt-no-route-");
  const run = await ask(room, "tracker");
  const stop = run.stdout.split("\n").filter((one) => one.includes("] project slug"));
  assert.equal(stop.length, 1, run.stdout);
  assert.match(stop[0], /this directory is in no checkout, so there is no project for it to be scoped to/u,
    stop[0]);
  assert.doesNotMatch(stop[0], /forge doctor --(adopt|set)/u,
    "both would refuse here, and a stop naming one that refuses is recommending a second call");
});

/* The bare reading is the first command a project adopting this plugin runs, and the slug is the
   key every project-scoped verb refuses without. It is a note rather than a miss and still owes the
   act: a row stating only the consequence is the one row of that reading a reader cannot follow.
   Both states of the same sentence, because the row answers off the reading the stops answer off.
   ISS-2056. */
test("the bare reading's slug row carries a route, and the same one the subjects are answered from", async () => {
  const { room } = checkout("bare-route");
  const run = await ask(room);
  const [row, ...more] = run.stdout.split("\n").filter((one) => one.includes("] project slug"));
  assert.deepEqual(more, [], run.stdout);
  assert.match(row, /project-scoped calls will refuse; account-level ones still work — `forge doctor --set slug=<project>`/u, row);

  const adoptable = checkout("bare-route-adopt", { slug: "bare-route-adopt", runs: 2 });
  const standing = await ask(adoptable.room);
  const [held] = standing.stdout.split("\n").filter((one) => one.includes("] project slug"));
  assert.match(held, /still work — `forge doctor --adopt`$/u,
    "the command that works where this call stands, not the one that would write the key over it");

  const nowhere = await ask(tempRoom("adopt-bare-no-route-"));
  const [outside] = nowhere.stdout.split("\n").filter((one) => one.includes("] project slug"));
  assert.match(outside, /this directory is in no checkout/u, outside);
  assert.doesNotMatch(outside, /forge doctor --(adopt|set)/u,
    "a route that refuses when followed is worse on this row than no route at all");
});

/* One source for the string, so the report and the subject that lists what is unset cannot drift:
   before ISS-2056 the report spelled it `slug=<project>` by hand in three places and the undecided
   rows spelled it `slug=<text>` off the generic set call, which is four strings for one command. */
test("every reading offering the way to set a slug offers one spelling of it", async () => {
  const { room } = checkout("one-spelling");
  const report = await ask(room);
  const [row] = report.stdout.split("\n").filter((one) => one.includes("] project slug"));
  const route = /still work — `(.+)`$/u.exec(row);
  assert.ok(route, row);
  const undecided = await ask(room, "undecided");
  const [listed] = undecided.stdout.split("\n").filter((one) => /^\[[^\]]+\] slug\s/u.test(one));
  assert.ok(listed, undecided.stdout);
  assert.equal(listed.split("not set — ")[1], route[1],
    "the subject and the report name one command, composed once");

  const adoptable = checkout("one-spelling-adopt", { slug: "one-spelling-adopt" });
  const [offered] = (await ask(adoptable.room, "undecided")).stdout.split("\n")
    .filter((one) => /^\[[^\]]+\] slug\s/u.test(one));
  assert.equal(offered.split("not set — ")[1], "forge doctor --adopt",
    "and where the adoption is what works, both offer that instead");
});
