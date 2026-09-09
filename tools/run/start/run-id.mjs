/* One run, one lease holder: every agent a session dispatches inherits that session's id, so a wave
   is one holder and the lease refuses nothing between two of them (ISS-445). The id lives in the
   worktree's git directory, never in the config directory, which every run of a wave would race. */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gitOut } from "../../checkout.mjs";

const RUN_ID = "forge-run-id";

export const RUN_ID_VAR = "FORGE_SESSION_ID";

const runIdPath = (path) => {
  const dir = gitOut(["rev-parse", "--absolute-git-dir"], path);
  return dir ? join(dir, RUN_ID) : null;
};

export const runIdAt = (path) => {
  const at = runIdPath(path);
  if (!at || !existsSync(at)) return null;
  return readFileSync(at, "utf8").trim() || null;
};

export const mintRunId = (path, key) => {
  const id = `${key.toLowerCase()}-${randomUUID().slice(0, 8)}`;
  const at = runIdPath(path);
  if (at) writeFileSync(at, `${id}\n`);
  return id;
};
