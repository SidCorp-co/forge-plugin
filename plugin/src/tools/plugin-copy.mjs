/* A session keeps the registration it read at start; the code behind it is chosen per call, here,
   so a landed fix reaches an open session. `FROZEN` is what a restart is still owed for. */
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const installRecord = () => join(homedir(), ".claude", "plugins", "installed_plugins.json");
/** The directory of the copy this code runs from, the one holding `.claude-plugin/plugin.json`. */
export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

/* Newest is the later install, never the higher version. */
const newestOf = (records) =>
  [...records].sort((a, b) => String(a.lastUpdated ?? "").localeCompare(String(b.lastUpdated ?? ""))).at(-1) ?? null;

/** What this copy is and what a session starting now would load, or nothing at all: an install record
 *  this cannot read is another machine's business. Stale is no record holding this version. */
export const pluginCopy = (root = PLUGIN_ROOT) => {
  const mine = read(join(root, ".claude-plugin", "plugin.json"));
  if (!mine?.name || !mine?.version) return null;
  const records = recordsOf(mine.name, installRecord());
  if (!records.length) return null;
  return {
    name: mine.name,
    running: mine.version,
    installed: newestOf(records).version,
    stale: !records.some((one) => one.version === mine.version),
  };
};

/** This plugin's name, off the manifest of the copy at `root`; null where it names none. */
export const nameAt = (root) => read(join(root, ".claude-plugin", "plugin.json"))?.name ?? null;

export const installedPaths = (record = installRecord(), root = PLUGIN_ROOT) =>
  recordsOf(nameAt(root) ?? "", record).map((one) => one.installPath).filter((one) => typeof one === "string");

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

/** Whether a path sits inside a checkout that ships this plugin, which is somebody's source tree. */
export const insideCheckout = (from, root = PLUGIN_ROOT) => checkoutAbove(from, nameAt(root)) !== null;

/** Whether the copy at `root` is one an install put there: a record's own path, or a path under the
 *  cache the records point into, which is an older install the newest replaced. Anything else was
 *  loaded by path (`--plugin-dir`), and no install record answers for it. */
export const installedCopy = (root = PLUGIN_ROOT, record = installRecord()) => {
  const at = resolve(root);
  return installedPaths(record, root).some((one) => resolve(one) === at)
    || at.startsWith(join(dirname(record), "cache") + sep);
};

/** The plugin directory the session was started with by path (`--plugin-dir`), off the Claude Code
 *  process's own command line; null where it named none for this plugin, or none could be read. */
export const sessionPluginDir = (pid = process.env.CLAUDE_PID, root = PLUGIN_ROOT) => {
  let argv;
  try {
    argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
  } catch {
    return null;
  }
  const name = nameAt(root);
  /* A relative directory is the session's, read against where that process stands. */
  let from = "/";
  try {
    from = readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    /* an absolute --plugin-dir still reads */
  }
  for (const [at, one] of argv.entries()) {
    const given = one === "--plugin-dir" ? argv[at + 1] : one.startsWith("--plugin-dir=") ? one.slice(13) : null;
    const dir = given ? resolve(from, given) : null;
    if (dir && nameAt(dir) === name) return dir;
  }
  return null;
};

const installedAbleToRun = (name, entry, record) => {
  const able = recordsOf(name, record)
    .filter((one) => typeof one.installPath === "string" && existsSync(join(one.installPath, entry)));
  const newest = newestOf(able);
  return newest ? { dir: newest.installPath, version: newest.version, sha: newest.gitCommitSha ?? null } : null;
};

/** The newest installed copy of the plugin at `root` that holds `entry`, or null where no record resolves. */
export const installedToRun = (entry, root = PLUGIN_ROOT, record = installRecord()) =>
  installedAbleToRun(nameAt(root) ?? "", entry, record);

const versionAt = (dir) => read(join(dir, ".claude-plugin", "plugin.json"))?.version ?? null;

