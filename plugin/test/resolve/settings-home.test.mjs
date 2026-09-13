/* The configuration directory is redirectable, and this refusal printed the path it would have read with the variable left alone — so a run under a temporary home was sent to a file nothing had opened (ISS-189). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { tempRoom } from "../fixtures.mjs";

const CLI = fileURLToPath(new URL("../../src/cli.mjs", import.meta.url));

test("the refusal for an unresolved account names the file it read", () => {
  const home = tempRoom("settings-home-");
  const run = spawnSync(process.execPath, [CLI, "issue", "ISS-1"],
    { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home } });
  assert.notEqual(run.status, 0, run.stdout);
  assert.match(run.stderr, /No Forge endpoint/u, run.stderr);
  assert.ok(run.stderr.includes(join(home, "forge", "config.json")),
    `the file this call read, not the one it would have read elsewhere: ${run.stderr}`);
});
