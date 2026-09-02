// Record what a turn changed and ask once per turn and checkout for a second model to read it.

import { hookRecord } from "../../src/codex.mjs";
import { askedAlready, context, touched, turnAt, turnRecords } from "../_hook.mjs";

export const run = (ev) => {
  const at = turnAt(turnRecords(ev.transcript_path ?? "") ?? []);
  const told = (root) => askedAlready(ev, `${root} ${at}`, "codex-turn");
  const said = hookRecord(ev, touched(ev), told);
  if (said) context(said);
};
