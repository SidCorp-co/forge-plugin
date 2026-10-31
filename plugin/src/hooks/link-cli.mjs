// Both CLIs on PATH, because the skills tell the agent to run them, each reaching the copy of the
// session that typed it. No event, so no readEvent.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { installedCopy, pluginCopy } from "../tools/plugin-copy.mjs";
import { ON_PATH, placeDispatcher, tellSession } from "../tools/copies/on-path.mjs";
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
  /* The session's own root, before anything that can fail: it is what its typed \`forge\` runs. */
  tellSession(root);
  const bin = join(homedir(), ".local", "bin");
  try {
    mkdirSync(bin, { recursive: true });
  } catch {
    return;
  }
  for (const name of ON_PATH) process.stdout.write(placeDispatcher(join(bin, name), name, root));

  /* Yesterday's report, where this project asked for one: started and never waited on. */
  dailyDue(root);

  /* Said at the start because it cannot be noticed later: the registration is this copy's. */
  const copy = pluginCopy(root);
  if (copy && !installedCopy(root)) {
    process.stdout.write(`${copy.name} ${copy.running} is loaded by path from ${root} (--plugin-dir): its hooks `
      + `and the \`forge\` calls this session makes run that copy, not the installed ${copy.installed}.\n`);
  } else if (copy?.stale) {
    process.stdout.write(
      `${copy.name} ${copy.running} is running in this session and ${copy.installed} is installed: a `
        + "session keeps the registration it started with — which hooks run, on which events, and the "
        + "skills it loaded. The gate code behind them is already this session's. Restart for the rest.\n",
    );
  }
};
