// A commit waits for what a consult owes on what it stages: unread documents, unruled findings. how/codex-second.md.

import { resolve } from "node:path";

import { ageOf, apartFrom, demandIn, pendingNow, pendingState, stagedIn } from "../../../src/codex/codex.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";
import { allPathed, listed, unverdicted } from "../../../src/codex/log/replies.mjs";
import { DROP, consultFor, downSaid, escapeFor, logReader, malformed, readIn, unreadApart, unruled } from "../../../src/codex/log/owed-refusal.mjs";
import { unreadSaid } from "../../../src/codex/log/unavailable.mjs";
import { inRunHome } from "../../../src/resolve/session/run-home.mjs";
import { codexOwedOf, enumOf, projectFileAt } from "../../../src/resolve/settings.mjs";
import { probeMs } from "../../../src/hooks/git-probe.mjs";
import { treeNamed } from "../../../src/git/tree-named.mjs";
import {
  REDIRECT,
  COMMITS,
  committing,
  deny,
  directoryAt,
  gitTreeOf,
  NOWHERE,
  quotedOut,
  shellText,
  spans,
  spelled as bare,
  typed,
  wordsIn,
  context, how, done, remaining } from "../../_hook.mjs";

/* What the commit closes over, from that command alone: a pipeline's flags are not the commit's, and
   neither is a redirect's target or a value a flag ate — `-am x` is all and a message, `-ma` a message
   alone, `-uall` neither. A pathspec needs no `--`, and an escaped space is inside one word. */
const NEEDS_VALUE =
  /^--(?:message|file|reuse-message|reedit-message|author|date|template|cleanup|fixup|squash|trailer|pathspec-from-file)$/u;
const EATS_NEXT = "mFCct";
const EATS_REST = "uS";
const OPAQUE = ["--pathspec-from-file", "--patch", "--interactive"];
/* Two commits in one call are two shapes with one answer, a pathspec list in a file is one this cannot
   read, and `--patch` picks after the hook answers: each asks for the record whole. */
const TWICE = new RegExp(COMMITS.source, "gu");
/* A relative `-C` is that tree from where the shell stands, which a move before this commit — and
   not one after it — has changed. Unplaced, as the text spells it: the caller places it against the event's cwd. */
const treeAt = (text, one) =>
  treeNamed(directoryAt(text, one.index), gitTreeOf(text.slice(one.index, one.index + one[0].length)));

export const commitAim = (ev) => {
  const text = shellText((ev.tool_input ?? {}).command);
  /* Matched where quoted data is inert and read back from the text itself, the two being one length. */
  const made = [...quotedOut(text).matchAll(TWICE)];
  const found = made[0];
  if (!found) return { tree: null, all: false, paths: [], others: [] };
  let unknown = made.length > 1;
  const from = found.index + found[0].length;
  const { end } = spans(text, { pipes: true }).find((one) => one.start <= from && from <= one.end)
    ?? { end: text.length };
  const tokens = wordsIn(text.slice(from, end).replace(REDIRECT, " "));
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

const GATE = "codex-second";
const ESCAPE = escapeFor(GATE);
const DOOR = "commit";

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

/* The staged demand, then the unruled findings, then what an advisory reading let through unread,
   said last because it refuses nothing: the caller picks the home all three are read under. */
const judged = (ev, root, aim, staged, also, consult) => {
  /* Recorded this turn or a turn ago, staged here, and unread at the bytes this commit carries — the
     index with no `-a`: 7 of 30 landed unread, and an exact revert owed a consult with nothing in it. */
  const waiting = pendingState(root);
  const log = logReader();
  const asked = demandIn(waiting.files, staged);
  const apart = aim.all ? [] : apartFrom(root, asked, probeMs(remaining()));
  const owed = pendingNow(root, asked, log, { apart, ms: probeMs(remaining()) }).owed;
  const { owed: demand, unread, down } = unreadApart(root, owed, log, consult, apart);
  if (demand.length) {
    const cd = root === (ev.cwd ?? process.cwd()) ? "" : `cd ${typed(root)} && `;
    /* Every consult reads the working copy, so for a path the index holds apart from it no consult clears the hold and naming one is a refusal nobody can act on: staging what was read is the route (ISS-1011). */
    const stale = demand.filter((rel) => apart.includes(rel));
    const unread = demand.filter((rel) => !apart.includes(rel));
    const consult = consultFor(cd, unread);
    const stage = `\`${cd}git add ${allPathed(stale)}\`, or commit with \`-a\``;
    deny(
      `${unread.length ? `Run ${consult}` : `Stage what was read — ${stage}`}`
        + `${unread.length && stale.length ? `, and stage what was read — ${stage}` : ""}. Then re-send. `
        + `${readIn()} ${DROP} ${ESCAPE}\n\n`
        + `Codex has not read what this commit stages in ${root} (${listed(demand)}, recorded ${ageOf(waiting.at)}).${also}`
        + `${stale.length ? ` The staged copy of ${listed(stale)} is not the copy on disk a consult would `
          + `read, so no consult clears ${stale.length > 1 ? "them" : "it"}.` : ""}${downSaid(down)}`
        + how(),
    );
  }
  /* 37 consults made findings nobody ruled on, and the next consult then read "still open" as a guess. */
  const open = unverdicted(log(), root);
  if (open) {
    deny(unruled(open, GATE, `.${also}`) + how());
  }
  if (unread.length) context(unreadSaid(DOOR, unread));
};

export const run = (ev) => {
  if (!committing(ev) || process.env.FORGE_CODEX_DISABLE === "1") done();

  /* The tree the commit names, not the shell's; and a commit is in it by construction, redirect or not. */
  const aim = commitAim(ev);
  /* This gate's answer to a directory no reading can settle is a refusal, never the event's cwd: that
     is a different repository's answer, and no tree means no way to ask what the commit stages.
     Ahead of the door key, which is that tree's to set and unreadable while the tree is. */
  if (aim.tree === NOWHERE) {
    deny(
      "Spell the tree out — `cd <path> && git commit …`, or `git -C <path> commit …` — then re-send. "
        + `${ESCAPE}\n\n`
        + "Which tree this commit closes over cannot be read from the command — a `cd -`, a bare `cd` or a "
        + "destination built from a value names no directory this reading can check, so what the commit "
        + "stages cannot be asked for."
        + how(),
    );
  }
  const at = resolve(ev.cwd ?? process.cwd(), aim.tree ?? ".");
  const projectFile = projectFileAt(at);
  const owed = codexOwedOf(projectFile?.codex);
  if (owed.unknown) deny(`${malformed(owed.unknown, GATE)}${how()}`);
  if (!owed.value.includes(DOOR)) done();
  const root = repoRoot(at);
  if (!root) done();

  const also = unjudged(ev, root, aim.others);
  /* Asked for what it stages; a commit this cannot enumerate names nothing, so the record stands whole. */
  const staged = stagedIn(root, aim, probeMs(remaining()));

  /* The tree's record where its own run keeps it, through the reader the call doors take. */
  /* Off the record the door key was read from, before the run home moves the configuration. */
  const consult = enumOf("codex.consult", projectFile).value;
  inRunHome(root, () => judged(ev, root, aim, staged, also, consult));
  done();
};
