// Refuse the shell commands whose damage cannot be undone, and the one that launders a finding into
// a green run. Narrow on purpose: a guard refusing too much gets disabled — how/bash-guard.md.

import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";

import { GIT_GLOBALS, NOWHERE, RUNS, SPAWNS, bodiless, deny, gitTreeOf, remaining, standsIn, startsAt, unwrapped, how, done } from "../_hook.mjs";

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

/* A handed program keeps its interpreter's position, so it inherits that point's moves: hence the pad. */
const instructions = (given) => {
  const handed = [];
  const held = (body, at) => {
    if (!SPAWNS.test(body)) return body.replace(QUOTED, " ");
    handed.push(...[...body.matchAll(QUOTED)].map((one) => ({ text: bare(one[0]), at })));
    return " ";
  };
  const outer = bodiless(given, held).replace(
    RUNS,
    (all, body, at) => held(bare(body), at) && " ".repeat(all.length),
  );
  return { outer, handed };
};

/* The tree it names, placed against each cwd `standsIn` allows. Memoised: one deadline for all rules.
   A cwd nobody can name leaves the tree unnamed too, unless the command spells an absolute one. */
const GLOBALS = new RegExp(String.raw`^(?:\S*\/)?git\s+` + GIT_GLOBALS, "u");
const placed = (moved, cwd, named) =>
  (moved === NOWHERE
    ? (isAbsolute(named) ? named : NOWHERE)
    : resolve(resolve(cwd || process.cwd(), moved ?? "."), named));
const treesOf = (one, cwd) => {
  const named = gitTreeOf(GLOBALS.exec(one.said)?.[0]) ?? ".";
  one.trees ??= [...new Set(standsIn(one.source, one.at).map((moved) => placed(moved, cwd, named)))];
  return one.trees;
};

/* A refusal a developer cannot act on gets worked around, and doubt is not in the rule's own instead. */
const UNSURE =
  " This call could run in more than one tree — a `cd` before `;` or `||` may have failed, so the"
  + " shell may still be standing where it started — and one of them has uncommitted work. Join them"
  + " with `&&`, which runs the command only where the `cd` succeeded, and the tree is certain.";
/* And a tree the text does not name is one at stake, the way `treeIsDirty` reads a tree git cannot
   answer about — so the refusal has to say the reading failed, not leave a clean checkout looking guilty. */
const UNNAMED =
  " Which tree this runs in cannot be read from the command — `cd -`, a bare `cd` and a path built"
  + " from a variable name no directory this reading can check — so it is treated as having"
  + " uncommitted work. Spell the directory out: `cd <path> && \u2026`.";

export const run = (ev) => {
  if (ev.tool_name !== "Bash") done();
  /* Where each command starts, because a rule quoted in an argument is data: `echo "git stash"` prints.
     A `-c` body is promoted first — the shell it names runs what is inside as commands of its own. */
  const { outer, handed } = instructions((ev.tool_input ?? {}).command ?? "");
  const text = unwrapped(outer);
  const run = [
    ...startsAt(text).map(({ said, at }) => ({ said, source: text, at })),
    ...handed.flatMap((one) => startsAt(unwrapped(one.text)).map(({ said }) => ({ said, source: outer, at: one.at }))),
  ];
  if (!run.length) done();

  const answered = new Map();
  const dirty = (tree) => {
    if (tree === NOWHERE) return true;
    if (!answered.has(tree)) answered.set(tree, treeIsDirty(tree));
    return answered.get(tree);
  };
  for (const { pattern, cause, instead, needsDirtyTree } of RULES) {
    const hits = run.filter((one) => pattern.test(one.said));
    if (!hits.length) continue;
    const hit = needsDirtyTree && hits.find((one) => treesOf(one, ev.cwd).some(dirty));
    if (needsDirtyTree && !hit) continue;
    const trees = hit ? treesOf(hit, ev.cwd) : [];
    const unsure = trees.includes(NOWHERE) ? UNNAMED : (trees.length > 1 ? UNSURE : "");
    deny(`Refused. ${cause}\n\nInstead: ${instead}${unsure}${how()}`);
  }
};
