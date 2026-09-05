/* The roles a dispatcher names and the roots a skill check reads: one module, because a role
   directory is one of those roots. docs/dispatch-and-roles.md. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const WITHIN = "agents";

export const rolesDir = (root = HERE) => join(root, WITHIN);

export const rolesIn = (root = HERE) => {
  const dir = rolesDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((one) => one.isFile() && one.name.endsWith(".md"))
    .map((one) => one.name.slice(0, -3))
    .sort();
};

export const skillRootsIn = (plugin) => [
  { dir: join(plugin, "skills"), flat: false },
  { dir: join(plugin, "guides", "skills"), flat: false },
  { dir: join(plugin, WITHIN), flat: true },
];

/** A `flat` root is itself the root its text resolves against: a role is one file where a skill is
 *  a directory. Declared rather than inferred from what the root holds — inferring it let a single
 *  subdirectory take every role out of the walk, silently (ISS-316). */
export const skillDirsIn = (roots) =>
  roots.flatMap(({ dir, flat }) => (flat
    ? [dir]
    : readdirSync(dir, { withFileTypes: true })
      .filter((one) => one.isDirectory())
      .map((one) => join(dir, one.name))));

export const roleNames = (plugin, root = HERE) => rolesIn(root).map((one) => `${plugin}:${one}`);

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/u;

export const keysDeclared = (text) => {
  const found = FRONTMATTER.exec(String(text ?? ""))?.[1];
  if (!found) return [];
  return found.split("\n").flatMap((line) => /^([A-Za-z_-]+):/u.exec(line)?.[1] ?? []);
};

export const roleText = (name, root = HERE) => {
  const path = join(rolesDir(root), `${name}.md`);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

/** A role here and not in the copy a session registered is a name that will not resolve. */
export const rolesDiffer = (here, loaded) => {
  const missing = here.filter((one) => !loaded.includes(one));
  const extra = loaded.filter((one) => !here.includes(one));
  return missing.length || extra.length ? { missing, extra } : null;
};
