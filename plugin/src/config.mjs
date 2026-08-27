/* The account's credentials and this CLI's own cache, kept outside every repository.

   A token in a repo file is a token one `git add -A` away from a remote, and `.mcp.json` is
   git-ignored precisely because it holds one. This is the same file `vi-natural` keeps its key in,
   one directory over, at mode 0600. */
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

/* Runs once and remembers that it ran, not what it returned — four of the seven hand-rolled memos
   this replaced tested the value for truthiness, so each would silently re-run on a valid `null`. */
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

/* 0600 from the moment it exists: a token written world-readable and chmodded afterwards was
   world-readable for the length of the write, and `w` sets the mode on create only — a temp file a
   crashed run left behind would take the token at whatever permissions it already had. */
export const saveConfig = (values) => {
  mkdirSync(configDir("forge"), { recursive: true });
  const merged = { ...userConfig(), ...values };
  const temporary = `${CONFIG_PATH}.tmp`;
  rmSync(temporary, { force: true });
  const handle = openSync(temporary, "w", 0o600);
  try {
    writeFileSync(handle, `${JSON.stringify(merged, null, 2)}\n`);
  } finally {
    closeSync(handle);
  }
  renameSync(temporary, CONFIG_PATH);
  Object.assign(userConfig(), merged);
  return CONFIG_PATH;
};
