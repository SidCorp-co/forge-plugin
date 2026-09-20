/* The trigger a project declares for reading what has landed, over real repositories git made. The
   config-dependent halves run in a child, the project file being resolved once per process; each
   case below fails without its rule, and the malformed ones keep this plugin's own three paths
   present in the fixture so a silent fallback would pass them (ISS-1883). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, ranAsync, tempRoom } from "../fixtures.mjs";

import { reviewCounts, reviewedAt, REVIEWED, reviewUncountable, SHIPPED_LINES, SHIPPED_PATHS,
  whereFrom } from "../../src/git/reviewed.mjs";

const MODULE = new URL("../../src/git/reviewed.mjs", import.meta.url).pathname;

const ran = (room, ...args) => {
  const done = git(room, ...args);
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
};

const wrote = (room, path, lines) => {
  const at = join(room, path);
  mkdirSync(join(at, ".."), { recursive: true });
  writeFileSync(at, `${Array.from({ length: lines }, (one, index) => index).join("\n")}\n`);
};

/* Both of this plugin's own default paths exist here, so a reader that fell back to them silently
   would count something rather than refusing. */
const built = (name, review, { mark = true } = {}) => {
  const room = tempRoom(`reviewed-${name}-`);
  for (const path of [...SHIPPED_PATHS, "src", "beside"]) wrote(room, join(path, "kept.txt"), 1);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: name, ...review }));
  ran(room, "init", "-q", "-b", "master", ".");
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "the first commit");
  if (mark) ran(room, "update-ref", REVIEWED, "HEAD");
  return room;
};

/* The child prints its answer whatever that answer is, so nothing here stands in for output that
   never arrived: `null` is this reader deciding nothing, and an empty answer is a parse that throws. */
const standing = async (room) => {
  const run = await ranAsync(process.execPath,
    ["--input-type=module", "-e",
      `import { reviewStanding } from ${JSON.stringify(MODULE)};`
      + ` console.log(JSON.stringify(reviewStanding(process.cwd())));`],
    process.env, room);
  assert.equal(run.status, 0, run.stderr);
  return { said: JSON.parse(run.stdout), stderr: run.stderr, status: run.status };
};

/* The reader a surface printing a reckoning it does not spend calls: it exits on nothing, so the
   assert here is the proof rather than a guard, and what it hands back is what `-h` prints. */
const reported = async (room) => {
  const run = await ranAsync(process.execPath,
    ["--input-type=module", "-e",
      `import { reviewReported } from ${JSON.stringify(MODULE)};`
      + ` console.log(JSON.stringify(reviewReported()));`],
    process.env, room);
  assert.equal(run.status, 0, `the reader a help screen calls exited: ${run.stderr}`);
  return JSON.parse(run.stdout);
};

/* The readers a release step calls, which exit where the report's own reader hands back a sentence. */
const strict = (room, name) => ranAsync(process.execPath,
  ["--input-type=module", "-e",
    `import { ${name} } from ${JSON.stringify(MODULE)}; ${name}();`],
  process.env, room);

test("the count is the changed lines under the paths named, and a sibling directory is not in it", () => {
  const room = built("counts", { review: { lines: 10, paths: ["src"] } });
  wrote(room, join("src", "grew.txt"), 7);
  wrote(room, join("beside", "grew.txt"), 400);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "the second commit");
  assert.deepEqual(reviewCounts({ tree: room, from: reviewedAt(room), paths: ["src"] }),
    { files: 1, lines: 7 });
  assert.deepEqual(reviewCounts({ tree: room, from: reviewedAt(room), paths: ["beside"] }),
    { files: 1, lines: 400 });
});

test("two repositories on one machine each count off their own mark and never the other's", () => {
  const one = built("first", { review: { lines: 10, paths: ["src"] } });
  const two = built("second", { review: { lines: 10, paths: ["src"] } });
  wrote(one, join("src", "grew.txt"), 3);
  ran(one, "add", "-A");
  ran(one, "commit", "-q", "-m", "only in the first");
  assert.notEqual(reviewedAt(one), reviewedAt(two));
  assert.equal(reviewCounts({ tree: one, from: reviewedAt(one), paths: ["src"] }).lines, 3);
  assert.equal(reviewCounts({ tree: two, from: reviewedAt(two), paths: ["src"] }).lines, 0);
});

