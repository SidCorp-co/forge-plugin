// Refuse the shell commands whose damage cannot be undone, and the one that launders a finding into
// a green run. Narrow on purpose: a guard refusing too much gets disabled — how/bash-guard.md.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { GIT_GLOBALS, RUNS, SPAWNS, bodiless, deny, gitTreeOf, remaining, starts, unwrapped, how, done } from "../_hook.mjs";

/* Seven refusals in three days were `git add -A <paths>`, told they staged the whole tree: a pathspec
   bounds `-A` to what is under it, and only `.` is everything. A redirect is not a path. */
/* `git -C other stash` and `git -c k=v add -A` are the verb with a global before it. */
const GIT = String.raw`^(?:\S*\/)?git\s+` + GIT_GLOBALS;
const stagesEverything = (one) => {
  const rest = new RegExp(`${GIT}add\\b(.*)$`, "u").exec(one)?.[1];
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
    pattern: new RegExp(`${GIT}["']?stash\\b(?!\\s+["']?(?:list|show)\\b)`, "u"),
    needsDirtyTree: true,
    cause:
      "git stash silently reverts the working tree, so everything read afterwards reports about " +
      "code that is no longer there.",
    instead:
      "Copy the file aside to undo a probe, or use a separate `git worktree` for a clean baseline.",
  },
  {
    pattern: new RegExp(`${GIT}checkout\\s+["']?(?:--\\s+\\S|-{2}\\s|\\S+\\.\\w)`, "u"),
    needsDirtyTree: true,
    cause:
      "git checkout of a tracked path discards uncommitted work with no history to restore it from.",
    instead: "Copy the file aside first, or make the change you actually want.",
  },
  {
    pattern: new RegExp(`${GIT}reset\\s+["']?--hard\\b`, "u"),
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
      timeout: Math.max(500, Math.min(5000, remaining() - 1000)),
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

const instructions = (given, handed) => {
  const held = (body) => {
    if (!SPAWNS.test(body)) return body.replace(QUOTED, " ");
    handed.push(...[...body.matchAll(QUOTED)].map((one) => bare(one[0])));
    return " ";
  };
  return bodiless(given, held).replace(RUNS, (all, body) => held(bare(body)) && " ");
};

/* The tree the command names, not the shell's: `git -C other stash` is judged by `other`. */
const GLOBALS = new RegExp(String.raw`^(?:\S*\/)?git\s+` + GIT_GLOBALS, "u");
const treeOf = (one, cwd) => resolve(cwd ?? process.cwd(), gitTreeOf(GLOBALS.exec(one)?.[0]) ?? ".");

export const run = (ev) => {
  if (ev.tool_name !== "Bash") done();
  /* Where each command starts, because a rule quoted in an argument is data: `echo "git stash"` prints.
     A `-c` body is promoted first — the shell it names runs what is inside as commands of its own. */
  const handed = [];
  const text = instructions((ev.tool_input ?? {}).command ?? "", handed);
  const run = [text, ...handed].flatMap((one) => starts(unwrapped(one)));
  if (!run.length) done();

  for (const { pattern, cause, instead, needsDirtyTree } of RULES) {
    const hit = run.find((one) => pattern.test(one));
    if (!hit) continue;
    if (needsDirtyTree && !treeIsDirty(treeOf(hit, ev.cwd))) continue;
    deny(`Refused. ${cause}\n\nInstead: ${instead}${how()}`);
  }
};
