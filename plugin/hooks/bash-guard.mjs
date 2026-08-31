#!/usr/bin/env node
// Refuse the shell commands whose damage cannot be undone by the agent that caused it, and the
// one that launders a finding into a green run. Deliberately narrow, because a guard that
// refuses too much gets disabled — docs/HOOKS.md.

import { spawnSync } from "node:child_process";

import { deny, readEvent } from "./_hook.mjs";

const RULES = [
  {
    // Anchored on command position, so a commit message or a doc line that quotes the flag is
    // prose and not a run. `--fix-type` writes too; `--fix-dry-run` writes nothing and is how you
    // see the diff before deciding.
    pattern: new RegExp(
      String.raw`(?:^|[;&|(]\s*|\b(?:npx|pnpm\s+exec|yarn\s+run|time|env)\s+)` +
        String.raw`(?:eslint|(?:npm|pnpm|yarn)\s+(?:run\s+)?lint\S*)\b[^|;&]*--fix(?:-type)?(?![\w-])`,
    ),
    why:
      "--fix rewrites the source until the checker stops reporting, which is the check being " +
      "answered rather than the code being fixed. The rewrite carries no judgement about which " +
      "findings were real, and it lands mixed into whatever else is uncommitted.",
    instead:
      "Fix each finding at its source. Adopting a new formatting rule is the one case the sweep " +
      "is the point, and that is a decision to put to the user before running it.",
  },
  {
    pattern: /\b(pkill|killall)\b/,
    why:
      "pkill and killall select by name, so they match every process whose name fits — " +
      "including the ones the user has been running since before this session.",
    instead:
      "Find the one process you mean (`lsof -ti :PORT`, `pgrep -f <exact>`), confirm the pid " +
      "is the one you established you may stop, then `kill <pid>`.",
  },
  {
    pattern: /\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/,
    needsDirtyTree: true,
    why:
      "git add -A stages everything in the tree, including work in progress that is not yours " +
      "and probes you meant to throw away.",
    instead: "Stage the paths you changed, explicitly.",
  },
  {
    pattern: /\bgit\s+stash\b/,
    needsDirtyTree: true,
    why:
      "git stash silently reverts the working tree, so everything read afterwards reports about " +
      "code that is no longer there.",
    instead:
      "Copy the file aside to undo a probe, or use a separate `git worktree` for a clean baseline.",
  },
  {
    pattern: /\bgit\s+checkout\s+(--\s+\S|-{2}\s|\S+\.\w)/,
    needsDirtyTree: true,
    why:
      "git checkout of a tracked path discards uncommitted work with no history to restore it from.",
    instead: "Copy the file aside first, or make the change you actually want.",
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    needsDirtyTree: true,
    why: "git reset --hard discards every uncommitted change in the tree at once.",
    instead: "Reset the specific paths, or commit first so the state is recoverable.",
  },
];

/** A git rule only bites when there is uncommitted work to lose. True on any doubt: if git
 *  cannot answer, the safe reading is that something is at stake. */
function treeIsDirty(cwd) {
  let out;
  try {
    out = spawnSync("git", ["status", "--porcelain"], {
      cwd: cwd || undefined,
      encoding: "utf8",
      timeout: 5000,
    });
  } catch {
    return true;
  }
  if (out.error) return true;
  if (out.status !== 0) return false; // not a repository: the rule has nothing to protect
  return out.stdout.trim() !== "";
}

const ev = readEvent();
if (ev.tool_name !== "Bash") process.exit(0);
const command = (ev.tool_input ?? {}).command ?? "";
if (!command) process.exit(0);

for (const { pattern, why, instead, needsDirtyTree } of RULES) {
  if (!pattern.test(command)) continue;
  if (needsDirtyTree && !treeIsDirty(ev.cwd ?? process.cwd())) continue;
  deny(
    `Refused.\n\n${why}\n\nInstead: ${instead}\n\n` +
      "If you have a reason this case is safe, say it and ask the user rather than rephrasing " +
      "around the guard.",
  );
}
