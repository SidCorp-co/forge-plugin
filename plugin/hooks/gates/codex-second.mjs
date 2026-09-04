// The advisor has spoken and there is work in the tree: the second opinion happens before the next
// write, not at some end the turn may never reach. And a commit waits for what a consult owes on
// what that commit stages: documents unread, findings nobody ruled on. how/codex-second.md.

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { ageOf, demandIn, pendingState, repoRoot, stagedIn } from "../../src/codex/codex.mjs";
import { lastConsultAt, logEntries, unverdicted } from "../../src/codex/codex-log.mjs";
import {
  REDIRECT,
  advisedThisTurn,
  COMMITS,
  committing,
  deny,
  gitTreeOf,
  shellText,
  spans,
  turnRecords,
  unspentAdvice,
  how,
  writesInside,
  writing, done, remaining } from "../_hook.mjs";

/* A deleted file has no mtime, and a directory removed whole takes its own: climb to what is there. */
const climbed = (path, root) => {
  let at = path;
  while (at.length >= root.length) {
    try {
      return statSync(at).mtimeMs;
    } catch {
      /* gone with the deletion; the root itself always answers */
    }
    const up = dirname(at);
    if (up === at) break;
    at = up;
  }
  return 0;
};

/* Past WALK paths the set reads as changed now: a stat each outran the hook, and a killed hook is open. */
const WALK = 500;
const newestOf = (root, rels) => {
  if (rels.length > WALK) return Date.now();
  let newest = 0;
  for (const rel of rels) newest = Math.max(newest, climbed(join(root, rel), root));
  return newest;
};

const clock = () => Math.max(500, Math.min(5000, remaining() - 1000));

/* `-z` neither quotes nor escapes; a rename's old name is the next field. Past the cap a count stands
   in for a timestamp and is never spent, so there the question is what this checkout recorded. */
const changedAt = (root) => {
  const out =
    spawnSync("git", ["-C", root, "status", "--porcelain", "-z", "-uall"], {
      encoding: "utf8",
      timeout: clock(),
    })
      .stdout ?? "";
  const rows = out.split("\0");
  const named = [];
  const held = [];
  for (let at = 0; at < rows.length; at += 1) {
    const path = rows[at].slice(3);
    if (!path) continue;
    if (/[RC]/u.test(rows[at].slice(0, 2))) at += 1;
    /* A directory survives `-uall` only as a repository of its own: work this tree cannot hand over
       as a file, and going quiet about it is the silence the gate exists to break. */
    (path.endsWith("/") ? held : named).push(path);
  }
  if (named.length + held.length > WALK) {
    const record = pendingState(root).files;
    const kept = (list) =>
      list.filter((one) => (one.endsWith("/") ? record.some((rel) => rel.startsWith(one)) : record.includes(one)));
    const mine = kept(named);
    const inside = kept(held);
    return { newest: newestOf(root, [...mine, ...inside]), named: mine, held: inside };
  }
  return { newest: newestOf(root, [...named, ...held]), named, held };
};

/* The last `cd` before the commit is the tree it closes in — how a shell whose cwd resets between
   calls commits into a worktree. A subshell's move dies with it, and two relative moves compose. */
