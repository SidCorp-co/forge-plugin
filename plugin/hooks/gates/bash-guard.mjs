// Refuse the shell commands whose damage cannot be undone, and the one that launders a finding into
// a green run. Narrow on purpose: a guard refusing too much gets disabled — how/bash-guard.md.
// It also refuses a wait that polls, which loses nothing and costs a turn per wake-up — how/polling.md.

import { isAbsolute, resolve } from "node:path";

import { gitProbe, probeMs } from "../../src/hooks/git-probe.mjs";
import { GIT_GLOBALS, NOWHERE, RUNS, SHELL, bodiless, deny, gitTreeOf, remaining, spawnsIn, standsIn, startsAt, unwrapped, waitsIn, how, done } from "../_hook.mjs";

/* Seven refusals in three days were `git add -A <paths>`, told they staged the whole tree: a pathspec bounds `-A` to what is under it, and only `.` is everything. A redirect is not a path. `git -C other stash` and `git -c k=v add -A` are the verb with a global before it. */
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

/* Every stash subcommand that pushes to or takes from the stack; the bare form is a push. */
const READS_THE_STACK = new Set(["list", "show", "create"]);
const movesTheStack = (one) => {
  const rest = new RegExp(`${GIT}["']?stash["']?(?![\\w-])(.*)$`, "u").exec(one)?.[1];
  if (rest === undefined) return false;
  const next = rest.split(/\s+/u).filter(Boolean)[0]?.replace(/['"]/gu, "");
  return next === undefined || !READS_THE_STACK.has(next);
};

const RULES = [
  {
    // `--fix-type` writes too; `--fix-dry-run` writes nothing and is how you see the diff first. A runner keeps its command as arguments and is not in the shared grammar; a path names it too.
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
    atStake: "dirty",
    cause:
      "git add -A stages everything in the tree, including work in progress that is not yours " +
      "and probes you meant to throw away.",
    instead: "Stage the paths you changed, explicitly.",
  },
  {
    pattern: { test: movesTheStack },
    atStake: "shared",
    cause:
      "The stash stack belongs to the repository, not to this worktree, and this repository has " +
      "more than one worktree. A stash pushed in one tree is what a pop in another takes, so this " +
      "call can hand your work to a session working elsewhere, or apply theirs over your files.",
    instead:
      "Cut a second `git worktree` at the base for a clean baseline, or copy the one file aside and " +
      "restore it afterwards. `git stash list` and `git stash show` read the stack and stay allowed.",
  },
  {
    // `list` and `show` read the stash and revert nothing, and refusing one cost a whole line.
    pattern: new RegExp(`${GIT}["']?stash\\b(?!\\s+["']?(?:list|show)\\b)`, "u"),
    atStake: "dirty",
    cause:
      "git stash silently reverts the working tree, so everything read afterwards reports about " +
      "code that is no longer there.",
    instead:
      "Copy the file aside to undo a probe, or use a separate `git worktree` for a clean baseline.",
  },
  {
    pattern: new RegExp(`${GIT}checkout\\s+["']?(?:--\\s+\\S|-{2}\\s|\\S+\\.\\w)`, "u"),
    atStake: "dirty",
    cause:
      "git checkout of a tracked path discards uncommitted work with no history to restore it from.",
    instead: "Copy the file aside first, or make the change you actually want.",
  },
  {
    pattern: new RegExp(`${GIT}reset\\s+["']?--hard\\b`, "u"),
    atStake: "dirty",
    cause: "git reset --hard discards every uncommitted change in the tree at once.",
    instead: "Reset the specific paths, or commit first so the state is recoverable.",
  },
  {
    pattern: /^(?:\S*\/)?sleep(?=\s|$)/u,
    needsWait: true,
    topic: "polling",
    cause:
      "A sleep inside a wait polls: every wake-up is a turn spent asking, and a wait longer than "
      + "the shell tool's ten-minute cap ends with the state it was waiting on lost.",
    instead:
      "Run the work in the foreground with the tool's own timeout, up to that ten-minute cap, or "
      + "start it in the background and let the harness's completion notice be the wake-up.",
  },
];

/** A git rule only bites when there is uncommitted work to lose. True on any doubt: if git cannot answer, the safe reading is that something is at stake. */
function treeIsDirty(cwd) {
  const said = gitProbe(["status", "--porcelain"], { cwd: cwd || undefined, ms: probeMs(remaining()) });
  if (said.failed) return true;
  if (said.status !== 0) return false; // not a repository: the rule has nothing to protect
  return said.out.trim() !== "";
}

/** How many worktrees share this repository's stash stack, a stale entry included since the verb reports one. One on any doubt: a refusal invented from a failed probe reads as noise. */
function worktreeCount(cwd) {
  const said = gitProbe(["worktree", "list", "--porcelain"], { cwd: cwd || undefined, ms: probeMs(remaining()) });
  if (said.failed || said.status !== 0) return 1;
  return Math.max(1, said.out.split("\n").filter((line) => line.startsWith("worktree ")).length);
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
  const held = (body, at, runner) => {
    if (SHELL.test(runner) || !spawnsIn(runner).test(body)) return body.replace(QUOTED, " ");
    handed.push(...[...body.matchAll(QUOTED)].map((one) => ({ text: bare(one[0]), at })));
    return " ";
  };
  const outer = bodiless(given, held).replace(
    RUNS,
    (all, runner, body, at) => held(bare(body), at, runner) && " ".repeat(all.length),
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
  /* A tree the text does not name is left to the dirty reading, which already treats it as at stake. */
  const counted = new Map();
  const shared = (tree) => {
    if (tree === NOWHERE) return false;
    if (!counted.has(tree)) counted.set(tree, worktreeCount(tree) > 1);
    return counted.get(tree);
  };
  /* One reading of the waits per text, shared by every candidate: the offsets `startsAt` gave are
     into the same text, so a `sleep` is inside a wait exactly where its own start is. */
  const waited = new Map();
  const inWait = (one) => {
    if (!waited.has(one.source)) waited.set(one.source, waitsIn(one.source));
    return waited.get(one.source).some(([from, to]) => one.at >= from && one.at < to);
  };
  /* At most one reading gates a rule, and the doubt suffixes below are written about the dirty one. */
  const AT_STAKE = { dirty, shared };
  for (const { pattern, cause, instead, atStake, needsWait, topic } of RULES) {
    const hits = run.filter((one) => pattern.test(one.said) && (!needsWait || inWait(one)));
    if (!hits.length) continue;
    const asks = AT_STAKE[atStake] ?? null;
    /* The trees the `find` read, kept: the refusal is about the very hit that answered. */
    let trees = [];
    const hit = asks && hits.find((one) => (trees = treesOf(one, ev.cwd)).some(asks));
    if (asks && !hit) continue;
    const doubt = atStake === "dirty" && hit ? trees : [];
    const unsure = doubt.includes(NOWHERE) ? UNNAMED : (doubt.length > 1 ? UNSURE : "");
    deny(`Refused. ${cause}\n\nInstead: ${instead}${unsure}${topic ? how(topic) : how()}`);
  }
};
