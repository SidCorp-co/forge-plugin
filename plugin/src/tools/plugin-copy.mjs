/* A session loads the plugin once and keeps that copy — the hook code and the registration both — so
   an update lands for the next session, and the hook fixed an hour ago is not the hook that fired. */
import { existsSync, readFileSync } from "node:fs";
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

const recordsOf = (name, record) => {
  const held = read(record)?.plugins;
  if (!held || typeof held !== "object") return [];
  return Object.entries(held)
    .filter(([key]) => key.split("@")[0] === name)
    .flatMap(([, list]) => (Array.isArray(list) ? list : []))
    .filter((one) => typeof one?.version === "string");
};

/* Newest is the later install, never the higher version; a path the disk lost is no copy at all. */
const newestOf = (records) =>
  [...records].sort((a, b) => String(a.lastUpdated ?? "").localeCompare(String(b.lastUpdated ?? ""))).at(-1) ?? null;

/** What this copy is and what a session starting now would load, or nothing at all: an install record
 *  this cannot read is another machine's business. Stale is no record holding this version. */
export const pluginCopy = (root = HERE) => {
  const mine = read(join(root, ".claude-plugin", "plugin.json"));
  if (!mine?.name || !mine?.version) return null;
  const records = recordsOf(mine.name, RECORD);
  if (!records.length) return null;
  return {
    name: mine.name,
    running: mine.version,
    installed: newestOf(records).version,
    stale: !records.some((one) => one.version === mine.version),
  };
};

const shippedBy = (path, name) => {
  if (typeof path !== "string") return null;
  const ships = read(join(path, ".claude-plugin", "marketplace.json"))?.plugins ?? [];
  return ships.find((one) => one?.name === name && typeof one?.source === "string") ?? null;
};

/* The nearest checkout answers, runnable or not: falling through would run released code silently. */
const checkoutAbove = (from, name) => {
  for (let at = resolve(from); ; at = dirname(at)) {
    const mine = shippedBy(at, name);
    if (mine) return resolve(at, mine.source);
    if (dirname(at) === at) return null;
  }
};

const installedAbleToRun = (name, entry, record) => {
  const able = recordsOf(name, record)
    .filter((one) => typeof one.installPath === "string" && existsSync(join(one.installPath, entry)));
  const newest = newestOf(able);
  return newest ? { dir: newest.installPath, version: newest.version } : null;
};

const versionAt = (dir) => read(join(dir, ".claude-plugin", "plugin.json"))?.version ?? null;

/** Which copy a call through the link on PATH runs, and why that one: the checkout the working
 *  directory sits in, else the newest installed copy that resolves, else this one. `entry` defaults
 *  to this CLI's, which is the copy doctor asks about. */
export const copyToRun = ({ cwd = process.cwd(), entry = join("src", "cli.mjs"), root = HERE, record = RECORD } = {}) => {
  const name = read(join(root, ".claude-plugin", "plugin.json"))?.name;
  const installed = name ? installedAbleToRun(name, entry, record) : null;
  const checkout = name ? checkoutAbove(cwd, name) : null;
  if (checkout) {
    return { dir: checkout, version: versionAt(checkout), kind: "checkout", installed,
      why: `the working directory is inside the checkout that ships ${name}` };
  }
  if (installed) {
    return { ...installed, kind: "installed", installed,
      why: "no checkout at or above the working directory, and this is the newest install record that resolves" };
  }
  return { dir: resolve(root), version: versionAt(root), kind: "this", installed: null,
    why: "no checkout at or above the working directory and no install record that resolves, so the copy on PATH" };
};
