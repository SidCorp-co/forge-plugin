/* The schedule of the reports is two acts of the project's own: a session start, and a release
   reading. The first session start after a day ends writes that day's page, which writes the current
   report after it; every other one, and every release reading, starts the current report's writer.
   Each is started detached and never waited on. A system scheduler would be an entry on the person's
   own machine, which is not this plugin's to write — docs/cli/stats.md. */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { yesterday } from "./day.mjs";
import { RELEASE, SESSION, triggersOf } from "../report/settings.mjs";
import { clearMark, markPath, pagePath, reportsWhere, takeMark, writerHolds } from "./store.mjs";
import { projectFileAt } from "../../resolve/settings.mjs";
import { PLUGIN_ROOT } from "../../tools/plugin-copy.mjs";

/** The project key's values: `off`, where a project that never set it stands, and `daily`. */
export const REPORT_MODES = ["off", "daily"];
const ON = "daily";

/* Whether the project standing at a directory asked for the reports and names this act. */
const asked = (cwd, act) => {
  const record = projectFileAt(cwd);
  return record?.report === ON && triggersOf(record?.reportOn).includes(act);
};

/* The writer, detached; null where it could not be started. A spawn that fails does so on a later
   tick, as an event, which `onError` hears. */
const started = (start, root, argv, cwd, onError = () => {}) => {
  let child;
  try {
    child = start(process.execPath, [join(root, "bin", "forge"), "stats", ...argv], { cwd, detached: true, stdio: "ignore" });
  } catch {
    return null;
  }
  child.on?.("error", () => onError(child));
  if (!child.pid) return null;
  child.unref();
  return child;
};

/* Yesterday's page where it is neither written nor being written: its writer's mark is taken before
   the writer exists, under this process's own id, so a second start in the same instant finds it
   held, and the writer's id replaces it once there is one. */
const dayWriter = (where, day, { start, root, cwd }) => {
  if (existsSync(pagePath(where.dir, day)) || writerHolds(where.dir, day) || !takeMark(where.dir, day)) return undefined;
  const child = started(start, root, ["daily", "--day", day], cwd, (one) => clearMark(where.dir, day, one.pid ?? process.pid));
  if (!child) {
    clearMark(where.dir, day);
    return null;
  }
  writeFileSync(markPath(where.dir, day), `${child.pid}\n`);
  return { day, pid: child.pid };
};

/* The current report's writer, which takes its own mark: a second one finding it held leaves the
   holder a flag to write once more, so nothing here has to judge the mark. */
const currentWriter = ({ start, root, cwd }) => {
  const child = started(start, root, ["report"], cwd);
  return child ? { current: true, pid: child.pid } : null;
};

/** At a session start, where this project asked for it: one writer, the day's where its page is
 *  owed. Answers with what it started, null where it started nothing. Never throws: a session start
 *  is no place to fail. */
export const dailyDue = (root, { start = spawn, now = Date.now(), cwd = process.cwd() } = {}) => {
  try {
    if (!asked(cwd, SESSION)) return null;
    const where = reportsWhere();
    if (where.refused) return null;
    const day = dayWriter(where, yesterday(now), { start, root, cwd });
    return day === undefined ? currentWriter({ start, root, cwd }) : day;
  } catch {
    return null;
  }
};

/** After a release reading is written for a checkout: the current report's writer, where that
 *  checkout's project asked for it. Never throws: the release it follows has already gone out. */
export const releaseDue = (cwd, { start = spawn, root = PLUGIN_ROOT } = {}) => {
  try {
    if (!asked(cwd, RELEASE) || reportsWhere().refused) return null;
    return currentWriter({ start, root, cwd });
  } catch {
    return null;
  }
};
