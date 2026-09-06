/* Where the tree is stored, known here and nowhere else: a caller asks for an identifier, so the
   day this reads an API instead of a checkout no caller changes. */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { projectRoot } from "../resolve/settings.mjs";
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

/* The record is JSON and the walk above takes only `.md`: read as a document, its table of
   identifiers would define every clause of this tree a second time. */
const recordAt = (dir) => {
  const file = relative(projectRoot(), join(dir, RECORD));
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
  return relative(projectRoot(), join(dir, RECORD));
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

/** The documents and the record beside the index: a finding names a line, which the index drops. */
export const specTreeRead = () => {
  const dir = treeDir();
  if (!dir) return null;
  const documents = readFrom(dir);
  return { documents, index: clauseIndex(documents), recorded: recordAt(dir) };
};
