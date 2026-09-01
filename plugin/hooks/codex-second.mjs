#!/usr/bin/env node
// The advisor has spoken and there is work in the tree: the second opinion happens before the next
// write, not at some end the turn may never reach. how/codex-second.md.

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { repoRoot } from "../src/codex.mjs";
import { lastConsultAt } from "../src/codex-log.mjs";
import {
  advisedThisTurn,
  commitTree,
  committing,
  deny,
  readEvent,
  turnRecords,
  unspentAdvice,
  how,
  writesInside,
  writing,
} from "./_hook.mjs";

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

/* Which files changed, and when: told only to consult, an agent guesses at what. `-z` neither quotes
   nor escapes, `-uall` uncollapses an untracked directory, and a rename's old name is the next field. */
const changedAt = (root) => {
  const out =
    spawnSync("git", ["-C", root, "status", "--porcelain", "-z", "-uall"], {
      encoding: "utf8",
      timeout: 5000,
    })
      .stdout ?? "";
  const rows = out.split("\0");
  let newest = 0;
  const named = [];
  const held = [];
  for (let at = 0; at < rows.length; at += 1) {
    const path = rows[at].slice(3);
    if (!path) continue;
    if (/[RC]/u.test(rows[at].slice(0, 2))) at += 1;
    /* A directory survives `-uall` only as a repository of its own: work this tree cannot hand over
       as a file, and going quiet about it is the silence the gate exists to break. */
    (path.endsWith("/") ? held : named).push(path);
    newest = Math.max(newest, climbed(join(root, path), root));
  }
  return { newest, named, held };
};

const typed = (one) =>
  /^[\w./@+][\w./@+-]*$/u.test(one) ? one : `'${one.replace(/'/gu, String.raw`'\''`)}'`;

const ev = readEvent();
const closing = committing(ev);

if (
  (!writing(ev) && !closing)
  || process.env.FORGE_CODEX_DISABLE === "1"
  || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1"
) {
  process.exit(0);
}

const records = turnRecords(ev.transcript_path ?? "");
/* The tree the commit names, not the shell's; and a commit is in it by construction, redirect or not. */
const root = repoRoot(resolve(ev.cwd ?? process.cwd(), commitTree(ev) ?? "."));
if (!records || !root || !advisedThisTurn(records) || (!closing && !writesInside(ev, root))) {
  process.exit(0);
}

const spentAt = lastConsultAt(root);
if (!closing && !unspentAdvice(records, spentAt)) process.exit(0);

/* Asked at every write: decided once, it was decided at the first, on the tree the advisor left. */
const { newest: changed, named, held } = changedAt(root);
if (changed === 0 || changed <= spentAt) process.exit(0);

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
  `The advisor has spoken; codex has not read what is in the tree${
    closing ? ", and this commit is where the turn stops being a draft" : ""
  }.\n\n`
    + `Do this: ${action}${nested} `
    + "One consult of this tree clears its writes; `FORGE_CODEX_DISABLE=1` the session."
    + how(),
);
