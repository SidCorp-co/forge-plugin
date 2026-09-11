/* One run, one lease holder: a wave's agents inherit the dispatching session's id, so the lease refuses nothing between
   two of them (ISS-445). Both records sit in the worktree's git directory, not the config directory a wave would race, and the minting is what is left here — the plugin resolves a run's id off the same file (ISS-467). */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";

import { RUN_ID, besideGit as beside, heldBesideGit as heldAt, runIdAt } from "../../../plugin/src/resolve/session/run-id.mjs";

const SCRATCH_AT = "forge-run-scratch";

export const SCRATCH = "forge-run-";

const MINTED = /^iss-\d+-[0-9a-f]{8}$/u;

export { RUN_ID_VAR } from "../../../plugin/src/resolve/session/run-id.mjs";
export { runIdAt };

/** The directory `start` made, off the record it wrote and never derived again: `start` prints that path as the run's
 *  own `TMPDIR`, so a run doing what it is told moves the root a second derivation reads. Null unless the record is absolute and named as this mints them; past that it is trusted — a forged record is a write to the git directory. */
export const scratchAt = (path) => {
  const id = runIdAt(path);
  const at = heldAt(path, SCRATCH_AT);
  const named = Boolean(id) && MINTED.test(id) && basename(at ?? "") === `${SCRATCH}${id}`;
  return named && isAbsolute(at) ? at : null;
};

export const scratchMinted = (path, id) => {
  const at = join(tmpdir(), `${SCRATCH}${id}`);
  const record = beside(path, SCRATCH_AT);
  if (record) writeFileSync(record, `${at}\n`);
  return at;
};

export const mintRunId = (path, key) => {
  const id = `${key.toLowerCase()}-${randomUUID().slice(0, 8)}`;
  const at = beside(path, RUN_ID);
  if (at) writeFileSync(at, `${id}\n`);
  return id;
};
