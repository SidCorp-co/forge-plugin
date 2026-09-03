#!/usr/bin/env node
// Both CLIs on PATH, because the skills tell the agent to run them. No event, so no readEvent.
import { lstatSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { hookOff } from "../src/hooks/hook-switch.mjs";
import { pluginCopy } from "../src/tools/plugin-copy.mjs";

const root = process.argv[2];
if (!root || hookOff("link-cli")) process.exit(0);
const bin = join(homedir(), ".local", "bin");
try {
  mkdirSync(bin, { recursive: true });
} catch {
  process.exit(0);
}
for (const name of ["forge", "vi-natural"]) {
  const link = join(bin, name);
  let held = null;
  try {
    held = lstatSync(link);
  } catch {
    /* nothing there yet */
  }
  // Only our own link is replaced: anything else is somebody's install, not ours to delete.
  if (held && !held.isSymbolicLink()) {
    process.stdout.write(`${link} exists and is not a symlink: \`${name}\` on PATH is not this plugin's.\n`);
    continue;
  }
  try {
    if (held) unlinkSync(link);
    symlinkSync(join(root, "bin", name), link);
  } catch {
    /* a link we cannot write is not worth failing a session start over */
  }
}

/* Said at the start because it cannot be noticed later: which gates ran came from the copy named here. */
const copy = pluginCopy(root);
if (copy?.stale) {
  process.stdout.write(
    `${copy.name} ${copy.running} is running in this session and ${copy.installed} is installed: a `
      + "session keeps the copy it started with, code and registration both. Restart to pick it up.\n",
  );
}
