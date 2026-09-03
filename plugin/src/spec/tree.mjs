/* Where the tree is stored, known here and nowhere else: a caller asks for an identifier, so the
   day this reads an API instead of a checkout no caller changes. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { projectRoot } from "../resolve/settings.mjs";
import { refuse } from "../flow/record.mjs";
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

export const documents = () => {
  const root = projectRoot();
  if (!root || !existsSync(join(root, TREE))) {
    refuse(
      `This project has no requirements tree: nothing at ${TREE}/ under ${root ?? "any directory above this one"}.\n`
        + "A tree is a business document and a specification under that directory, one clause per\n"
        + "identifier, under the rules the tree's own index states. Scaffolding one from templates is ISS-30.",
    );
  }
  return walk(join(root, TREE)).map((path) => ({
    file: relative(root, path),
    text: readFileSync(path, "utf8"),
  }));
};

export const specTree = () => clauseIndex(documents());
