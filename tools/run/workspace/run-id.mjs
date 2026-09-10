/* One run, one lease holder: a wave's agents inherit the dispatching session's id, so the lease refuses nothing between
   two of them (ISS-445). Both records sit in the worktree's git directory, not the config directory a wave would race. */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join } from "node:path";

import { gitOut } from "../../checkout.mjs";

const RUN_ID = "forge-run-id";

const SCRATCH_AT = "forge-run-scratch";

export const RUN_ID_VAR = "FORGE_SESSION_ID";

export const SCRATCH = "forge-run-";

const MINTED = /^iss-\d+-[0-9a-f]{8}$/u;

const beside = (path, name) => {
  const dir = gitOut(["rev-parse", "--absolute-git-dir"], path);
  return dir ? join(dir, name) : null;
};

const heldAt = (path, name) => {
  const at = beside(path, name);
  if (!at || !existsSync(at)) return null;
  return readFileSync(at, "utf8").trim() || null;
};

export const runIdAt = (path) => heldAt(path, RUN_ID);

/** The directory `start` made, off the record it wrote and never derived again: `start` prints that path as the run's
 *  own `TMPDIR`, so a run doing what it is told moves the root a second derivation reads. Null unless the record is
 *  absolute and named as this mints them; past that it is trusted — a forged record is a write to the git directory. */
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
