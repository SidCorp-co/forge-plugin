/* The reading a whole commit gets: a release where the version moved and every file it touched is a
   release file moved only in the fields a release writes, and a change otherwise. Both readers act
   on it — the ship leaves such a commit out of the change's own, and a rejected push resets it away
   — so a content edit riding a version bump read as the release's is dropped from the one and
   destroyed by the other (ISS-2520). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { tempRoom } from "../../../../../plugin/test/fixtures.mjs";

const { onlyRelease } = await import("../../../../run/landing.mjs");
const { unwound } = await import("../../../../run/release/version.mjs");

const git = (room, ...args) => spawnSync("git", args, { cwd: room, encoding: "utf8" });
const sha = (room, rev) => git(room, "rev-parse", rev).stdout.trim();

const MANIFEST = "package.json";
const LOCK = "package-lock.json";
const PLUGIN = join("plugin", ".claude-plugin", "plugin.json");
const json = (value, indent = 2) => `${JSON.stringify(value, null, indent)}\n`;

/** The three files a release writes, at `version`, and whatever else a case moves beside it. */
const files = (version, { dependency = "1.2.3", locked = "1.2.3", indent = 2 } = {}) => ({
  [MANIFEST]: json({ name: "scratch", version, dependencies: { left: dependency } }),
  [LOCK]: json({ name: "scratch", version, lockfileVersion: 3,
    packages: { "": { name: "scratch", version }, "node_modules/left": { version: locked } } }),
  [PLUGIN]: json({ name: "scratch", version }, indent),
});

const write = (room, held) => {
  for (const [path, text] of Object.entries(held)) {
    mkdirSync(join(room, dirname(path)), { recursive: true });
    writeFileSync(join(room, path), text);
  }
  git(room, "add", "-A");
};

/** A repository at 1.0.0 and a commit on top of it holding `now`. */
const bumped = (now) => {
  const room = tempRoom("release-commit-");
  git(room, "init", "-q", "-b", "master");
  git(room, "config", "user.email", "t@t");
  git(room, "config", "user.name", "t");
  write(room, files("1.0.0"));
  git(room, "commit", "-qm", "the release files");
  write(room, now);
  git(room, "commit", "-qm", "chore(release): 1.0.1");
  return { room, head: sha(room, "HEAD") };
};

test("a commit moving only the version fields of the release files reads as release-only", () => {
  const { room, head } = bumped(files("1.0.1"));
  assert.equal(onlyRelease(room, head), true);
});

test("a version bump that also moves a dependency of the manifest reads as a change", () => {
  const { room, head } = bumped(files("1.0.1", { dependency: "1.2.4" }));
  assert.equal(onlyRelease(room, head), false);
});

test("a version bump that also renames the package reads as a change", () => {
  const renamed = { ...files("1.0.1"), [MANIFEST]: json({ name: "renamed", version: "1.0.1", dependencies: { left: "1.2.3" } }) };
  const { room, head } = bumped(renamed);
  assert.equal(onlyRelease(room, head), false);
});

test("a version bump that also moves a locked package reads as a change", () => {
  const { room, head } = bumped(files("1.0.1", { locked: "1.2.4" }));
  assert.equal(onlyRelease(room, head), false);
});

test("a version bump that re-indents a release file reads as a change", () => {
  const { room, head } = bumped(files("1.0.1", { indent: 4 }));
  assert.equal(onlyRelease(room, head), false);
});

test("a version bump beside a file no release writes reads as a change", () => {
  const { room, head } = bumped({ ...files("1.0.1"), "one.mjs": "the change\n" });
  assert.equal(onlyRelease(room, head), false);
});

/** The version commit this run made, as the version step records it, in a clean tree. */
const madeHere = (now) => {
  const { room, head } = bumped(now);
  writeFileSync(join(sha(room, "--absolute-git-dir"), "forge-ship-bump"), `${head}\n`);
  return { room, head };
};

test("a rejected push undoes a version commit this run made that moved only version fields", () => {
  const { room, head } = madeHere(files("1.0.1"));
  assert.match(unwound(room), /is undone/u);
  assert.equal(sha(room, "HEAD"), sha(room, `${head}^`));
});

test("a rejected push leaves standing a version commit that also moved another field", () => {
  const { room, head } = madeHere(files("1.0.1", { dependency: "1.2.4" }));
  assert.equal(unwound(room), "");
  assert.equal(sha(room, "HEAD"), head, "the commit carrying the dependency's move was reset away");
});
