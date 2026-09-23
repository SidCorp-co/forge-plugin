/* Where the tree is stored, known here and nowhere else: a caller asks for an identifier, so the
   day this reads an API instead of a checkout no caller changes. */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { checkoutRoot } from "../resolve/settings.mjs";
import { refuse } from "../refusal.mjs";
import { clauseIndex } from "./index.mjs";
import { RECORD, malformedIn, written } from "./recorded.mjs";

export const TREE = "docs/requirements";

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
};

const dirUnder = (root) => {
  const dir = root ? join(root, TREE) : null;
  return dir && existsSync(dir) ? dir : null;
};

const treeDir = () => dirUnder(checkoutRoot());

const readFrom = (dir, root = checkoutRoot(), keep = () => true) => walk(dir).filter(keep).map((path) => ({
  file: relative(root, path),
  text: readFileSync(path, "utf8"),
}));

/* The record is JSON and the walk above takes only `.md`: read as a document, its table of
   identifiers would define every clause of this tree a second time. */
const recordAt = (dir) => {
  const file = relative(checkoutRoot(), join(dir, RECORD));
  const path = join(dir, RECORD);
  if (!existsSync(path)) return { file, clauses: null, why: "is not there" };
  let held = null;
  try {
    held = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { file, clauses: null, why: `does not parse as JSON: ${error.message}` };
  }
  const clauses = held?.clauses;
  if (!clauses || typeof clauses !== "object") return { file, clauses: null, why: "carries no clauses object" };
  const bad = malformedIn(clauses);
  if (bad) return { file, clauses: null, why: `has no revision and digest for ${bad}` };
  return { file, clauses, why: null };
};

/** The record written from what the tree owes, and its path. The one writer R-10 admits. */
export const writeSpecRecord = (record) => {
  const dir = treeDir();
  if (!dir) return null;
  writeFileSync(join(dir, RECORD), written(record));
  return relative(checkoutRoot(), join(dir, RECORD));
};

const documents = () => {
  const dir = treeDir();
  if (!dir) {
    refuse(
      `This project has no requirements tree: nothing at ${TREE}/ under ${checkoutRoot() ?? "any directory above this one"}.\n`
        + "A tree is a business document and a specification under that directory, one clause per\n"
        + "identifier, under the rules the tree's own index states. Scaffolding one from templates is ISS-30.",
    );
  }
  return readFrom(dir);
};

export const specTree = () => clauseIndex(documents());

/** The index, or `null` where the project keeps no tree — one probe of the directory rather than an
 *  asking pass and a reading one. A writer checking a citation stays silent where there is none, and
 *  `documents()` refuses instead, which is what a reader who asked for a clause is owed and a verb
 *  asked for something else is not. `specTreeAt` takes the root, so a check given its tree reads it. */
export const specTreeIfAny = () => specTreeAt(checkoutRoot());

export const specTreeAt = (root) => {
  const dir = dirUnder(root);
  return dir ? clauseIndex(readFrom(dir, root)) : null;
};

/** The tree under `root` read only where it really lies inside `root`, or `null` where the directory
 *  itself resolves elsewhere: a reader serving another model is bounded by the checkout it was
 *  given, and a symlinked tree or document is a path to anywhere its author liked. */
export const specTreeInside = (root) => {
  const dir = dirUnder(root);
  const home = realpathSync(root);
  const inside = (path) => {
    const real = realpathSync(path);
    return real === home || real.startsWith(home + sep);
  };
  if (!dir || !inside(dir)) return null;
  return clauseIndex(readFrom(dir, root, inside));
};

export const keepsSpecTree = () => Boolean(treeDir());

/** The documents and the record beside the index: a finding names a line, which the index drops. */
export const specTreeRead = () => {
  const dir = treeDir();
  if (!dir) return null;
  const documents = readFrom(dir);
  return { documents, index: clauseIndex(documents), recorded: recordAt(dir) };
};
