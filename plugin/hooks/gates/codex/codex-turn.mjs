// Ask a second model to read what a turn changed, once per turn and checkout; the ledger records what was said and suppresses nothing here, because a file consulted and changed again owes the ask afresh (docs/cli/the-shown-ledger.md).

import { dirname, resolve } from "node:path";

import { hookRecord } from "../../../src/codex/codex.mjs";
import { inHome, runHomeAt } from "../../../src/resolve/session/run-home.mjs";
import { noteShown, sessionKey } from "../../../src/shown/ledger.mjs";
import { askedAlready, context, touched, transcriptOf, turnAt, turnRecords } from "../../_hook.mjs";

/* Each path into the record of the home its tree's run keeps, which the doors read it back from: one
   walk to the git directory per directory the call touched, on every Write, Edit and Bash. */
const byHome = (paths) => {
  const homes = new Map();
  const groups = new Map();
  for (const path of paths) {
    const dir = dirname(resolve(path));
    if (!homes.has(dir)) homes.set(dir, runHomeAt(dir));
    const home = homes.get(dir);
    groups.set(home, [...(groups.get(home) ?? []), path]);
  }
  return groups;
};

export const run = (ev) => {
  const at = turnAt(turnRecords(transcriptOf(ev)) ?? []);
  const told = (root) => askedAlready(ev, `${root} ${at}`, "codex-turn");
  let said = null;
  for (const [home, paths] of byHome(touched(ev))) {
    const one = inHome(home, () => hookRecord(ev, paths, told));
    said ??= one;
  }
  if (!said) return;
  noteShown(sessionKey(ev), "codex-turn", said);
  context(said);
};
