/* What a `finish` that removed a tree leaves behind it, because the run id and the ledger's name for
   that tree both lived inside what it removed: without this a second `finish` cannot tell its own
   earlier removal from one made by hand, and four builders in one day stopped on a leak line for a
   workspace nothing had leaked from (ISS-2478). The checkout's common git directory and never the
   tree's own, which `git worktree remove` takes with it, nor the developer's config directory, which
   is not a run's to write. `start` drops it, so a record of an earlier ending never answers for a
   tree cut since and removed by hand. */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { gitCommonDir, parsed } from "../../checkout.mjs";

const ENDED = "forge-ended";

export const endedPath = (root, key) => {
  const common = gitCommonDir(root);
  return common ? join(common, ENDED, `${key}.json`) : null;
};

/** The path written, or the reason it could not be: the removals it records have happened either way. */
export const endedWritten = (root, key, record) => {
  const at = endedPath(root, key);
  if (!at) return { why: `git answers no common directory for ${root}` };
  try {
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, `${JSON.stringify(record, null, 2)}\n`);
    return { at };
  } catch (error) {
    return { why: error.message };
  }
};

/** The record of this tree's ending, or null: one naming another path is some other tree's. */
export const endedOf = (root, key, tree) => {
  const at = endedPath(root, key);
  if (!at) return null;
  let text;
  try {
    text = readFileSync(at, "utf8");
  } catch {
    return null;
  }
  const record = parsed(text);
  return record?.tree === tree ? record : null;
};

export const endedDropped = (root, key) => {
  const at = endedPath(root, key);
  if (at) rmSync(at, { force: true });
};
