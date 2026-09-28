/* What the cases about a spent room share: a git that fails the way git fails under a quota, and the
   gate's refusal channel pointed at a note of the case's own, so a refusal provoked on purpose never
   reads to the gate running this suite as the machine refusing it. Not a `.test.mjs`. */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../../plugin/test/fixtures.mjs";
import { ROOM_ENV } from "../../../../plugin/test/fixtures/room.mjs";

const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();

/** Runs `use` with a git on PATH that answers any call naming `verb` with `said` on stderr and exit
 *  128, and hands every other call to the real git. */
export const gitFailing = (verb, said, use) => {
  const bin = join(tempRoom("failing-git-"), "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), `#!${process.execPath}
import { spawnSync } from "node:child_process";
const argv = process.argv.slice(2);
if (argv.includes(${JSON.stringify(verb)})) {
  process.stderr.write(${JSON.stringify(`${said}\n`)});
  process.exit(128);
}
process.exit(spawnSync(${JSON.stringify(REAL_GIT)}, argv, { stdio: "inherit" }).status ?? 1);
`, { mode: 0o755 });
  const was = process.env.PATH;
  process.env.PATH = `${bin}:${was}`;
  try {
    return use();
  } finally {
    process.env.PATH = was;
  }
};

/** Runs `use` with the refusal channel at a note of this case's own, which `use` is handed. */
export const noted = (use) => {
  const was = process.env[ROOM_ENV];
  const note = join(tempRoom("refusal-note-"), "room");
  process.env[ROOM_ENV] = note;
  try {
    return use(note);
  } finally {
    if (was === undefined) delete process.env[ROOM_ENV];
    else process.env[ROOM_ENV] = was;
  }
};
