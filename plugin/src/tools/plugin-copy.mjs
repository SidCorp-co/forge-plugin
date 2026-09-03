/* A session loads the plugin once and keeps that copy — the hook code and the registration both — so
   an update lands for the next session, and the hook fixed an hour ago is not the hook that fired. */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RECORD = join(homedir(), ".claude", "plugins", "installed_plugins.json");
const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const read = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

/** What this copy is and what a session starting now would load, or nothing at all: an install record
 *  this cannot read is another machine's business. Stale is no record holding this version. */
export const pluginCopy = (root = HERE) => {
  const mine = read(join(root, ".claude-plugin", "plugin.json"));
  if (!mine?.name || !mine?.version) return null;
  const held = read(RECORD)?.plugins;
  if (!held || typeof held !== "object") return null;
  const records = Object.entries(held)
    .filter(([key]) => key.split("@")[0] === mine.name)
    .flatMap(([, list]) => (Array.isArray(list) ? list : []))
    .filter((one) => typeof one?.version === "string");
  if (!records.length) return null;
  const newest = records.sort((a, b) =>
    String(a.lastUpdated ?? "").localeCompare(String(b.lastUpdated ?? ""))).at(-1);
  return {
    name: mine.name,
    running: mine.version,
    installed: newest.version,
    stale: !records.some((one) => one.version === mine.version),
  };
};
