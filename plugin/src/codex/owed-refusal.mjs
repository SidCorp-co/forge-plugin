/* What the two door gates say, codex-owed before a call and codex-second before a commit: one record and
   one reader, so one wording. Each gate keeps what differs — the subject it judged and the tail naming it. */
import { configDir } from "../resolve/config.mjs";
import { OWED_DOORS } from "../resolve/settings.mjs";
import { offReach } from "../hooks/hook-switch.mjs";
import { typed } from "../hooks/shell-spans.mjs";
import { logBytes, logPath } from "./codex-log.mjs";
import { allPathed, verdictForm } from "./log/replies.mjs";

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

/** Consult `open` made findings nobody ruled on; `tail` is the gate's own account of what it judged. */
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
