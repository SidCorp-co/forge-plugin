// The advisor has spoken and there is work in the tree: the second opinion happens before the next
// write, not at some end the turn may never reach. And a commit waits for what a consult still owes:
// documents recorded and never read, findings nobody ruled on. how/codex-second.md.

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { ageOf, pendingState, repoRoot } from "../../src/codex.mjs";
import { lastConsultAt, logEntries, unverdicted } from "../../src/codex-log.mjs";
import {
  advisedThisTurn,
  commitTree,
  committing,
  deny,
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

/* Past WALK paths the tree reads as changed now: a stat per path outran a ten-second hook, and a
   pre-hook killed is a gate open. `-z` neither quotes nor escapes; a rename's old name is the next field. */
const WALK = 500;
const changedAt = (root) => {
  const out =
    spawnSync("git", ["-C", root, "status", "--porcelain", "-z", "-uall"], {
      encoding: "utf8",
      timeout: Math.max(500, Math.min(5000, remaining() - 1000)),
    })
      .stdout ?? "";
  const rows = out.split("\0");
  let newest = 0;
  const named = [];
  const held = [];
  let walked = 0;
  for (let at = 0; at < rows.length; at += 1) {
    const path = rows[at].slice(3);
    if (!path) continue;
    if (/[RC]/u.test(rows[at].slice(0, 2))) at += 1;
    /* A directory survives `-uall` only as a repository of its own: work this tree cannot hand over
       as a file, and going quiet about it is the silence the gate exists to break. */
    (path.endsWith("/") ? held : named).push(path);
    walked += 1;
    newest = walked > WALK ? Date.now() : Math.max(newest, climbed(join(root, path), root));
  }
  return { newest, named, held };
};

const typed = (one) =>
  /^[\w./@+][\w./@+-]*$/u.test(one) ? one : `'${one.replace(/'/gu, String.raw`'\''`)}'`;

export const run = (ev) => {
  const closing = committing(ev);

  if ((!writing(ev) && !closing) || process.env.FORGE_CODEX_DISABLE === "1") done();

  /* The tree the commit names, not the shell's; and a commit is in it by construction, redirect or not. */
  const root = repoRoot(resolve(ev.cwd ?? process.cwd(), commitTree(ev) ?? "."));
  if (!root) done();

  const records = process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1" ? null : turnRecords(ev.transcript_path ?? "");
  const advised = Boolean(records && advisedThisTurn(records) && (closing || writesInside(ev, root)));
  const spentAt = lastConsultAt(root);
  const { newest: changed, named, held } = advised ? changedAt(root) : { newest: 0, named: [], held: [] };
  const owed = advised && (closing || unspentAdvice(records, spentAt)) && changed > 0 && changed > spentAt;

  if (!owed && closing) {
    /* Recorded this turn or a turn ago, and never read: 7 of 30 commits landed with the list unread. */
    const waiting = pendingState(root);
    if (waiting.files.length) {
      deny(
        `Codex has not read the documents this tree recorded (${waiting.files.slice(0, 6).map(typed).join(" ")}`
          + `${waiting.files.length > 6 ? ` and ${waiting.files.length - 6} more` : ""}, recorded ${ageOf(waiting.at)}).\n\n`
          + 'Do this: `echo "<what you were doing>" | forge codex consult --diff --only blocker,major`, then re-send. '
          + "`forge codex pending --drop` discards them unread; `FORGE_CODEX_DISABLE=1` the session."
          + how(),
      );
    }
    /* 37 consults made findings nobody ruled on, and the next consult then read "still open" as a guess. */
    const open = unverdicted(logEntries(), root);
    if (open) {
      deny(
        `Consult ${open.id} made ${open.ids.join(", ")} on ${open.files.join(", ")}; nothing says what became of ${open.open.join(", ")}.\n\n`
          + `Do this: \`forge codex verdict --of ${open.id} --accepted <ids> --rejected <id>=<why>\`, then re-send. `
          + "A --recheck records the verdict for what it refutes; `FORGE_CODEX_DISABLE=1` the session."
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
    `The advisor has spoken; codex has not read what is in the tree${
      closing ? ", and this commit is where the turn stops being a draft" : ""
    }.\n\n`
      + `Do this: ${action}${nested} `
      + "One consult of this tree clears its writes; `FORGE_CODEX_DISABLE=1` the session."
      + how(),
  );
};