test("a repository with no mark answers none rather than a commit", () => {
  const room = built("unplanted", { review: { lines: 10, paths: ["src"] } }, { mark: false });
  assert.equal(reviewedAt(room), null);
});

test("a project that declared neither key is read as having decided nothing", async () => {
  for (const review of [{}, { review: {} }, { review: null }]) {
    const { said } = await standing(built(`silent-${JSON.stringify(review).length}`, review));
    assert.equal(said, null, `${JSON.stringify(review)} was read as a declaration`);
  }
});

test("a project that declared only a volume takes this plugin's own paths, and is told it holds none of them", async () => {
  const room = tempRoom("reviewed-elsewhere-");
  wrote(room, join("src", "kept.txt"), 1);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "elsewhere", review: { lines: 40 } }));
  ran(room, "init", "-q", "-b", "master", ".");
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "the first commit");
  const { said } = await standing(room);
  assert.deepEqual(said.paths, { value: SHIPPED_PATHS, from: "the plugin's default" });
  assert.deepEqual(said.missing, SHIPPED_PATHS);
  assert.equal(said.mark, null);
});

test("a declared path the repository does not hold is named, and the ones it holds are not", async () => {
  const { said } = await standing(built("partly", { review: { lines: 10, paths: ["src", "gone"] } }));
  assert.deepEqual(said.missing, ["gone"]);
  assert.equal(said.paths.from, ".forge.json");
});

/* The seam this closed: the report asked which declared paths were there and the reckoning did not,
   so one of them counted zero for ever and said so with its source beside it (ISS-1939). */
test("one sentence answers the report and the reckoning alike, and names the write that corrects it", () => {
  const room = built("one-sentence", {});
  const said = reviewUncountable(room, { value: ["src", "gone"], from: ".forge.json" });
  assert.match(said, /^gone is a counted path this repository does not hold/u, said);
  assert.match(said, /forge doctor --set project\.review\.paths=<paths>/u, said);
  assert.equal(reviewUncountable(room, { value: ["src"], from: ".forge.json" }), null,
    "a tree holding every declared path is one a count over them measures something in");
});

test("a directory that stands in no checkout can count nothing", async () => {
  const room = tempRoom("reviewed-loose-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "loose", review: { lines: 10 } }));
  const { said } = await standing(room);
  assert.equal(said.checkout, false);
  assert.deepEqual(said.missing, SHIPPED_PATHS);
});

test("the volume in force is the project's, and its absence takes the shipped number", async () => {
  const mine = await standing(built("volume", { review: { lines: 42, paths: ["src"] } }));
  assert.deepEqual(mine.said.lines, { value: 42, from: ".forge.json" });
  const theirs = await standing(built("no-volume", { review: { paths: ["src"] } }));
  assert.deepEqual(theirs.said.lines, { value: SHIPPED_LINES, from: "the plugin's default" });
});

test("the count answers owed at the volume and short below it", async () => {
  const room = built("owed", { review: { lines: 6, paths: ["src"] } });
  wrote(room, join("src", "grew.txt"), 5);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "five lines");
  assert.equal((await standing(room)).said.owed, false);
  wrote(room, join("src", "more.txt"), 1);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "one more");
  const past = await standing(room);
  assert.equal(past.said.changed, 6);
  assert.equal(past.said.owed, true);
});

/* The measurement that refuted a review finding: git 2.53 counts app/[slug] and not its sibling
   app/s with no pathspec magic asked for, and a pattern that only globs names no directory on disk,
   so the missing-path check above already refuses it. Pinned here rather than answered by a flag. */
