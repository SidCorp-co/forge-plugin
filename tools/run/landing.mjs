/* Which commits of a range are the release rather than the change: a bump differs from its first
   parent's manifest whatever a rebase did to it, and moves RELEASE_FIELDS and nothing else. And
   which moves of a change's own path are the release's rather than anybody's edit to it. */
import { join } from "node:path";

import { gitOut } from "../checkout.mjs";
import { movedBetween } from "../../plugin/src/git/moved.mjs";

export const versionAt = (root, ref) => {
  const shown = gitOut(["show", `${ref}:package.json`], root);
  if (!shown) return null;
  try {
    return JSON.parse(shown).version ?? null;
  } catch {
    return null;
  }
};

export const isRelease = (tree, sha) => versionAt(tree, sha) !== versionAt(tree, `${sha}^`);

/* Where a release writes its number and nowhere else: `npm version` writes the manifest's own field
   and, in the lock, the root package's second copy at `packages[""]`, and the version lifecycle
   (`sync-manifest-version.mjs`) the plugin manifest's. The version step stages these files, the gate
   ledger keys them with that number taken out, and the landing reads a move of a change's path
   confined to these fields as the release's and not as an edit (ISS-2516). One table, so a field a
   release starts writing is added once and every reader of the release's shape reads it. */
export const RELEASE_FIELDS = {
  "package.json": [["version"]],
  "package-lock.json": [["version"], ["packages", "", "version"]],
  [join("plugin", ".claude-plugin", "plugin.json")]: [["version"]],
};

export const RELEASE_FILES = Object.keys(RELEASE_FIELDS);

const valueAt = (found, [key, ...deeper]) => {
  if (found === null || typeof found !== "object" || !(key in found)) return undefined;
  return deeper.length ? valueAt(found[key], deeper) : found[key];
};

const without = (found, [key, ...deeper]) => {
  if (found === null || typeof found !== "object" || !(key in found)) return found;
  if (deeper.length) return { ...found, [key]: without(found[key], deeper) };
  return Object.fromEntries(Object.entries(found).filter(([name]) => name !== key));
};

/* Two halves, as the ledger keys these files: the parsed values with the release's fields taken out
   say no other value moved, and the bytes with each field's own number struck out say no whitespace,
   order or escape did — a re-serialised value alone would pass a reformatting as the release's. */
const beside = (text, fields) => {
  const parsed = JSON.parse(text);
  const numbers = fields.map((at) => valueAt(parsed, at)).filter((one) => typeof one === "string");
  const bytes = numbers.reduce((left, one) => left.split(JSON.stringify(one)).join(""), text);
  return JSON.stringify([fields.reduce(without, parsed), bytes]);
};

/** Whether `path` differs between two commits only in the fields a release writes into it. False
 *  for a path the release writes nothing into, one either commit lacks, and one either side of which
 *  does not parse: each of those is a move this reading cannot vouch for, so it stays a move. */
export const releaseOnly = (tree, from, to, path) => {
  const fields = RELEASE_FIELDS[path];
  if (!fields) return false;
  const [was, now] = [from, to].map((ref) => gitOut(["show", `${ref}:${path}`], tree));
  if (was === null || now === null) return false;
  try {
    return beside(was, fields) === beside(now, fields);
  } catch {
    return false;
  }
};

/** Whether a commit is a release and nothing else: the version moved, and every file it touched is
 *  one a release writes, moved in no field outside those the release writes into it (ISS-2520). */
export const onlyRelease = (tree, sha) => isRelease(tree, sha)
  && (gitOut(["diff", "--name-only", `${sha}^`, sha], tree) ?? "").split("\n")
    .filter(Boolean).every((one) => releaseOnly(tree, `${sha}^`, sha, one));

/** A change's own paths that differ between its judged head and a commit it lands as, split into
 *  what moved and what only the release's version fields moved; null where git could not answer.
 *  The chain step hands back on the first and the mark names the first, so a release between a
 *  judgement and its landing leaves both alone (ISS-2516). */
export const changeMoved = (tree, from, to, paths) => {
  const read = movedBetween(tree, from, to, paths);
  if (read === null) return null;
  const release = read.filter((path) => releaseOnly(tree, from, to, path));
  return { moved: read.filter((path) => !release.includes(path)), release };
};
