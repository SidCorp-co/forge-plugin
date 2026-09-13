/* Whether the packages a project declares are installed: a manifest that has not moved satisfies every check keyed on the manifest, so an install broken after it was written is the one break that reads as a clean tree (ISS-885). */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { readJson } from "./config.mjs";

export const INSTALL_OWES = ["dependencies", "devDependencies"];

const RESOLVES_ELSEWHERE = [".pnp.cjs", ".pnp.js", ".pnp.mjs"];

// Node's own lookup, near to far, and the package's own manifest rather than its directory: a dangling workspace link is an entry that reads as present until something follows it.
const resolves = (root, name) => {
  for (let dir = root; ; dir = dirname(dir)) {
    if (readJson(join(dir, "node_modules", name, "package.json"))) return true;
    if (dirname(dir) === dir) return false;
  }
};

/** What this project declares and which of it is not installed, or `null` where nothing under `node_modules` could answer: no manifest at this root, nothing declared in it, or a resolver that writes no such directory. */
export const unresolvedIn = (root) => {
  const manifest = readJson(join(root, "package.json"));
  if (!manifest) return null;
  const declared = [...new Set(INSTALL_OWES.flatMap((field) => Object.keys(manifest[field] ?? {})))].sort();
  if (declared.length === 0 || RESOLVES_ELSEWHERE.some((one) => existsSync(join(root, one)))) return null;
  return { declared, missing: declared.filter((name) => !resolves(root, name)) };
};

export const PUTS_IT_BACK = "npm install";

export const said = (missing, shown = 3) =>
  missing.slice(0, shown).join(", ") + (missing.length > shown ? `, +${missing.length - shown} more` : "");
