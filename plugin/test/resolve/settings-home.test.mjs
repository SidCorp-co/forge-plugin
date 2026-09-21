/* The configuration directory is redirectable, and this refusal printed the path it would have read with the variable left alone — so a run under a temporary home was sent to a file nothing had opened (ISS-189). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { projectRoom, tempRoom } from "../fixtures.mjs";

const CLI = fileURLToPath(new URL("../../src/cli.mjs", import.meta.url));

/* From a checkout this machine has a record of, so the call gets past the project's slug and as far
   as the account: a directory naming no project refuses for that instead, and this case would then
   be pinning a sentence about something else entirely. */
test("the refusal for an unresolved account names the file it read", () => {
  const home = tempRoom("settings-home-");
  const cwd = projectRoom(tempRoom("settings-home-cwd-"), home, { slug: "settings-home" });
  const run = spawnSync(process.execPath, [CLI, "issue", "ISS-1"],
    { encoding: "utf8", cwd, env: { ...process.env, XDG_CONFIG_HOME: home } });
  assert.notEqual(run.status, 0, run.stdout);
  assert.match(run.stderr, /No Forge endpoint/u, run.stderr);
  assert.ok(run.stderr.includes(join(home, "forge", "config.json")),
    `the file this call read, not the one it would have read elsewhere: ${run.stderr}`);
});
