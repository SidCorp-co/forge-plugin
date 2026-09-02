#!/usr/bin/env node
// Refuse the shell commands whose damage cannot be undone, and the one that launders a finding into
// a green run. Narrow on purpose: a guard refusing too much gets disabled — how/bash-guard.md.

import { spawnSync } from "node:child_process";

import { RUNS, SPAWNS, bodiless, deny, readEvent, starts, unwrapped, how } from "./_hook.mjs";

/* Seven refusals in three days were `git add -A <paths>`, told they staged the whole tree: a pathspec
   bounds `-A` to what is under it, and only `.` is everything. A redirect is not a path. */
const stagesEverything = (one) => {
  const rest = /^(?:\S*\/)?git\s+add\b(.*)$/u.exec(one)?.[1];
  if (rest === undefined) return false;
  const tokens = rest.split(/\s+/u).filter(Boolean).map((t) => t.replace(/['"]/gu, ""));
  const paths = [];
  const flags = [];
  let past = false;
  for (let at = 0; at < tokens.length; at += 1) {
    const t = tokens[at];
    if (t === "--") past = true;
    else if (/^\d*[<>]{1,2}(?:&\d)?$/u.test(t)) at += 1;
    else if (!past && /^-/u.test(t)) flags.push(t);
    else if (!/^\d*[<>]/u.test(t)) paths.push(t.replace(/^(?:\.\/+\.?|:\/|:\(top\))$/u, "."));
  }
  if (flags.some((t) => t === "--dry-run" || /^-[a-zA-Z]*n[a-zA-Z]*$/u.test(t))) return false;
  return paths.includes(".") || (paths.length === 0 && flags.some((t) => /^(?:--all|-[a-zA-Z]*A[a-zA-Z]*)$/u.test(t)));
};

const RULES = [
  {
    // `--fix-type` writes too; `--fix-dry-run` writes nothing and is how you see the diff first.
    // A runner keeps its command as arguments and is not in the shared grammar; a path names it too.
    pattern: new RegExp(
      String.raw`^(?:\S*\/)?(?:(?:npx|pnpm\s+exec|yarn\s+run|bunx)\s+)?(?:\S*\/)?` +
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
    pattern: /^(?:\S*\/)?(?:pkill|killall)\b/u,
    cause:
      "pkill and killall select by name, so they match every process whose name fits — " +
      "including the ones the user has been running since before this session.",
    instead:
      "Find the one process you mean (`lsof -ti :PORT`, `pgrep -f <exact>`), confirm the pid " +
      "is the one you established you may stop, then `kill <pid>`.",
  },
  {
    pattern: { test: stagesEverything },
    needsDirtyTree: true,
    cause:
      "git add -A stages everything in the tree, including work in progress that is not yours " +
      "and probes you meant to throw away.",
    instead: "Stage the paths you changed, explicitly.",
  },
  {
    // `list` and `show` read the stash and revert nothing, and refusing one cost a whole line.
    pattern: /^(?:\S*\/)?git\s+["']?stash\b(?!\s+["']?(?:list|show)\b)/u,
    needsDirtyTree: true,
    cause:
      "git stash silently reverts the working tree, so everything read afterwards reports about " +
      "code that is no longer there.",
    instead:
      "Copy the file aside to undo a probe, or use a separate `git worktree` for a clean baseline.",
  },
  {
    pattern: /^(?:\S*\/)?git\s+checkout\s+["']?(?:--\s+\S|-{2}\s|\S+\.\w)/u,
    needsDirtyTree: true,
    cause:
      "git checkout of a tracked path discards uncommitted work with no history to restore it from.",
    instead: "Copy the file aside first, or make the change you actually want.",
  },
  {
    pattern: /^(?:\S*\/)?git\s+reset\s+["']?--hard\b/u,
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

/* A literal inside a program an interpreter runs is data — a triple quote and an escape first, since
   read wrong its pairs skew and bare the rest. Unless it reaches a shell: there it is the command. */
const QUOTED = /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/gu;

/* The body as a shell would hand it over — the quoting rule is WORD's in `_hook.mjs`; this undoes it. */
const bare = (one) => {
  if (/^('''|""")/u.test(one)) return one.slice(3, -3);
  const inner = one.slice(1, -1);
  return one.startsWith('"') ? inner.replace(/\\\n/gu, "").replace(/\\(["\\$`])/gu, "$1") : inner;
};

const handed = [];
const held = (body) => {
  if (!SPAWNS.test(body)) return body.replace(QUOTED, " ");
  handed.push(...[...body.matchAll(QUOTED)].map((one) => bare(one[0])));
  return " ";
};
const instructions = (given) =>
  bodiless(given, held).replace(RUNS, (all, body) => held(bare(body)) && " ");

const ev = readEvent();
if (ev.tool_name !== "Bash") process.exit(0);
/* Where each command starts, because a rule quoted in an argument is data: `echo "git stash"` prints.
   A `-c` body is promoted first — the shell it names runs what is inside as commands of its own. */
const text = instructions((ev.tool_input ?? {}).command ?? "");
const run = [text, ...handed].flatMap((one) => starts(unwrapped(one)));
if (!run.length) process.exit(0);

for (const { pattern, cause, instead, needsDirtyTree } of RULES) {
  if (!run.some((one) => pattern.test(one))) continue;
  if (needsDirtyTree && !treeIsDirty(ev.cwd ?? process.cwd())) continue;
  deny(`Refused. ${cause}\n\nInstead: ${instead}${how()}`);
}
