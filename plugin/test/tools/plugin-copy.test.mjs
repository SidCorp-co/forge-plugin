/* A session started before an update keeps the whole copy — the gate code and the registration — so a
   fix looks landed from the tree and is not what fired. Nobody can see that from inside the session. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

const HOOK = new URL("../../hooks/link-cli.mjs", import.meta.url).pathname;
const ROOT = new URL("../..", import.meta.url).pathname;

const started = (installed) => {
  const home = tempRoom("plugin-copy-");
  if (installed) {
    mkdirSync(join(home, ".claude", "plugins"), { recursive: true });
    writeFileSync(
      join(home, ".claude", "plugins", "installed_plugins.json"),
      JSON.stringify(installed),
    );
  }
  const run = spawnSync(process.execPath, [HOOK, ROOT], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
  });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

const record = (version) => ({
  version: 2,
  plugins: { "forge@forge-local": [{ scope: "user", version, lastUpdated: "2026-09-01T00:00:00.000Z" }] },
});

const mine = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8")).version;

test("a session running a copy the install has moved past is told to restart", () => {
  const said = started(record("99.0.0"));
  assert.match(said, /99\.0\.0 is installed/u);
  assert.match(said, new RegExp(`forge ${mine.replace(/\./gu, "\\.")} is running`, "u"));
  assert.match(said, /Restart/u);
});

test("the copy a session runs being the installed one is said nothing about", () => {
  assert.doesNotMatch(started(record(mine)), /Restart/u);
});

/* Two scopes can hold two versions, and which one a session loads is not this code's to know: one of
   them being the running copy is enough to say nothing. The message names the later install. */
test("a copy some record holds is not stale, whatever else is installed", () => {
  const two = {
    version: 2,
    plugins: {
      "forge@forge-local": [
        { scope: "user", version: mine, lastUpdated: "2026-09-01T00:00:00.000Z" },
        { scope: "project", version: "99.0.0", lastUpdated: "2026-09-02T00:00:00.000Z" },
      ],
    },
  };
  assert.doesNotMatch(started(two), /Restart/u);
  two.plugins["forge@forge-local"][0].version = "98.0.0";
  assert.match(started(two), /99\.0\.0 is installed/u, "and the later install is the one named");
  two.plugins["forge@forge-local"][1].version = mine;
  assert.doesNotMatch(started(two), /Restart/u, "whichever of the two holds it");
});

/* Another machine, another install scope, a shape that changed: none of those is a stale copy. */
test("an install record this cannot read is silence, not a warning", () => {
  assert.doesNotMatch(started(null), /Restart/u);
  assert.doesNotMatch(started({ version: 2 }), /Restart/u);
  assert.doesNotMatch(started({ version: 2, plugins: { "forge@forge-local": "not a list" } }), /Restart/u);
  assert.doesNotMatch(started({ version: 2, plugins: { "other@elsewhere": [{ version: "1.0.0" }] } }), /Restart/u);
});

test("the feedback folder is the checkout's, found beside this copy or through the marketplace record", async () => {
  const { feedbackDir } = await import("../../src/tools/plugin-copy.mjs");
  const room = tempRoom("feedback-dir-");
  try {
    const checkout = join(room, "checkout");
    mkdirSync(join(checkout, "feedback"), { recursive: true });
    writeFileSync(join(checkout, "feedback", "README.md"), "# shape\n");
    const plugin = (root, name) => {
      mkdirSync(join(root, ".claude-plugin"), { recursive: true });
      writeFileSync(join(root, ".claude-plugin", "plugin.json"), JSON.stringify({ name, version: "1.0.0" }));
    };
    plugin(join(checkout, "plugin"), "forge");
    mkdirSync(join(checkout, ".claude-plugin"));
    writeFileSync(
      join(checkout, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ plugins: [{ name: "forge", source: "./plugin" }] }),
    );
    const other = join(room, "other");
    mkdirSync(join(other, "feedback"), { recursive: true });
    mkdirSync(join(other, ".claude-plugin"));
    writeFileSync(join(other, "feedback", "README.md"), "# someone else's\n");
    writeFileSync(join(other, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins: [{ name: "x", source: "./p" }] }));
    const cache = join(room, "cache", "plugin");
    plugin(cache, "forge");
    const markets = join(room, "known_marketplaces.json");
    writeFileSync(markets, JSON.stringify({
      other: { source: { source: "directory", path: other } },
      local: { source: { source: "directory", path: checkout } },
    }));
    const none = join(room, "missing.json");
    assert.equal(feedbackDir(join(checkout, "plugin"), markets, none), join(checkout, "feedback"));
    assert.equal(feedbackDir(cache, markets, none), join(checkout, "feedback"), "one marketplace ships forge: the cache copy finds it");
    assert.equal(feedbackDir(cache, none, none), null, "no checkout reachable is no path at all");
    const twin = join(room, "twin");
    plugin(join(twin, "plugin"), "forge");
    mkdirSync(join(twin, "feedback"), { recursive: true });
    mkdirSync(join(twin, ".claude-plugin"));
    writeFileSync(join(twin, "feedback", "README.md"), "# a second forge\n");
    writeFileSync(join(twin, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins: [{ name: "forge", source: "./plugin" }] }));
    const both = join(room, "both.json");
    writeFileSync(both, JSON.stringify({
      twin: { source: { source: "directory", path: twin } },
      local: { source: { source: "directory", path: checkout } },
    }));
    assert.equal(feedbackDir(cache, both, none), null, "two marketplaces ship forge and no record says which installed this copy");
    const record = join(room, "installed_plugins.json");
    writeFileSync(record, JSON.stringify({ plugins: { "forge@local": [{ installPath: cache, version: "1.0.0" }] } }));
    assert.equal(feedbackDir(cache, both, record), join(checkout, "feedback"), "the install record names the marketplace");
    writeFileSync(record, JSON.stringify({ plugins: {
      "forge@twin": [{ installPath: join(room, "elsewhere"), version: "1.0.0" }],
      "forge@local": [{ installPath: cache, version: "1.0.0" }],
    } }));
    assert.equal(feedbackDir(cache, both, record), join(checkout, "feedback"), "the exact install path outranks a shared version");
    writeFileSync(record, JSON.stringify({ plugins: {
      "forge@twin": [{ installPath: join(room, "a"), version: "1.0.0" }],
      "forge@local": [{ installPath: join(room, "b"), version: "1.0.0" }],
    } }));
    assert.equal(feedbackDir(cache, both, record), null, "a version two marketplaces hold names neither");
    assert.equal(feedbackDir(cache, markets, record), null, "and an ambiguous record is not rescued by the one marketplace still known");
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});
