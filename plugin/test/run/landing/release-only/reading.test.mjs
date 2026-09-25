/* The reading the landing hands back on: a file a release writes its number into moved only there,
   or moved at all. Every case is a move that reads as a release where it is not one, since that is
   the direction that would land an edit nobody judged (ISS-2516). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";

const { changeMoved, releaseOnly } = await import("../../../../../tools/run/landing.mjs");

const git = (room, ...args) => spawnSync("git", args, { cwd: room, encoding: "utf8" });
const sha = (room, rev) => git(room, "rev-parse", rev).stdout.trim();

const LOCK = "package-lock.json";
const MANIFEST = join("plugin", ".claude-plugin", "plugin.json");
const lock = (version, dependency = "1.2.3") => ({
  name: "scratch", version, lockfileVersion: 3,
  packages: { "": { name: "scratch", version }, "node_modules/left": { version: dependency } },
});
const json = (value, indent = 2) => `${JSON.stringify(value, null, indent)}\n`;

/** A repository holding `path` at `was` and then at `now`, and the two commits. */
const twice = (path, was, now) => {
  const room = tempRoom("release-only-");
  git(room, "init", "-q", "-b", "master");
  git(room, "config", "user.email", "t@t");
  git(room, "config", "user.name", "t");
  const at = (text, subject) => {
    mkdirSync(join(room, dirname(path)), { recursive: true });
    writeFileSync(join(room, path), text);
    git(room, "add", path);
    git(room, "commit", "-qm", subject);
    return sha(room, "HEAD");
  };
  return { room, from: at(was, "before"), to: at(now, "after") };
};

test("a lock whose two version fields alone moved reads as the release's", () => {
  const { room, from, to } = twice(LOCK, json(lock("1.0.0")), json(lock("1.0.1")));
  assert.equal(releaseOnly(room, from, to, LOCK), true);
  assert.deepEqual(changeMoved(room, from, to, [LOCK]), { moved: [], release: [LOCK] });
});

test("a lock whose dependency moved beside its version reads as a move", () => {
  const { room, from, to } = twice(LOCK, json(lock("1.0.0")), json(lock("1.0.1", "1.2.4")));
  assert.equal(releaseOnly(room, from, to, LOCK), false);
  assert.deepEqual(changeMoved(room, from, to, [LOCK]), { moved: [LOCK], release: [] });
});

test("a dependency pinned at the release's own number and moved with it reads as a move", () => {
  const { room, from, to } = twice(LOCK, json(lock("1.0.0", "1.0.0")), json(lock("1.0.1", "1.0.1")));
  assert.equal(releaseOnly(room, from, to, LOCK), false);
});

test("a manifest re-indented beside its version reads as a move", () => {
  const was = { name: "scratch", version: "1.0.0" };
  const { room, from, to } = twice(MANIFEST, json(was), json({ ...was, version: "1.0.1" }, 4));
  assert.equal(releaseOnly(room, from, to, MANIFEST), false);
});

test("a declared file that no longer parses reads as a move", () => {
  const { room, from, to } = twice("package.json", json({ version: "1.0.0" }), "{ \"version\": \"1.0.1\",\n");
  assert.equal(releaseOnly(room, from, to, "package.json"), false);
});

test("a file the release writes nothing into reads as a move, whatever field moved", () => {
  const path = join("docs", "data.json");
  const { room, from, to } = twice(path, json({ version: "1.0.0" }), json({ version: "1.0.1" }));
  assert.equal(releaseOnly(room, from, to, path), false);
  assert.deepEqual(changeMoved(room, from, to, [path]), { moved: [path], release: [] });
});
