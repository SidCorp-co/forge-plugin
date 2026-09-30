/* What the two door gates say, codex-owed before a call and codex-second before a commit: one record and
   one reader, so one wording. Each gate keeps what differs — the subject it judged and the tail naming it. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { configDir } from "../../resolve/config.mjs";
import { gateway } from "../../resolve/machine/stores.mjs";
import { digest } from "../codex-api.mjs";
import { ADVISORY_ROUTE, consultState, failedAt, passesUnread } from "./unavailable.mjs";
import { OWED_DOORS } from "../../resolve/settings.mjs";
import { offReach } from "../../hooks/hook-switch.mjs";
import { typed } from "../../hooks/shell-spans.mjs";
import { logBytes, logPath } from "../codex-log.mjs";
import { allPathed, verdictForm } from "./replies.mjs";

/** The switch a refused agent can reach, first, and then the variable as what it is: written as a
 *  prefix on the refused command it reached no hook, and that refusal named no way out (ISS-70). */
export const escapeFor = (gate) => `Past the gate: \`forge hooks --off ${gate}\`, ${offReach(gate)} — an inline `
  + "`FORGE_CODEX_DISABLE=1` prefix never reaches a hook.";

/** The record and the log resolve under XDG_CONFIG_HOME, and a hook reads the session's or the tree's
 *  run home, so a consult made under another one is recorded where this never looks: unsaid, that
 *  refused files a consult had already read while `pending` answered nothing pending (ISS-189). */
export const readIn = () => `Read from ${typed(configDir("forge"))}, so a consult recorded under another `
  + "XDG_CONFIG_HOME clears nothing here.";

export const malformed = (unknown, gate) => `Name only doors out of ${OWED_DOORS.join(", ")} in \`codex.owed\`, `
  + `or drop the key and the commit alone asks. ${escapeFor(gate)}\n\n${unknown} is no door this reads: that key `
  + "in this project's configuration is a list of the doors a consult is demanded at.";

/** The consult that reads `paths`, from the tree `cd` moves to ("" where the caller already stands there). */
export const consultFor = (cd, paths) =>
  `\`${cd}echo "<what you were doing>" | forge codex consult --diff --only blocker,major ${allPathed(paths)}\``;

export const DROP = "`forge codex pending --drop` discards them unread.";

/** The refusal over `open`'s unruled findings; `tail` is the gate's own account of what it judged. */
export const unruled = (open, gate, tail) =>
  `Run \`${verdictForm(open.id)}\`, then re-send. ${readIn()} `
  + `A --recheck records the verdict for what it refutes. ${escapeFor(gate)}\n\n`
  + `Consult ${open.id} made ${open.ids.join(", ")} on ${open.files.join(", ")}; nothing says what `
  + `became of ${open.open.join(", ")}${tail}`;

/** The log, parsed once per home it resolves to for the life of one reader: a call gating two trees
 *  under one home reads it once. One reader per call, since one outliving the call answers from a log
 *  that has moved. */
export const logReader = () => {
  const held = new Map();
  return () => {
    const at = logPath();
    if (!held.has(at)) held.set(at, logBytes());
    return held.get(at);
  };
};

const bytesOf = (root, rel) => {
  try {
    return digest(readFileSync(join(root, rel), "utf8"));
  } catch {
    return null;
  }
};

/** Of the files a door owes, the ones the project's `consult` reading lets through unread — each with
 *  its reason — the ones still owed, and of those the ones the gateway rather than the agent left
 *  unread, which the refusal names. `apart` are files whose staged copy is not the disk's. */
export const unreadApart = (root, owed, log, consult, apart = []) => {
  if (!owed.length) return { owed, unread: [], down: [] };
  const configured = !gateway().problem;
  const unread = [];
  const left = [];
  const down = [];
  for (const rel of owed) {
    const sha = apart.includes(rel) ? null : bytesOf(root, rel);
    const failed = configured && sha ? failedAt(log(), root, rel, sha) : null;
    const { state, reason } = consultState({ failed, gateway: configured });
    /* A staged copy apart from the disk has no bytes a consult could have failed on, so it reads as
       unasked where a gateway answers and as no gateway where none is configured. */
    if (passesUnread(state, consult)) unread.push({ rel, reason });
    else left.push(rel);
    if (!passesUnread(state, consult) && reason) down.push({ rel, reason });
  }
  return { owed: left, unread, down };
};

/** The sentence a door's refusal adds for the files the gateway could not give, or nothing. */
export const downSaid = (down) => (down.length
  ? ` What left ${down.map((one) => `${one.rel} unread is the gateway, not a skipped consult: ${one.reason}`).join("; ")}. ${ADVISORY_ROUTE}`
  : "");
