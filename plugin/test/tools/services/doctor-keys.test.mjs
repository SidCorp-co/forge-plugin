/* The row that tells an adopting project whether its declaration will ever do anything. Spawned
   rather than called, because what is under test is the sentence a developer reads and the project
   file resolves once per process (ISS-1883). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, homeEnv, ranAsync, tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const ran = (room, ...args) => {
  const done = git(room, ...args);
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
};

const wrote = (room, path, lines) => {
  const at = join(room, path);
  mkdirSync(join(at, ".."), { recursive: true });
  writeFileSync(at, `${Array.from({ length: lines }, (one, index) => index).join("\n")}\n`);
};

const built = (name, review, { mark = true } = {}) => {
  const room = tempRoom(`review-row-${name}-`);
  wrote(room, join("app", "kept.txt"), 1);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: name, ...review }));
  ran(room, "init", "-q", "-b", "master", ".");
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "the first commit");
  if (mark) ran(room, "update-ref", "refs/forge/reviewed", "HEAD");
  return room;
};

const rowIn = async (room, name) => {
  const { stdout } = await ranAsync(FORGE, ["doctor", "project"], homeEnv(`review-row-${name}`), room);
  return stdout.split("\n").filter((one) => one.includes("] review ")).join("\n");
};

test("a project that declared neither key gets no review row at all", async () => {
  for (const [at, review] of [{}, { review: {} }, { review: null }].entries()) {
    assert.equal(await rowIn(built(`silent-${at}`, review), `silent-${at}`), "",
      `${JSON.stringify(review)} printed a row`);
  }
});

test("a declaration this repository cannot count is a miss naming the paths and the key to set", async () => {
  const said = await rowIn(built("elsewhere", { review: { lines: 40 } }), "elsewhere");
  assert.match(said, /^\[ miss \] review/u);
  assert.match(said, /plugin\/src, plugin\/hooks, plugin\/bin are counted paths this repository does not hold/u);
  assert.match(said, /Declare this repository's own under `review\.paths` in \.forge\.json/u);
});

test("a repository with no mark is told it is unplanted and given the command that plants it", async () => {
  const said = await rowIn(built("unplanted", { review: { lines: 9, paths: ["app"] } }, { mark: false }),
    "unplanted");
  assert.match(said, /^\[ {2}ok {2}\] review/u);
  assert.match(said, /refs\/forge\/reviewed is unplanted, so nothing is counted yet/u);
  assert.match(said, /git update-ref refs\/forge\/reviewed <that commit>/u);
  assert.doesNotMatch(said, /0 changed line/u);
});

test("a declaration that counts prints the count since the mark, with the project's own file as its source", async () => {
  const room = built("short", { review: { lines: 9, paths: ["app"] } });
  wrote(room, join("app", "grew.txt"), 4);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "four lines");
  const said = await rowIn(room, "short");
  assert.match(said, /4 changed line\(s\) in 1 file\(s\) under app since/u);
  assert.match(said, /short of the 9 that earn a reading of what has landed {2}← \.forge\.json$/u);
});

test("the row says a reading is owed once the count reaches the volume in force", async () => {
  const room = built("owed", { review: { lines: 4, paths: ["app"] } });
  wrote(room, join("app", "grew.txt"), 4);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "four lines");
  const said = await rowIn(room, "owed");
  assert.match(said, /at or past the 4 that earn a reading of what has landed/u);
});
