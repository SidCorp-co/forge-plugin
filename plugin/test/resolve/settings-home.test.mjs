/* The configuration directory is redirectable, and this refusal printed the path it would have read with the variable left alone — so a run under a temporary home was sent to a file nothing had opened (ISS-189). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

/* One row of the usage table says what it says because of a key this machine saved, and the table is
   a module-level constant. Built as the module loads, that row is fixed to whatever home was set
   before the import — so a process that redirects its own home afterwards, as every fixture here
   does, is answered out of the developer's file (ISS-2129). Run in a child, the import under one
   home and the read under another, because what is being held is the moment of the read. */
const roomSaving = (name, saved) => {
  const home = tempRoom(name);
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify(saved));
  return home;
};

test("a row of the table whose words follow a saved key is read at the call, not at the import", () => {
  const first = roomSaving("settings-home-import-", {});
  const later = roomSaving("settings-home-read-", { coolifyRoute: "instance" });
  const visibility = new URL("../../src/resolve/visibility.mjs", import.meta.url).href;
  const ran = spawnSync(process.execPath, ["--input-type=module", "-e",
    `process.env.XDG_CONFIG_HOME = ${JSON.stringify(first)};`
    + ` const { usageOf } = await import(${JSON.stringify(visibility)});`
    + ` process.env.XDG_CONFIG_HOME = ${JSON.stringify(later)};`
    + " console.log(usageOf(\"coolify\"));"],
  { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: first } });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /whoami/u,
    `the row answered out of the home set before the import: ${ran.stdout}${ran.stderr}`);
});
