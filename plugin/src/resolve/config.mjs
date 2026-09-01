/* The account's credentials and this CLI's cache, kept outside every repository at 0600 from the
   moment the file exists. docs/FORGE-CLI.md. */
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

export const configDir = (name) =>
  join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), name);

export const CONFIG_PATH = join(configDir("forge"), "config.json");

/* Remembers THAT it ran, not what it returned: a truthiness memo re-runs on a valid null. */
export const once = (produce) => {
  let value;
  let ran = false;
  return (...args) => {
    if (!ran) {
      value = produce(...args);
      ran = true;
    }
    return value;
  };
};

export const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

export const userConfig = once(() => readJson(CONFIG_PATH) ?? {});

/* `w` sets the mode on create only, so a temp file left by a crashed run would keep its own. */
/* The temporary name carries the writer's pid: two processes sharing one would interleave a file
   the survivor then renames into place. */
/* A writer killed between the open and the rename leaves its temp file behind, and the pid in the name
   means nothing reuses it. Swept on the next write, since nothing else here runs to clean up. */
const STRANDED_MS = 60_000;

const sweepStranded = (path) => {
  const room = dirname(path);
  const mine = basename(path);
  try {
    for (const name of readdirSync(room)) {
      if (!name.startsWith(`${mine}.`) || !name.endsWith(".tmp")) continue;
      const full = join(room, name);
      if (Date.now() - statSync(full).mtimeMs > STRANDED_MS) rmSync(full, { force: true });
    }
  } catch {
    /* a directory that cannot be read holds nothing this can clean */
  }
};

export const writeJsonPrivate = (path, value) => {
  const temporary = `${path}.${process.pid}.tmp`;
  sweepStranded(path);
  rmSync(temporary, { force: true });
  const handle = openSync(temporary, "w", 0o600);
  try {
    writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`);
  } finally {
    closeSync(handle);
  }
  renameSync(temporary, path);
};

export const saveConfig = (values) => {
  mkdirSync(configDir("forge"), { recursive: true });
  const merged = { ...userConfig(), ...values };
  writeJsonPrivate(CONFIG_PATH, merged);
  Object.assign(userConfig(), merged);
  return CONFIG_PATH;
};
