/* The account's credentials and this CLI's cache, kept outside every repository at 0600 from the
   moment the file exists. docs/FORGE-CLI.md. */
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
export const writeJsonPrivate = (path, value) => {
  const temporary = `${path}.${process.pid}.tmp`;
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
