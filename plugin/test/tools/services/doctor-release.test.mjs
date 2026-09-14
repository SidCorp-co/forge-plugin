/* A box behind the newest release looks exactly like a current one from inside itself, which is how
   one stale install produced sixteen filings over three days (ISS-1324). So every case here that
   matters is a box that is behind, or a box that cannot tell — the happy path proves nothing. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { releaseRows } from "../../../src/tools/services/doctor-release.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { patience } from "../../patience.mjs";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const NAME = JSON.parse(readFileSync(join(SRC, ".claude-plugin", "plugin.json"), "utf8")).name;
const CLI = join(SRC, "src", "cli.mjs");

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

const wrote = (at, path, held) => {
  mkdirSync(join(at, dirname(path)), { recursive: true });
  writeFileSync(join(at, path), typeof held === "string" ? held : JSON.stringify(held));
};

/* A real bare repository and a real checkout: the reading is `git ls-remote`, and a stub of it would
   leave the one call this row makes untested. */
const remote = (name, tags) => {
  const room = tempRoom(`release-${name}-`);
  const origin = join(room, "origin.git");
  git(room, "init", "--bare", "-b", "master", "origin.git");
  const tree = join(room, "checkout");
  mkdirSync(tree, { recursive: true });
  git(tree, "init", "-b", "master");
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(tree, "config", key, value);
  writeFileSync(join(tree, "one.txt"), "one\n");
  git(tree, "add", "one.txt");
  git(tree, "commit", "-m", "one");
  git(tree, "remote", "add", "origin", origin);
  git(tree, "push", "origin", "master");
  for (const tag of tags) {
    git(tree, "tag", tag);
    git(tree, "push", "origin", tag);
  }
  return { room, origin, tree };
};

/* The registration `claude plugin install` reads: a marketplace directory whose own manifest ships
   this plugin, with the plugin's tree under it. */
const registered = (home, at, version, market = "forge-local") => {
  wrote(home, join(".claude", "plugins", "known_marketplaces.json"), {
    [market]: { source: { source: "directory", path: at }, installLocation: at },
  });
  wrote(at, join(".claude-plugin", "marketplace.json"), { name: market, plugins: [{ name: NAME, source: "./plugin" }] });
  if (version) wrote(at, join("plugin", ".claude-plugin", "plugin.json"), { name: NAME, version });
};

const box = (name, { tags = ["v1.0.0", "v1.0.1", "v1.0.2"], source = "1.0.2" } = {}) => {
  const held = remote(name, tags);
  const home = tempRoom(`release-home-${name}-`);
  registered(home, held.tree, source);
  return { ...held, home };
};

const only = (rows) => {
  assert.equal(rows.length, 1, `one row, not ${rows.length}`);
  assert.equal(rows[0].label, "newest release");
  assert.notEqual(rows[0].level, "miss", "this row refuses nothing and moves no exit code");
  return rows[0];
};

test("a copy behind the newest released one is named with the newer version and the count", () => {
  const at = box("behind");
  const row = only(releaseRows({ home: at.home, running: "1.0.0" }));
  assert.equal(row.level, "note");
  assert.match(row.detail, /1\.0\.0 running/u);
  assert.match(row.detail, /1\.0\.2 released/u);
  assert.match(row.detail, /2 tagged release\(s\) newer than it/u);
  assert.match(row.detail, /claude plugin update forge@forge-local/u);
  assert.match(row.detail, /restart the session/u);
});

test("a running copy older than every tag is told that instead of a count it cannot make", () => {
  const at = box("pre-tag", { tags: ["v3.35.239", "v3.35.353"], source: "3.35.353" });
  const row = only(releaseRows({ home: at.home, running: "3.35.140" }));
  assert.match(row.detail, /every tagged release is newer than it/u);
  assert.doesNotMatch(row.detail, /\d+ tagged release\(s\)/u);
});

test("a source that is itself behind is named as the thing to move first", () => {
  const at = box("stale-source", { source: "1.0.0" });
  const row = only(releaseRows({ home: at.home, running: "1.0.0" }));
  assert.match(row.detail, new RegExp(`${at.tree.replaceAll(".", "\\.")} holds 1\\.0\\.0`, "u"));
  assert.match(row.detail, /has to reach 1\.0\.2 first, then/u);
});

test("a remote that answers with no version tag is said by name, never as agreement", () => {
  const at = box("untagged", { tags: [] });
  const row = only(releaseRows({ home: at.home, running: "1.0.0" }));
  assert.equal(row.level, "note");
  assert.match(row.detail, /not read: the remote carries no version tag/u);
  assert.doesNotMatch(row.detail, /and the one running/u);
});

test("an annotated release answers twice and is counted once", () => {
  const at = box("annotated", { tags: ["v1.0.0"] });
  for (const [tag, at_] of [["v1.0.1", "HEAD"], ["v1.0.2", "HEAD"]]) {
    git(at.tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "tag", "-a", "-m", tag, tag, at_);
    git(at.tree, "push", "origin", tag);
  }
  const row = only(releaseRows({ home: at.home, running: "1.0.0" }));
  assert.match(row.detail, /2 tagged release\(s\) newer than it/u);
});

