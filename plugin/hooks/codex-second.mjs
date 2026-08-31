#!/usr/bin/env node
// The advisor has spoken and there is work in the tree: the second opinion happens before the next
// write, not at some end the turn may never reach. docs/HOOKS.md.

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "../src/codex.mjs";
import { lastConsultAt } from "../src/codex-log.mjs";
import {
  adviceAt,
  advisedThisTurn,
  askedAlready,
  deny,
  readEvent,
  transcript,
  unspentAdvice,
  writing,
} from "./_hook.mjs";

/* Nothing to review is not a rule worth enforcing, so the gate asks when the tree last changed. A
   deleted file has no mtime and is missed; a deletion alone is not what this is for. */
const changedAt = (root) => {
  const out =
    spawnSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8", timeout: 5000 })
      .stdout ?? "";
  let newest = 0;
  for (const row of out.split("\n")) {
    const rel = row.slice(3).trim();
    if (!rel) continue;
    try {
      newest = Math.max(newest, statSync(join(root, rel)).mtimeMs);
    } catch {
      /* gone from the disk */
    }
  }
  return newest;
};

const ev = readEvent();

if (
  !writing(ev)
  || process.env.FORGE_CODEX_DISABLE === "1"
  || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1"
) {
  process.exit(0);
}

const records = transcript(ev.transcript_path ?? "");
const root = repoRoot(ev.cwd ?? process.cwd());
if (!records || !root || !advisedThisTurn(records)) process.exit(0);

const spentAt = lastConsultAt(root);
if (!unspentAdvice(records, spentAt)) process.exit(0);

/* One decision per advisor call, not per write: deciding again mid-build would refuse the second
   write of a turn and send codex a fragment. So a stand-down is remembered, a refusal is not, and
   the next advisor call re-arms the whole question. docs/HOOKS.md. */
const key = `advice-${adviceAt(records)}`;
if (askedAlready(ev, key, "codex-second", { set: false })) process.exit(0);

const changed = changedAt(root);
if (changed === 0 || changed <= spentAt) {
  askedAlready(ev, key, "codex-second");
  process.exit(0);
}

deny(
  "The advisor has spoken; codex has not read what is in the tree.\n\n"
    + "Nothing else makes this happen — the reminder at the end of a turn is context an agent can "
    + "ignore, and it was. So the second opinion lands here, where the first one already did.\n\n"
    + "Do this: `echo \"<what you were doing, and what the advisor said>\" | forge codex consult "
    + "--diff --only blocker,major`, weigh what comes back, then re-send. One consult clears this "
    + "for the rest of the turn; `FORGE_CODEX_DISABLE=1` clears it for the session.",
);
