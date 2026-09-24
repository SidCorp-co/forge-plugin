// Both CLIs on PATH, because the skills tell the agent to run them. No event, so no readEvent.
import { lstatSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { pluginCopy } from "../tools/plugin-copy.mjs";
import { writeStubs } from "../tools/services/skill-stubs.mjs";
import { hookOff } from "./hook-switch.mjs";
import { dailyDue } from "../stats/daily/trigger.mjs";

const stubSaid = ({ slug, dropped }) => (dropped.length
  ? `${slug}'s description no longer names ${dropped.join(", ")}, which this machine has saved nothing for`
  : `${slug}'s description is back to what this copy ships`);

/* The host reads a stub off disk before any of this runs, so the write lands for the session after
   this one and the one it lands in has to be told which text it is holding. A session start is no
   place to throw: an unwritable copy leaves the stub as it was. */
const sayStubs = (root) => {
  let written = [];
  try {
    written = writeStubs(root);
  } catch {
    return;
  }
  if (!written.length) return;
  process.stdout.write(`${written.map(stubSaid).join("; ")}. A session is handed its skills at its `
    + "start, so this one holds the text from before that write and the next will not. "
    + "`forge doctor` names it.\n");
};

export const linkCli = (root) => {
  if (!root || hookOff("link-cli")) return;
  sayStubs(root);
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

  /* Yesterday's report, where this project asked for one: started and never waited on. */
  dailyDue(root);

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