test("a tag that is no dotted version counts as none at all", () => {
  const at = box("odd-tags", { tags: ["release-candidate", "latest"] });
  assert.match(only(releaseRows({ home: at.home, running: "1.0.0" })).detail, /no version tag/u);
});

test("no marketplace registration for this plugin is said by name, never as agreement", () => {
  const bare = tempRoom("release-home-none-");
  const row = only(releaseRows({ home: bare, running: "1.0.0" }));
  assert.equal(row.level, "note");
  assert.match(row.detail, /no marketplace registration/u);
  const other = tempRoom("release-home-other-");
  const at = tempRoom("release-other-market-");
  wrote(other, join(".claude", "plugins", "known_marketplaces.json"), { "other-local": { installLocation: at } });
  wrote(at, join(".claude-plugin", "marketplace.json"), { name: "other-local", plugins: [{ name: "widget", source: "./widget" }] });
  assert.match(only(releaseRows({ home: other, running: "1.0.0" })).detail, /no marketplace registration/u);
});

test("a registered directory with no remote is said by name, never as agreement", () => {
  const home = tempRoom("release-home-no-remote-");
  const at = tempRoom("release-no-remote-");
  registered(home, at, "1.0.0");
  const row = only(releaseRows({ home, running: "1.0.0" }));
  assert.equal(row.level, "note");
  assert.match(row.detail, /not read: git ls-remote origin exited/u);
  assert.doesNotMatch(row.detail, /and the one running/u);
});

test("an ask that never answers is bounded, and comes back as an unknown rather than a wait", () => {
  const at = box("slow");
  git(at.tree, "remote", "set-url", "origin", "ext::sleep 30");
  const began = Date.now();
  const row = only(releaseRows({ home: at.home, running: "1.0.0", ms: 700 }));
  assert.ok(Date.now() - began < patience(5000), `the ask was not bounded: ${Date.now() - began}ms`);
  assert.equal(row.level, "note");
  assert.match(row.detail, /not read: (the remote did not answer inside 0\.7s|git ls-remote origin exited)/u);
});

test("a copy that is the newest released one is one green row naming where that was read", () => {
  const at = box("current");
  const row = only(releaseRows({ home: at.home, running: "1.0.2" }));
  assert.equal(row.level, "ok");
  assert.match(row.detail, /1\.0\.2 — the newest released version, and the one running/u);
  assert.match(row.detail, new RegExp(`git ls-remote origin in ${at.tree.replaceAll(".", "\\.")}`, "u"));
});

test("a copy ahead of every released one is said to be ahead, never called the released one", () => {
  const at = box("ahead");
  const row = only(releaseRows({ home: at.home, running: "1.1.0" }));
  assert.equal(row.level, "ok");
  assert.match(row.detail, /1\.1\.0 running, 1\.0\.2 the newest released — this copy is ahead of every release/u);
  assert.doesNotMatch(row.detail, /and the one running/u);
});

/* git's own default remote is the branch's upstream, and a release publishes to origin: a box whose
   checkout tracks a second remote would otherwise agree with whichever tags that one happens to hold. */
test("the remote asked is the one a release publishes to, not whichever the branch tracks", () => {
  const at = box("two-remotes");
  const stale = remote("two-remotes-upstream", ["v1.0.0"]);
  git(at.tree, "remote", "add", "upstream", stale.origin);
  git(at.tree, "fetch", "upstream");
  git(at.tree, "branch", "--set-upstream-to=upstream/master", "master");
  const row = only(releaseRows({ home: at.home, running: "1.0.0" }));
  assert.equal(row.level, "note");
  assert.match(row.detail, /1\.0\.0 running, 1\.0\.2 released/u);
  assert.match(row.detail, /git ls-remote origin in /u);
});

/* The one case that runs the verb: a row this composes and the report never prints is a green report
   in front of a box three days behind. */
test("the report asks the remote and writes nothing to the tree it asked through", () => {
  const at = box("reported", { tags: ["v998.0.0", "v999.0.0"], source: "999.0.0" });
  const before = [git(at.tree, "rev-parse", "HEAD").stdout, git(at.tree, "show-ref").stdout,
    git(at.tree, "status", "--porcelain").stdout];
  const work = tempRoom("release-cwd-");
  writeFileSync(join(work, ".forge.json"), JSON.stringify({ slug: "scratch" }));
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    cwd: work,
    env: { PATH: process.env.PATH, HOME: at.home, XDG_CONFIG_HOME: join(at.home, ".config") },
  });
  assert.match(run.stdout, /\[ note \] newest release\s+\S+ running, 999\.0\.0 released/u);
  assert.deepEqual([git(at.tree, "rev-parse", "HEAD").stdout, git(at.tree, "show-ref").stdout,
    git(at.tree, "status", "--porcelain").stdout], before);
});