const MOVES = /^\(?\s*cd\s+(?:-[\w-]+\s+)*("[^"]*"|'[^']*'|(?:\\.|[^\s;&|])+)/u;
const bare = (one) => one.replace(/['"]/gu, "").replace(/\\(.)/gu, "$1").replace(/^~(?=\/|$)/u, homedir());
const movedTo = (text, before) => {
  const outer = [];
  let moved = null;
  for (const { start, end } of spans(text, { pipes: true })) {
    if (start > before) break;
    const one = text.slice(start, end).trim();
    if (one.startsWith("(")) outer.push(moved);
    const said = MOVES.exec(one)?.[1];
    if (said) moved = moved && !isAbsolute(bare(said)) ? resolve(moved, bare(said)) : bare(said);
    if (one.endsWith(")") && outer.length) moved = outer.pop();
  }
  return moved;
};

/* What the commit closes over, from that command alone: a pipeline's flags are not the commit's, and
   neither is a redirect's target or a value a flag ate — `-am x` is all and a message, `-ma` a message
   alone, `-uall` neither. A pathspec needs no `--`, and an escaped space is inside one word. */
const WORD = /(?:'[^']*'|"(?:[^"\\]|\\.)*"|\\.|[^\s])+/gu;
const NEEDS_VALUE =
  /^--(?:message|file|reuse-message|reedit-message|author|date|template|cleanup|fixup|squash|trailer|pathspec-from-file)$/u;
const EATS_NEXT = "mFCct";
const EATS_REST = "uS";
const OPAQUE = ["--pathspec-from-file", "--patch", "--interactive"];
/* Two commits in one call are two shapes with one answer, a pathspec list held in a file is one this
   cannot read, and what `--patch` picks is picked after the hook has answered: each asks for the
   record whole rather than for what one shape enumerates. */
const TWICE = new RegExp(COMMITS.source, "gu");
/* A relative `-C` is that tree from where the shell stands, which a move before this commit — and
   not one after it — has changed. */
const treeAt = (text, one) => {
  const named = gitTreeOf(one[0]);
  const moved = movedTo(text, one.index);
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

const typed = (one) =>
  /^[\w./@+][\w./@+-]*$/u.test(one) ? one : `'${one.replace(/'/gu, String.raw`'\''`)}'`;

/* The switch a refused agent can reach, first, and then the variable as what it is: written as a
   prefix on the refused command it reached no hook, and that refusal named no way out (ISS-70). */
const ESCAPE = "For the session: `forge hooks --off codex-second` — an inline `FORGE_CODEX_DISABLE=1` "
  + "prefix never reaches a hook.";

/* One call, two commits, one answer: the tree judged is the first commit's, and the second's is
   inspected by nothing. Saying which was judged is what the reader needs to split the call. */
const unjudged = (ev, root, others) => {
  const left = [];
  for (const one of others) {
    const path = resolve(ev.cwd ?? process.cwd(), one ?? ".");
    const there = repoRoot(path) ?? path;
    if (there !== root && !left.includes(there)) left.push(there);
  }
  if (!left.length) return "";
  return ` Judged ${typed(root)}; this call also commits in ${left.map(typed).join(", ")}, which went unchecked.`;
};

export const run = (ev) => {
  const closing = committing(ev);

  if ((!writing(ev) && !closing) || process.env.FORGE_CODEX_DISABLE === "1") done();

  /* The tree the commit names, not the shell's; and a commit is in it by construction, redirect or not. */
  const aim = closing ? commitAim(ev) : null;
  const root = repoRoot(resolve(ev.cwd ?? process.cwd(), aim?.tree ?? "."));
  if (!root) done();

  const also = closing ? unjudged(ev, root, aim.others) : "";
  const records = process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1" ? null : turnRecords(ev.transcript_path ?? "");
  const advised = Boolean(records && advisedThisTurn(records) && (closing || writesInside(ev, root)));
  const spentAt = lastConsultAt(root);
  /* Asked for what it stages; a write and an unenumerable commit name nothing, so the tree answers. */
  const staged = closing ? stagedIn(root, aim, clock()) : null;
  const { newest: changed, named, held } = closing && staged
    ? { newest: advised && staged.length ? newestOf(root, staged) : 0, named: staged, held: [] }
    : (advised ? changedAt(root) : { newest: 0, named: [], held: [] });
  const owed = advised && (closing || unspentAdvice(records, spentAt)) && changed > 0 && changed > spentAt;

  if (!owed && closing) {
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
          + `Do this: \`forge codex verdict --of ${open.id} --accepted <ids> --rejected <id>=<why>\`, then re-send. `
          + `A --recheck records the verdict for what it refutes. ${ESCAPE}`
          + how(),
      );
    }
  }
  if (!owed) done();

  /* The command it can send as it stands: six is a readable line, and the paths are the judged tree's,
     so a commit aimed elsewhere is consulted there rather than in the tree the shell happens to be. */
  const shown = named.slice(0, 6);
  const rest = named.length - shown.length;
  const files = `${shown.map(typed).join(" ")}${rest ? ` # and ${rest} more` : ""}`;
  const there = root === (ev.cwd ?? process.cwd()) ? "" : `cd ${typed(root)} && `;
  const each = held.length > 1 ? "each" : "it";
  const own = held.length > 1 ? "repositories of their own" : "a repository of its own";
  const holds = held.length > 1 ? "hold changes of their own" : "holds changes of its own";
  const action = named.length
    ? `\`${there}echo "<what you were doing, and what the advisor said>" | forge codex consult `
      + `--diff --base HEAD --only blocker,major ${files}\`, weigh what comes back, then re-send.`
    : `the work is inside ${held.map(typed).join(" ")}, ${own} — consult from inside ${each} on a file `
      + "there, then re-send. An empty one holds nothing to read.";
  /* A diff of this tree says nothing about a repository held inside it, so the command cannot be all. */
  const nested =
    named.length && held.length
      ? ` ${held.map(typed).join(" ")} ${holds}, outside that diff: consult in ${each} as well.`
      : "";

  deny(
    `The advisor has spoken; codex has not read ${
      closing
        ? `what this commit stages in ${root}, and this commit is where the turn stops being a draft`
        : "what is in the tree"
    }.${also}\n\n`
      + `Do this: ${action}${nested} `
      + `One consult of this tree clears its writes. ${ESCAPE}`
      + how(),
  );
};
