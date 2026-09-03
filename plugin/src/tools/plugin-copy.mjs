/* A session loads the plugin once and keeps that copy — the hook code and the registration both — so
   an update lands for the next session, and the hook fixed an hour ago is not the hook that fired. */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RECORD = join(homedir(), ".claude", "plugins", "installed_plugins.json");
const MARKETS = join(homedir(), ".claude", "plugins", "known_marketplaces.json");
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

const folderOf = (path, name) => {
  if (typeof path !== "string") return null;
  const ships = read(join(path, ".claude-plugin", "marketplace.json"))?.plugins ?? [];
  const mine = ships.find((one) => one?.name === name && typeof one?.source === "string");
  if (!mine) return null;
  const folder = join(path, mine.source, "..", "feedback");
  return existsSync(join(folder, "README.md")) ? folder : null;
};

/* `name@marketplace` in the install record is the one link from a cache copy to the marketplace that
   supplied it, since two may ship this name. Undefined: no record; null: a record naming two. */
const marketOf = (root, name, version, record) => {
  const held = Object.entries(read(record)?.plugins ?? {})
    .map(([key, list]) => [key.split("@"), Array.isArray(list) ? list : []])
    .filter(([[plugin]]) => plugin === name);
  if (!held.length) return undefined;
  const byPath = held.find(([, list]) => list.some((one) => one?.installPath === root));
  if (byPath) return byPath[0][1];
  const byVersion = held.filter(([, list]) => list.some((one) => one?.version === version));
  return byVersion.length === 1 ? byVersion[0][0][1] : null;
};

/** The checkout's feedback/ folder: above this plugin directory when this copy is the checkout, else
 *  above the source directory of the marketplace that installed this copy — never a cache copy, never
 *  another marketplace's folder. Null when no checkout is reachable from here. */
export const feedbackDir = (root = HERE, markets = MARKETS, record = RECORD) => {
  const here = join(root, "..", "feedback");
  if (existsSync(join(here, "README.md"))) return here;
  const mine = read(join(root, ".claude-plugin", "plugin.json"));
  if (!mine?.name) return null;
  const known = read(markets) ?? {};
  const market = marketOf(resolve(root), mine.name, mine.version, record);
  if (market) return folderOf(known[market]?.source?.path, mine.name);
  if (market === null) return null;
  const folders = Object.values(known).map((one) => folderOf(one?.source?.path, mine.name)).filter(Boolean);
  return folders.length === 1 ? folders[0] : null;
};
