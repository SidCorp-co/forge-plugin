/* Which steps a diff can reach. The diff is against the merge-base with the default branch, so
   committing does not empty it and a rebase re-scopes against the new base on its own. */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { defaultBranch, gitOut, lines } from "../checkout.mjs";

// Every relative form: a module this misses decides what a run may skip and reads as ordinary.
const RELATIVE_IMPORT = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'](\.[^"']*)["']/gu;

const moduleGraph = (entry, seen = new Set()) => {
  if (seen.has(entry) || !existsSync(entry)) return seen;
  seen.add(entry);
  for (const [, specifier] of readFileSync(entry, "utf8").matchAll(RELATIVE_IMPORT)) {
    moduleGraph(resolve(join(entry, ".."), specifier), seen);
  }
  return seen;
};

export const derivationFiles = (runner, root) =>
  [...moduleGraph(runner)].map((file) => relative(root, file)).sort();

/* Nothing scopes a change to itself: a wrong answer would pick the steps and then vouch for them. */
export const editsDerivation = (changed, runner, root) => {
  const own = derivationFiles(runner, root);
  return changed.find((file) => own.includes(file));
};

// `.` is the top-level files alone: as "everything" it would claim any path and kill the widening.
export const under = (file, claim) =>
  claim === "." ? !file.includes("/") : file === claim || file.startsWith(`${claim}/`);

export const mergeBaseDiff = (root) => {
  const branch = defaultBranch(root);
  const base = gitOut(["merge-base", "HEAD", branch], root);
  if (!base) return { error: `no merge base between HEAD and ${branch}` };
  const listings = [["diff", "--name-only", base], ["ls-files", "--others", "--exclude-standard"]]
    .map((args) => ({ args, said: gitOut(args, root) }));
  const refused = listings.find((one) => one.said === null);
  if (refused) return { error: `git ${refused.args.join(" ")} was refused, so what changed is unknown` };
  const changed = new Set(listings.flatMap((one) => lines(one.said)));
  return { base, branch, changed: [...changed].sort() };
};

// Fail toward the whole gate: a path no step claims is a tree the table does not model yet.
export const unclaimedIn = (steps, changed) => {
  const claimed = steps.flatMap((step) => step.reads);
  return changed.find((file) => !claimed.some((claim) => under(file, claim)));
};

export const planFor = (steps, changed) => {
  const stranger = unclaimedIn(steps, changed);
  if (stranger) return { full: true, reason: `${stranger} belongs to no gate step` };
  return {
    full: false,
    steps: steps.map((step) => {
      const reached = changed.find((file) => step.reads.some((claim) => under(file, claim)));
      return { ...step, run: Boolean(reached), reason: reached };
    }),
  };
};
