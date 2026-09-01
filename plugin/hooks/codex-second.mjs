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

/* Nothing to review is not a rule worth enforcing, so the gate asks when the tree last changed, and
   which files: told only to consult, an agent guesses at what. `-z` neither quotes nor escapes, and
   gives a rename its old name in the field after it — either status column reports one. */
const changedAt = (root) => {
  const out =
    spawnSync("git", ["-C", root, "status", "--porcelain", "-z"], { encoding: "utf8", timeout: 5000 })
      .stdout ?? "";
  const rows = out.split("\0");
  let newest = 0;
  const named = [];
  for (let at = 0; at < rows.length; at += 1) {
    const path = rows[at].slice(3);
    if (!path) continue;
    if (/[RC]/u.test(rows[at].slice(0, 2))) at += 1;
    named.push(path);
    newest = Math.max(newest, climbed(join(root, path), root));
  }
  return { newest, named };
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
const { newest: changed, named } = changedAt(root);
if (changed === 0 || changed <= spentAt) process.exit(0);

/* The command it can send as it stands: six is a readable line, and the paths are the judged tree's,
   so a commit aimed elsewhere is consulted there rather than in the tree the shell happens to be. */
const shown = named.slice(0, 6);
const rest = named.length - shown.length;
const files = `${shown.map(typed).join(" ")}${rest ? ` # and ${rest} more` : ""}`;
const there = root === (ev.cwd ?? process.cwd()) ? "" : `cd ${typed(root)} && `;

deny(
  `The advisor has spoken; codex has not read what is in the tree${
    closing ? ", and this commit is where the turn stops being a draft" : ""
  }.\n\n`
    + `Do this: \`${there}echo "<what you were doing, and what the advisor said>" | forge codex consult `
    + `--diff --base HEAD --only blocker,major ${files}\`, weigh what comes back, then re-send. `
    + "One consult clears the turn's writes; `FORGE_CODEX_DISABLE=1` the session."
    + how(),
);
