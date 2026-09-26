// Ask a second model to read what a turn changed, once per turn and checkout; the ledger records what was said and suppresses nothing here, because a file consulted and changed again owes the ask afresh (docs/cli/the-shown-ledger.md).

import { dirname, resolve } from "node:path";

import { hookRecord } from "../../../src/codex/codex.mjs";
import { inRunHome, runHomeAt } from "../../../src/resolve/session/run-home.mjs";
import { noteShown, sessionKey } from "../../../src/shown/ledger.mjs";
import { askedAlready, context, touched, transcriptOf, turnAt, turnRecords } from "../../_hook.mjs";

/* Each path into the record of the home its tree's run keeps, which the doors read it back from. */
const byHome = (paths) => {
  const groups = new Map();
  for (const path of paths) {
    const home = runHomeAt(dirname(resolve(path))) ?? "";
    groups.set(home, [...(groups.get(home) ?? []), path]);
  }
  return [...groups.values()];
};

export const run = (ev) => {
  const at = turnAt(turnRecords(transcriptOf(ev)) ?? []);
  const told = (root) => askedAlready(ev, `${root} ${at}`, "codex-turn");
  let said = null;
  for (const paths of byHome(touched(ev))) {
    const one = inRunHome(dirname(resolve(paths[0])), () => hookRecord(ev, paths, told));
    said ??= one;
  }
  if (!said) return;
  noteShown(sessionKey(ev), "codex-turn", said);
  context(said);
};
