/* The account's credentials, kept outside every repository.

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

const DIRECTORY = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "forge",
);

export const CONFIG_PATH = join(DIRECTORY, "config.json");

let cached;

export const userConfig = () => {
  if (cached !== undefined) return cached;
  try {
    cached = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    cached = {};
  }
  return cached;
};

/* 0600 from the moment it exists: a token written world-readable and chmodded afterwards was
   world-readable for the length of the write. */
export const saveConfig = (values) => {
  mkdirSync(DIRECTORY, { recursive: true });
  const merged = { ...userConfig(), ...values };
  const temporary = `${CONFIG_PATH}.tmp`;
  /* `w` applies the mode on create only, so a temp file a crashed run left behind would take the
     token at whatever permissions it already had. */
  rmSync(temporary, { force: true });
  const handle = openSync(temporary, "w", 0o600);
  try {
    writeFileSync(handle, `${JSON.stringify(merged, null, 2)}\n`);
  } finally {
    closeSync(handle);
  }
  renameSync(temporary, CONFIG_PATH);
  cached = merged;
  return CONFIG_PATH;
};
