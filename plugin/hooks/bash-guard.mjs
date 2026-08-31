#!/usr/bin/env node
// Refuse the shell commands whose damage cannot be undone by the agent that caused it, and the
// one that launders a finding into a green run. Deliberately narrow, because a guard that
// refuses too much gets disabled — why/bash-guard.md.

import { spawnSync } from "node:child_process";

import { bodiless, deny, readEvent, why } from "./_hook.mjs";

const RULES = [
  {
    // Anchored on command position, so a commit message or a doc line that quotes the flag is
    // prose and not a run. `--fix-type` writes too; `--fix-dry-run` writes nothing and is how you
    // see the diff before deciding.
    pattern: new RegExp(
      String.raw`(?:^|[;&|(]\s*|\b(?:npx|pnpm\s+exec|yarn\s+run|time|env)\s+)` +
        String.raw`(?:eslint|(?:npm|pnpm|yarn)\s+(?:run\s+)?lint\S*)\b[^|;&]*--fix(?:-type)?(?![\w-])`,
    ),
    cause:
      "--fix rewrites the source until the checker stops reporting: the check is answered rather " +
      "than the code, and no judgement is recorded about which findings were real.",
    instead:
      "Fix each finding at its source. Adopting a new formatting rule is the one case the sweep " +
      "is the point, and that is the user's decision to make first.",
  },
  {
    pattern: /\b(pkill|killall)\b/,
    cause:
      "pkill and killall select by name, so they match every process whose name fits — " +
      "including the ones the user has been running since before this session.",
    instead:
      "Find the one process you mean (`lsof -ti :PORT`, `pgrep -f <exact>`), confirm the pid " +
      "is the one you established you may stop, then `kill <pid>`.",
  },
  {
    pattern: /\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/,
    needsDirtyTree: true,
    cause:
      "git add -A stages everything in the tree, including work in progress that is not yours " +
      "and probes you meant to throw away.",
    instead: "Stage the paths you changed, explicitly.",
  },
  {
    pattern: /\bgit\s+stash\b/,
    needsDirtyTree: true,
    cause:
      "git stash silently reverts the working tree, so everything read afterwards reports about " +
      "code that is no longer there.",
    instead:
      "Copy the file aside to undo a probe, or use a separate `git worktree` for a clean baseline.",
  },
  {
    pattern: /\bgit\s+checkout\s+(--\s+\S|-{2}\s|\S+\.\w)/,
    needsDirtyTree: true,
    cause:
      "git checkout of a tracked path discards uncommitted work with no history to restore it from.",
    instead: "Copy the file aside first, or make the change you actually want.",
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    needsDirtyTree: true,
    cause: "git reset --hard discards every uncommitted change in the tree at once.",
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

/* What the shell will actually run: a data heredoc is dropped, and a quoted span is an argument
   rather than a command — kept only where a string reaches a shell again, after `eval` or `-c`, and
   never stripped from a program that can spawn one. why/bash-guard.md. */
const QUOTED = /'[^']*'|"[^"]*"/gu;
const TO_SHELL = /(?:\beval\b|(?:^|\s)-c)\s*$/u;
const SPAWNS = /\b(?:subprocess|os\.system|os\.popen|child_process|execSync|spawnSync|shell\s*=\s*True)/u;

const instructions = (given) => {
  const text = bodiless(given);
  if (SPAWNS.test(text)) return text;
  return text.replace(QUOTED, (span, at) => (TO_SHELL.test(text.slice(0, at)) ? span : " "));
};

const ev = readEvent();
if (ev.tool_name !== "Bash") process.exit(0);
const command = instructions((ev.tool_input ?? {}).command ?? "");
if (!command) process.exit(0);

for (const { pattern, cause, instead, needsDirtyTree } of RULES) {
  if (!pattern.test(command)) continue;
  if (needsDirtyTree && !treeIsDirty(ev.cwd ?? process.cwd())) continue;
  deny(`Refused. ${cause}\n\nInstead: ${instead}${why()}`);
}
