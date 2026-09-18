// Refuse a write to a file the plan does not name, so the correction is posted before the file
// rather than read off the mark after the ship. how/plan-scope.md.

import { statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

import { deny, done, how, named, shellWrites, writtenPaths } from "../_hook.mjs";
import { struck } from "../../src/hooks/shell-spans.mjs";
import { repoRoot } from "../../src/git/repo-root.mjs";
import { scopeHeld } from "../../src/flow/record/plan-scope.mjs";
import { correctionForm, namesPath } from "../../src/flow/record/merged.mjs";

/* Every path the call means to write, absolute. The shell reading is the strict one: a gate that must not invent a target takes nothing from a command whose destination it cannot place, and a relative name the command placed in no tree — a `cd -` this cannot follow — is one of those, where resolving it against the event's own directory would name a file in a tree the command never stood in. */
const aimedBy = (ev) => {
  if (ev.tool_name !== "Bash") return named(ev);
  const here = ev.cwd || process.cwd();
  return writtenPaths(struck(shellWrites(ev.tool_input?.command), { unplaceable: "strike" }), here)
    .flatMap((one) => (isAbsolute(one.token) ? [one.token] : one.trees.map((tree) => join(tree, one.token))));
};

/* A directory today is a destination and not the file that lands in it, which the command names somewhere this cannot read; nothing under the tree's own git directory is the change either. */
const judged = (path, root) => {
  const rel = relative(root, path);
  if (!rel || rel.startsWith("..") || rel.startsWith(".git/")) return null;
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ? null : rel;
};

/** The scope the tree holds, or null where nothing may be refused against it: no issue claimed here, and an issue whose plan field is empty, which is the rung that writes no plan and takes no list back from it. Several issues on one tree are one branch and one change, so their texts read together, and the refusal names the one claimed last. */
const scopeOf = (root) => {
  const held = scopeHeld(root);
  if (!held.length || held.some((one) => !one.named.trim())) return null;
  return { ref: held[0].ref, named: held.map((one) => one.named).join("\n") };
};

const hold = (rel, ref) =>
  deny(
    `Hold — \`${rel}\` is outside ${ref}'s plan: neither the plan nor a correction on it names that `
      + "path, and a change that grew says where before it grows.\n\n"
      + `Do this: post the correction, then re-send.\n  ${correctionForm(ref, [rel])}`
      + how(),
  );

export const run = (ev) => {
  const roots = new Map();
  for (const path of aimedBy(ev)) {
    const root = repoRoot(path) ?? repoRoot(ev.cwd || process.cwd());
    if (!root) continue;
    const rel = judged(path, root);
    if (!rel) continue;
    if (!roots.has(root)) roots.set(root, scopeOf(root));
    const scope = roots.get(root);
    if (scope && !namesPath(scope.named, rel)) hold(rel, scope.ref);
  }
  done();
};
