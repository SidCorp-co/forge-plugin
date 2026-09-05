// Both CLIs on PATH, because the skills tell the agent to run them. No event, so no readEvent.
import { lstatSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { pluginCopy } from "../tools/plugin-copy.mjs";
import { hookOff } from "./hook-switch.mjs";

export const linkCli = (root) => {
  if (!root || hookOff("link-cli")) return;
  const bin = join(homedir(), ".local", "bin");
  try {
    mkdirSync(bin, { recursive: true });
  } catch {
    return;
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

  /* Said at the start because it cannot be noticed later: the registration is this copy's. */
  const copy = pluginCopy(root);
  if (copy?.stale) {
    process.stdout.write(
      `${copy.name} ${copy.running} is running in this session and ${copy.installed} is installed: a `
        + "session keeps the registration it started with — which hooks run, on which events, and the "
        + "skills it loaded. The gate code behind them is already this session's. Restart for the rest.\n",
    );
  }
};
