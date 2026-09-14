/* Whether a path an issue body names is one the tree a wave would be built in holds — canonical on
   both sides, a lexical prefix passing for a symlink that points out of the tree. Why the reading
   is the dispatcher's tree, and what a null root means for it: docs/cli/next.md. */
import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve, sep } from "node:path";

export const treeAt = (directory) => {
  const { status, stdout } = spawnSync("git", ["rev-parse", "--show-toplevel"],
    { cwd: directory, encoding: "utf8" });
  const said = status === 0 ? String(stdout ?? "").trim() : "";
  return said || null;
};

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const inside = (base, path) => {
  if (isAbsolute(path)) return false;
  const held = real(resolve(base, path));
  return held !== null && (held === base || held.startsWith(`${base}${sep}`));
};

/** True where the path names a file or a directory of `root`, everything where there is no root. */
export const resolverIn = (root) => {
  const base = root ? real(root) : null;
  if (!base) return () => true;
  const seen = new Map();
  return (path) => {
    if (!seen.has(path)) seen.set(path, inside(base, path));
    return seen.get(path);
  };
};
