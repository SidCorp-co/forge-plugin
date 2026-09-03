/* A session started before an update keeps the whole copy — the gate code and the registration — so a
   fix looks landed from the tree and is not what fired. Nobody can see that from inside the session. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK = new URL("../../hooks/link-cli.mjs", import.meta.url).pathname;
const ROOT = new URL("../..", import.meta.url).pathname;

const started = (installed) => {
  const home = mkdtempSync(join(tmpdir(), "plugin-copy-"));
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