test("a declared directory whose name reads as a pathspec pattern counts it and not its sibling", () => {
  const room = tempRoom("reviewed-bracketed-");
  for (const path of ["app/[slug]", "app/s"]) wrote(room, join(path, "kept.txt"), 1);
  writeFileSync(join(room, ".forge.json"),
    JSON.stringify({ slug: "bracketed", review: { lines: 10, paths: ["app/[slug]"] } }));
  ran(room, "init", "-q", "-b", "master", ".");
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "the first commit");
  ran(room, "update-ref", REVIEWED, "HEAD");
  wrote(room, join("app", "[slug]", "grew.txt"), 6);
  wrote(room, join("app", "s", "grew.txt"), 400);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "both grew");
  assert.deepEqual(reviewCounts({ tree: room, from: reviewedAt(room), paths: ["app/[slug]"] }),
    { files: 1, lines: 6 });
});

test("a mistyped volume is refused rather than taking the shipped number", async () => {
  for (const [at, lines] of [null, "1500", 0, -1, 1.5].entries()) {
    const room = built(`volume-${at}`, { review: { lines, paths: ["src"] } });
    const { status, stderr } = await strict(room, "reviewLines");
    assert.equal(status, 1, `${JSON.stringify(lines)} was accepted`);
    assert.match(stderr, /`review\.lines` in \.forge\.json is a whole number/u);
    const read = await standing(room);
    assert.equal(read.status, 0, `the report's own reader exited: ${read.stderr}`);
    assert.match(read.said.refusal, /`review\.lines` in \.forge\.json is a whole number/u);
  }
});

test("a malformed paths declaration is refused rather than falling back to the shipped three", async () => {
  for (const [at, paths] of ["src", [], [""], [3], ["/etc"], ["../escaped"]].entries()) {
    const room = built(`paths-${at}`, { review: { lines: 10, paths } });
    const { status, stderr } = await strict(room, "reviewPaths");
    assert.equal(status, 1, `${JSON.stringify(paths)} was accepted`);
    assert.match(stderr, /`review\.paths` in \.forge\.json is/u);
    assert.match(stderr, /Drop the key to count plugin\/src, plugin\/hooks, plugin\/bin/u);
    const read = await standing(room);
    assert.equal(read.status, 0, `the report's own reader exited: ${read.stderr}`);
    assert.match(read.said.refusal, /`review\.paths` in \.forge\.json is/u);
  }
});

test("the reported reckoning carries each half's source, and a malformed one comes back as its refusal", async () => {
  assert.deepEqual(await reported(built("reported-both", { review: { lines: 42, paths: ["src"] } })),
    { lines: { value: 42, from: ".forge.json" }, paths: { value: ["src"], from: ".forge.json" } });

  const half = await reported(built("reported-half", { review: { lines: 42 } }));
  assert.deepEqual(half.paths, { value: SHIPPED_PATHS, from: "the plugin's default" });

  assert.deepEqual(await reported(built("reported-none", {})),
    { lines: { value: SHIPPED_LINES, from: "the plugin's default" },
      paths: { value: SHIPPED_PATHS, from: "the plugin's default" } });

  const wrong = await reported(built("reported-wrong", { review: { lines: "lots" } }));
  assert.match(wrong.refusal, /`review\.lines` in \.forge\.json is a whole number/u);
  assert.equal(wrong.lines, undefined, "a malformed declaration hands back no value to print");
});

test("a reckoning read from two declarations names both, and one read from a single source names it once", () => {
  const volume = { value: 42, from: ".forge.json" };
  const shipped = { value: SHIPPED_PATHS, from: "the plugin's default" };
  assert.equal(whereFrom({ lines: volume, paths: { value: ["src"], from: ".forge.json" } }), ".forge.json");
  assert.equal(whereFrom({ lines: volume, paths: shipped }),
    "the volume .forge.json, the paths the plugin's default");
  assert.equal(whereFrom({ lines: { value: SHIPPED_LINES, from: "the plugin's default" },
    paths: { value: ["src"], from: ".forge.json" } }),
  "the volume the plugin's default, the paths .forge.json");
  assert.equal(whereFrom({ lines: shipped, paths: shipped }), "the plugin's default");
});
