/* This one runs at every session start, in whatever `~/.local/bin` the machine already has. What
   sits there may be somebody else's install of the same name, and deleting it is not recoverable. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK = join(PLUGIN, "hooks", "link-cli.mjs");

const room = () => {
  const home = mkdtempSync(join(tmpdir(), "link-home-"));
  mkdirSync(join(home, ".local", "bin"), { recursive: true });
  return home;
};

const linking = (home) =>
  spawnSync(process.execPath, [HOOK, PLUGIN], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
  });

const OWN = "#!/bin/sh\necho somebody else's forge\n";

test("a forge that is not a symlink is named and left where it is", () => {
  const home = room();
  const theirs = join(home, ".local", "bin", "forge");
  writeFileSync(theirs, OWN);
  const run = linking(home);
  assert.equal(readFileSync(theirs, "utf8"), OWN, "the file is still theirs");
  assert.match(run.stdout, /`forge` on PATH is not this plugin's/u);
});

test("a link an earlier session left is repointed", () => {
  const home = room();
  const link = join(home, ".local", "bin", "vi-natural");
  symlinkSync(join(home, "moved-away"), link);
  linking(home);
  assert.equal(readlinkSync(link), join(PLUGIN, "bin", "vi-natural"));
});

test("an empty bin gets both", () => {
  const home = room();
  linking(home);
  for (const name of ["forge", "vi-natural"]) {
    assert.equal(readlinkSync(join(home, ".local", "bin", name)), join(PLUGIN, "bin", name));
  }
});
