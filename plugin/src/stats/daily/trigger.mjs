/* The schedule of the daily report is a session start: the first one after a day ends, in a project
   that asked for it, starts a writer for that day and does not wait for it. A system scheduler would
   be an entry on the person's own machine, which is not this plugin's to write — docs/cli/stats.md. */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { yesterday } from "./day.mjs";
import { markPath, pagePath, reportsWhere, writerHolds } from "./store.mjs";
import { projectFileAt } from "../../resolve/settings.mjs";

/** The project key's values: `off`, where a project that never set it stands, and `daily`. */
export const REPORT_MODES = ["off", "daily"];
const ON = "daily";

/* The mark is taken before the writer exists, under this process's own id, so a second start in
   the same instant finds it held; the writer's id replaces it once there is one. */
const taken = (dir, day) => {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(markPath(dir, day), `${process.pid}\n`, { flag: "wx" });
    return true;
  } catch {
    return false;
  }
};

/** Starts yesterday's writer where this project asked for one and the day is neither written nor
 *  being written, and answers with what it started; null where it started nothing. Never throws:
 *  a session start is no place to fail. */
export const dailyDue = (root, { start = spawn, now = Date.now(), cwd = process.cwd() } = {}) => {
  try {
    if (projectFileAt(cwd)?.report !== ON) return null;
    const where = reportsWhere();
    if (where.refused) return null;
    const day = yesterday(now);
    if (existsSync(pagePath(where.dir, day)) || writerHolds(where.dir, day) || !taken(where.dir, day)) return null;
    const child = start(process.execPath, [join(root, "bin", "forge"), "stats", "daily", "--day", day],
      { cwd, detached: true, stdio: "ignore" });
    writeFileSync(markPath(where.dir, day), `${child.pid}\n`);
    child.unref();
    return { day, pid: child.pid };
  } catch {
    return null;
  }
};
