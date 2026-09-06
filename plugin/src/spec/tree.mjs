/* Where the tree is stored, known here and nowhere else: a caller asks for an identifier, so the
   day this reads an API instead of a checkout no caller changes. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { projectRoot } from "../resolve/settings.mjs";
import { refuse } from "../refusal.mjs";
import { clauseIndex } from "./index.mjs";

export const TREE = "docs/requirements";

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
};

const treeDir = () => {
  const root = projectRoot();
  const dir = root ? join(root, TREE) : null;
  return dir && existsSync(dir) ? dir : null;
};

const readFrom = (dir) => {
  const root = projectRoot();
  return walk(dir).map((path) => ({
    file: relative(root, path),
    text: readFileSync(path, "utf8"),
  }));
};

const documents = () => {
  const dir = treeDir();
  if (!dir) {
    refuse(
      `This project has no requirements tree: nothing at ${TREE}/ under ${projectRoot() ?? "any directory above this one"}.\n`
        + "A tree is a business document and a specification under that directory, one clause per\n"
        + "identifier, under the rules the tree's own index states. Scaffolding one from templates is ISS-30.",
    );
  }
  return readFrom(dir);
};

export const specTree = () => clauseIndex(documents());

/** The index, or `null` where this project keeps no tree — one probe of the directory rather than an
 *  asking pass and a reading one. A writer checking a citation has to stay silent where there is no
 *  tree, and `documents()` refuses, which is the answer a reader who asked for a clause is owed and
 *  the wrong one for a verb that was asked for something else. */
export const specTreeIfAny = () => {
  const dir = treeDir();
  return dir ? clauseIndex(readFrom(dir)) : null;
};
