/* One run, one lease holder: a wave's agents inherit the dispatching session's id, so the lease refuses nothing between
   two of them (ISS-445). Both records sit in the worktree's git directory, not the config directory a wave would race, and the minting is what is left here — the plugin resolves a run's id off the same file (ISS-467). */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RUN_ID, SCRATCH, SCRATCH_AT, besideGit as beside, runIdAt, scratchAt } from "../../../plugin/src/resolve/session/run-id.mjs";

export { RUN_ID_VAR } from "../../../plugin/src/resolve/session/run-id.mjs";
export { SCRATCH, runIdAt, scratchAt };


export const scratchMinted = (path, id) => {
  const at = join(tmpdir(), `${SCRATCH}${id}`);
  const record = beside(path, SCRATCH_AT);
  if (record) writeFileSync(record, `${at}\n`);
  return at;
};

export const mintRunId = (path, keys) => {
  const [head, ...batch] = keys.map((one) => one.toLowerCase());
  const id = `${[head, ...batch.map((one) => one.slice(4))].join("+")}-${randomUUID().slice(0, 8)}`;
  const at = beside(path, RUN_ID);
  if (at) writeFileSync(at, `${id}\n`);
  return id;
};
