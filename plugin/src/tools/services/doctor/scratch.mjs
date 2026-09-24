/* Where this run writes its own files, under the session id because it is the same fact about a
   wave: a directory keyed on an inherited id is every sibling's (ISS-1344). docs/cli/doctor.md. */
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { INHERITED, sessionSourced } from "../../../resolve/config.mjs";
import { SCRATCH_AT, scratchAt } from "../../../resolve/session/run-id.mjs";
import { NOTE, OK } from "./showing.mjs";

const SHARED = "a directory keyed on that id, the host's own scratchpad among them, is shared by "
  + "every run of the wave that inherited it, and so is the system's temporary directory";

/** The level and the text of the `scratch` row, off the tree at `here`. */
export const scratchRow = (here = process.cwd()) => {
  const temp = tmpdir();
  const recorded = scratchAt(here);
  if (recorded) {
    const from = `${recorded}  ← ${SCRATCH_AT} beside this tree's git directory, this run's own`;
    if (resolve(recorded) === resolve(temp)) return { level: OK, said: `${from}, and TMPDIR names it` };
    return {
      level: NOTE,
      said: `${from}; TMPDIR names ${temp}, so a file written there is not in it: export TMPDIR=${recorded}`,
    };
  }
  const none = `none recorded for this tree, so a file this run writes goes under ${temp}`;
  if (sessionSourced().source !== INHERITED) return { level: OK, said: none };
  return {
    level: NOTE,
    said: `${none}; the session id was inherited, and where this run was dispatched ${SHARED}. `
      + "Write in a directory of this run's own, made with `mktemp -d`",
  };
};
