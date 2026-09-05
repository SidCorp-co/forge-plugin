// A commit waits for what a consult owes on what it stages: unread documents, unruled findings. how/codex-second.md.

import { isAbsolute, resolve } from "node:path";

import { ageOf, demandIn, pendingState, repoRoot, stagedIn } from "../../src/codex/codex.mjs";
import { logEntries, unverdicted, verdictForm } from "../../src/codex/codex-log.mjs";
import { probeMs } from "../../src/hooks/git-probe.mjs";
import {
  REDIRECT,
  COMMITS,
  committing,
  deny,
  gitTreeOf,
  movedTo,
  NOWHERE,
  shellText,
  spans,
  spelled as bare,
  typed,
  how, done, remaining } from "../_hook.mjs";

/* What the commit closes over, from that command alone: a pipeline's flags are not the commit's, and
   neither is a redirect's target or a value a flag ate — `-am x` is all and a message, `-ma` a message
   alone, `-uall` neither. A pathspec needs no `--`, and an escaped space is inside one word. */
const WORD = /(?:'[^']*'|"(?:[^"\\]|\\.)*"|\\.|[^\s])+/gu;
const NEEDS_VALUE =
  /^--(?:message|file|reuse-message|reedit-message|author|date|template|cleanup|fixup|squash|trailer|pathspec-from-file)$/u;
const EATS_NEXT = "mFCct";
const EATS_REST = "uS";
const OPAQUE = ["--pathspec-from-file", "--patch", "--interactive"];
/* Two commits in one call are two shapes with one answer, a pathspec list in a file is one this cannot
   read, and `--patch` picks after the hook answers: each asks for the record whole. */
const TWICE = new RegExp(COMMITS.source, "gu");
/* A relative `-C` is that tree from where the shell stands, which a move before this commit — and
   not one after it — has changed. Where the shell stands nowhere the text names, only an absolute
   `-C` still answers, and the sentinel travels on: `resolve` would throw on it. */
const treeAt = (text, one) => {
  const named = gitTreeOf(one[0]);
  const moved = movedTo(text, one.index);
  if (moved === NOWHERE) return named && isAbsolute(named) ? named : NOWHERE;
  return named && !isAbsolute(named) && moved ? resolve(moved, named) : named ?? moved;
};

export const commitAim = (ev) => {
  const text = shellText((ev.tool_input ?? {}).command);
  const made = [...text.matchAll(TWICE)];
  const found = made[0];
  if (!found) return { tree: null, all: false, paths: [], others: [] };
  let unknown = made.length > 1;
  const from = found.index + found[0].length;
  const { end } = spans(text, { pipes: true }).find((one) => one.start <= from && from <= one.end)
    ?? { end: text.length };
  const tokens = text.slice(from, end).replace(REDIRECT, " ").match(WORD) ?? [];
  const paths = [];
  let all = false;
  let only = false;
  for (let at = 0; at < tokens.length; at += 1) {
    const one = bare(tokens[at]);
    if (!only && one === "--") only = true;
    else if (!only && one.startsWith("--")) {
      const [name] = one.split("=");
      if (name === "--all") all = true;
      if (OPAQUE.includes(name)) unknown = true;
      if (NEEDS_VALUE.test(name) && !one.includes("=")) at += 1;
    } else if (!only && one.startsWith("-") && one.length > 1) {
      for (let n = 1; n < one.length; n += 1) {
        if (one[n] === "a") all = true;
        if (one[n] === "p") unknown = true;
        if (EATS_REST.includes(one[n])) break;
        if (EATS_NEXT.includes(one[n])) {
          if (n === one.length - 1) at += 1;
          break;
        }
      }
    } else paths.push(one);
  }
  return {
    tree: treeAt(text, found),
    all,
    paths,
    unknown,
    others: [...new Set(made.slice(1).map((one) => treeAt(text, one)))],
  };
};

/* The switch a refused agent can reach, first, and then the variable as what it is: written as a
   prefix on the refused command it reached no hook, and that refusal named no way out (ISS-70). */
const ESCAPE = "For the session: `forge hooks --off codex-second` — an inline `FORGE_CODEX_DISABLE=1` "
  + "prefix never reaches a hook.";

/* One call, two commits, one answer: the tree judged is the first commit's, and the second's is
   inspected by nothing. Saying which was judged is what the reader needs to split the call. */
const unjudged = (ev, root, others) => {
  const left = [];
  let unnamed = false;
  for (const one of others) {
    if (one === NOWHERE) {
      unnamed = true;
      continue;
    }
    const path = resolve(ev.cwd ?? process.cwd(), one ?? ".");
    const there = repoRoot(path) ?? path;
    if (there !== root && !left.includes(there)) left.push(there);
  }
  if (!left.length && !unnamed) return "";
  const rest = [...left.map(typed), ...(unnamed ? ["a tree it does not name"] : [])];
  return ` Judged ${typed(root)}; this call also commits in ${rest.join(", ")}, which went unchecked.`;
};

export const run = (ev) => {
  if (!committing(ev) || process.env.FORGE_CODEX_DISABLE === "1") done();

  /* The tree the commit names, not the shell's; and a commit is in it by construction, redirect or not. */
  const aim = commitAim(ev);
  /* No tree to pick and no way to ask about one: the event's cwd is a different repository's answer. */
  if (aim.tree === NOWHERE) {
    deny(
      "Which tree this commit closes over cannot be read from the command — a `cd -`, a bare `cd` or a "
        + "destination built from a value names no directory this reading can check, so what the commit "
        + "stages cannot be asked for.\n\nDo this: spell the tree out — `cd <path> && git commit …`, or "
        + `\`git -C <path> commit …\` — then re-send. ${ESCAPE}`
        + how(),
    );
  }
  const root = repoRoot(resolve(ev.cwd ?? process.cwd(), aim.tree ?? "."));
  if (!root) done();

  const also = unjudged(ev, root, aim.others);
  /* Asked for what it stages; a commit this cannot enumerate names nothing, so the record stands whole. */
  const staged = stagedIn(root, aim, probeMs(remaining()));

  /* Recorded this turn or a turn ago, staged here, and never read: 7 of 30 commits landed with
     the list unread, and a shared checkout's 726 dirty paths were demanded of a three-file commit. */
  const waiting = pendingState(root);
  const demand = demandIn(waiting.files, staged);
  if (demand.length) {
    deny(
      `Codex has not read what this commit stages in ${root} (${demand.slice(0, 6).map(typed).join(" ")}`
        + `${demand.length > 6 ? ` and ${demand.length - 6} more` : ""}, recorded ${ageOf(waiting.at)}).${also}\n\n`
        + `Do this: \`${root === (ev.cwd ?? process.cwd()) ? "" : `cd ${typed(root)} && `}`
        + 'echo "<what you were doing>" | forge codex consult --diff --only blocker,major '
        + `${demand.slice(0, 6).map(typed).join(" ")}\`, then re-send. `
        + `\`forge codex pending --drop\` discards them unread. ${ESCAPE}`
        + how(),
    );
  }
  /* 37 consults made findings nobody ruled on, and the next consult then read "still open" as a guess. */
  const open = unverdicted(logEntries(), root);
  if (open) {
    deny(
      `Consult ${open.id} made ${open.ids.join(", ")} on ${open.files.join(", ")}; nothing says what became of ${open.open.join(", ")}.${also}\n\n`
        + `Do this: \`${verdictForm(open.id)}\`, then re-send. `
        + `A --recheck records the verdict for what it refutes. ${ESCAPE}`
        + how(),
    );
  }
  done();
};
