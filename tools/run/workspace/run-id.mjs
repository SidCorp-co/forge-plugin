/* One run, one lease holder: a wave's agents inherit the dispatching session's id, so the lease refuses nothing between
   two of them (ISS-445). Both records sit in the worktree's git directory, not the config directory a wave would race, and the scratch record is what is left here — the id is minted beside its reader in the plugin, since a dispatch's brief mints it too (ISS-467, ISS-1682). */
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SCRATCH, SCRATCH_AT, besideGit as beside, mintRunId, runIdAt, scratchAt } from "../../../plugin/src/resolve/session/run-id.mjs";

export { RUN_ID_VAR } from "../../../plugin/src/resolve/session/run-id.mjs";
export { SCRATCH, mintRunId, runIdAt, scratchAt };


export const scratchMinted = (path, id) => {
  const at = join(tmpdir(), `${SCRATCH}${id}`);
  const record = beside(path, SCRATCH_AT);
  if (record) writeFileSync(record, `${at}\n`);
  return at;
};
