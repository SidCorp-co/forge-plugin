/* Which installed copy the dispatching session loaded and which one is installed now: a session keeps
   the registration and the roles it started with, so a dispatch made from it runs those, whatever has
   landed since. The loaded copy is the one whose cache directory existed when its process started,
   the reading stats/versions.mjs already makes for a transcript. */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cacheRoot, copyAt, installedCopies, UNRECORDED } from "../stats/versions.mjs";
import { freezesSession, pluginCopy } from "../tools/plugin-copy.mjs";

/* The restart set is spelt repository-relative, and a copy is the plugin directory alone. */
const IN_REPOSITORY = "plugin/";

/** When the process `pid` started, or null where `ps` gives no reading of it. */
export const startedAt = (pid) => {
  if (!/^\d+$/u.test(String(pid ?? ""))) return null;
  const run = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)],
    { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } });
  const at = run.status === 0 ? Date.parse(run.stdout.trim()) : Number.NaN;
  return Number.isFinite(at) ? at : null;
};

const filesIn = (root, at = "") => {
  let listed;
  try {
    listed = readdirSync(join(root, at), { withFileTypes: true });
  } catch {
    return [];
  }
  return listed.flatMap((one) => {
    const rel = at ? `${at}/${one.name}` : one.name;
    return one.isDirectory() ? filesIn(root, rel) : [rel];
  });
};

const bytes = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

/** Every file that differs between two copy directories, either side's alone included. */
export const movedBetween = (was, now) => {
  const names = [...new Set([...filesIn(was), ...filesIn(now)])].sort();
  return names.filter((name) => {
    const [left, right] = [bytes(join(was, name)), bytes(join(now, name))];
    return !(left && right && left.equals(right));
  });
};

/** The two copies and what separates them, or `unread` saying why they could not be read. `began` is
 *  when the dispatching session's process started, which a case hands in rather than a process. */
export const copiesFor = (began = startedAt(process.env.CLAUDE_PID)) => {
  const root = cacheRoot();
  const installed = pluginCopy()?.installed ?? null;
  if (!root || !installed) return { unread: "no install record on this machine names this plugin" };
  if (began === null) return { installed, unread: "the dispatching session's process start could not be read" };
  const copies = installedCopies(root);
  const loaded = copyAt(copies, began);
  if (loaded === UNRECORDED) return { installed, unread: "no copy in the cache is older than this session" };
  if (loaded === installed) return { installed, loaded, between: [], moved: [], frozen: [] };
  const order = copies.map((one) => one.copy);
  const between = order.slice(order.indexOf(loaded) + 1, order.indexOf(installed) + 1);
  const moved = movedBetween(join(root, loaded), join(root, installed));
  return { installed, loaded, between, moved,
    frozen: moved.filter((one) => freezesSession(`${IN_REPOSITORY}${one}`)) };
};
