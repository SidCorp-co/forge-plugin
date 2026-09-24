/* The `scratch` row: where this run's own files go, and whether the directory it would use is the
   wave's. Two runs of one wave wrote one plan between them because nothing said the directory they
   were each handed was shared (ISS-1344). Every case spawns the report in a checkout of its own. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { cleanRepo, escaped, tempRoom } from "../../../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "src", "cli.mjs");
const RUN = "iss-7-0123abcd";

/** A checkout whose git directory carries the two records a started run leaves, or none. */
const checkout = (started) => {
  const room = cleanRepo();
  const scratch = join(tempRoom("scratch-root-"), `forge-run-${RUN}`);
  mkdirSync(scratch);
  if (started) {
    writeFileSync(join(room, ".git", "forge-run-id"), `${RUN}\n`);
    writeFileSync(join(room, ".git", "forge-run-scratch"), `${scratch}\n`);
  }
  return { room, scratch };
};

const rowOf = (cwd, extra) => {
  const home = tempRoom("scratch-home-");
  const run = spawnSync(process.execPath, [CLI, "doctor", "machine"], {
    encoding: "utf8",
    cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, ...extra },
  });
  const row = run.stdout.split("\n").find((one) => /^\[[^\]]+\] scratch /u.test(one));
  assert.ok(row, `the report printed no scratch row: ${run.stdout}${run.stderr}`);
  return row;
};

test("a recorded scratch directory is named with the record it was read from", () => {
  const { room, scratch } = checkout(true);
  const row = rowOf(room, { TMPDIR: scratch });
  assert.match(row, new RegExp(`^\\[ {2}ok {2}\\] scratch\\s+${escaped(scratch)}\\s+← forge-run-scratch beside this tree's git directory`, "u"));
  assert.match(row, /TMPDIR names it/u, "and it says TMPDIR already agrees");
});

test("a recorded directory TMPDIR does not name carries the export that makes them agree", () => {
  const { room, scratch } = checkout(true);
  const elsewhere = tempRoom("scratch-elsewhere-");
  const row = rowOf(room, { TMPDIR: elsewhere });
  assert.match(row, /^\[ note \] scratch /u);
  assert.ok(row.endsWith(`export TMPDIR=${scratch}`), `the row does not end on the export: ${row}`);
});

test("no record under an inherited id is a note naming the wave and the command that makes a directory", () => {
  const { room } = checkout(false);
  const row = rowOf(room, { CLAUDE_CODE_SESSION_ID: "the-dispatching-session" });
  assert.match(row, /^\[ note \] scratch\s+none recorded for this tree/u);
  assert.match(row, /the session id was inherited/u, "what makes it shared");
  assert.match(row, /shared by every run of the wave that inherited it/u, "who it is shared with");
  assert.match(row, /`mktemp -d`/u, "and the one command that makes a directory of the run's own");
});

test("no record under the run's own id is at ok level", () => {
  const { room } = checkout(false);
  const row = rowOf(room, { FORGE_SESSION_ID: "one-run-of-a-wave" });
  assert.match(row, /^\[ {2}ok {2}\] scratch\s+none recorded for this tree/u);
  assert.doesNotMatch(row, /mktemp/u, "and it asks the run for nothing");
});
