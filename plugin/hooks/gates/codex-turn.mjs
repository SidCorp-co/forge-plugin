// Ask a second model to read what a turn changed, once per turn and checkout; the ledger records what was said and suppresses nothing here, because a file consulted and changed again owes the ask afresh (docs/cli/the-shown-ledger.md).

import { hookRecord } from "../../src/codex/codex.mjs";
import { noteShown, sessionKey } from "../../src/shown/ledger.mjs";
import { askedAlready, context, touched, transcriptOf, turnAt, turnRecords } from "../_hook.mjs";

export const run = (ev) => {
  const at = turnAt(turnRecords(transcriptOf(ev)) ?? []);
  const told = (root) => askedAlready(ev, `${root} ${at}`, "codex-turn");
  const said = hookRecord(ev, touched(ev), told);
  if (!said) return;
  noteShown(sessionKey(ev), "codex-turn", said);
  context(said);
};