/** The copy running this, whatever any record holds: `copyToRun` answers which one the link would. */
export const hereCopy = (root = PLUGIN_ROOT) => ({ dir: resolve(root), version: versionAt(root) });

/* The copy a session loaded by path, which stands in for its install: the root its start wrote into
   its environment, where that names this plugin and no install, else its process's command line. */
const loadedBy = ({ root, record, registered, pid, session }) => {
  if (registered) return installedCopy(root, record) ? null : resolve(root);
  if (session && nameAt(session) === nameAt(root)) return installedCopy(session, record) ? null : resolve(session);
  return sessionPluginDir(pid, root);
};

/** Which copy a call through the link on PATH runs, and why that one: the checkout the working
 *  directory sits in, else the copy the session loaded by path, else the newest installed copy that
 *  resolves, else this one. `entry` defaults to this CLI's, which is the copy doctor asks about.
 *  `registered` is a hook's caller, whose session registered the copy at `root`; `pid` the Claude
 *  Code process a call through the link came from, and `session` the root its start wrote. A session loaded by path runs that copy: the
 *  installed one is another version, whose gates are not the ones its registration names. */
export const copyToRun = ({ cwd = process.cwd(), entry = join("src", "cli.mjs"), root = PLUGIN_ROOT, record = installRecord(), registered = false, pid = process.env.CLAUDE_PID, session = process.env.FORGE_PLUGIN_ROOT } = {}) => {
  const name = nameAt(root);
  const loaded = loadedBy({ root, record, registered, pid, session });
  const installed = loaded && existsSync(join(loaded, entry)) ? { ...hereCopy(loaded), sha: null }
    : name ? installedAbleToRun(name, entry, record) : null;
  const checkout = name ? checkoutAbove(cwd, name) : null;
  if (checkout) {
    return { ...hereCopy(checkout), kind: "checkout", installed,
      why: `the working directory is inside the checkout that ships ${name}` };
  }
  if (loaded && installed?.dir === loaded) {
    return { ...installed, kind: "inline", installed,
      why: `the session loaded ${loaded} by path (--plugin-dir) and no install record holds it, so `
        + `${registered ? "its hooks run" : "a call from it runs"} that copy and not the installed one` };
  }
  if (installed) {
    return { ...installed, kind: "installed", installed,
      why: "no checkout at or above the working directory, and this is the newest install record that resolves" };
  }
  return { ...hereCopy(root), kind: "this", installed: null,
    why: "no checkout at or above the working directory and no install record that resolves, so the copy on PATH" };
};

/* What an open session cannot pick up: the registration, the entries it names, their static graph
   — terminating here on node builtins — and the roles, on their own reason. docs/HOOKS.md. */
export const FROZEN = [
  "plugin/hooks/hooks.json",
  "plugin/hooks/gate.mjs",
  "plugin/hooks/link-cli.mjs",
  "plugin/src/tools/plugin-copy.mjs",
  "plugin/skills/",
  "plugin/agents/",
];

export const freezesSession = (path) =>
  FROZEN.some((one) => (one.endsWith("/") ? path.startsWith(one) : path === one));

/** What a registered entry runs: the chosen copy's module, else the entry's own — a failed hop runs
 *  the gates beside it rather than none. Only the load is tried, since what runs next owns fd 0. */
export const moduleToRun = async (entry, holds, own) => {
  const chosen = copyToRun({ entry, registered: true });
  const target = pathToFileURL(join(chosen.dir, entry)).href;
  const mine = pathToFileURL(own).href;
  const load = async (where) => {
    const held = await import(where);
    if (typeof held[holds] !== "function") throw new Error(`it exports no ${holds}() to run`);
    return held;
  };
  try {
    return await load(target);
  } catch (error) {
    if (target === mine) throw error;
    process.stderr.write(`forge hooks: ${join(chosen.dir, entry)} is the copy to run — ${chosen.why} `
      + `— and it did not load: ${error?.message ?? error}\n${own} answered this call instead.\n`);
    return load(mine);
  }
};
