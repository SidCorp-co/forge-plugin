/* Loaded by every launcher of the suite through `--import`, ahead of the file under test, so isolation
   from the shell that started a run does not turn on whether a file remembered to import a fixture: a
   file that imported none took a run's borrow into one case and a run's empty home into two others,
   and no shell a delegated run was handed passed the whole suite (ISS-2681). `fixtures.mjs` imports it
   too, for a file run by hand. A case wanting any of these sets it after this. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { madeIn } from "../room.mjs";

delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_ENV_FILE;

// cm:why the session and every FORGE_* are the case's, not the shell's: a session split CI from Claude Code (ISS-2570), a borrow leaked a credential (ISS-2612), FORGE_STOP_DISABLE turned cases red (ISS-112); a rule covers a later switch
// cm:why FORGE_GATE_STEP passes: the gate's stop finds a step's orphans by it; no case reads it
const PASSES = new Set(["FORGE_GATE_STEP"]);
for (const key of Object.keys(process.env)) {
  if (key.startsWith("FORGE_") && !PASSES.has(key)) delete process.env[key];
}

/* The configuration home is the process's own and empty, so a case reading configuration it never
   wrote fails the same way on every machine instead of passing on the developer's credentials. It is
   made under the same temporary directory and prefix `fixtures.mjs` sweeps for dead owners, so a
   process killed before its exit handler leaves its home to the next process importing the fixture. */
const prefix = join(tmpdir(), `forge-plugin-test-${process.pid}-config-`);
const home = madeIn(prefix, () => mkdtempSync(prefix));
process.on("exit", () => rmSync(home, { recursive: true, force: true }));
process.env.XDG_CONFIG_HOME = home;

/* Git's configuration is the developer's too: a bare origin took its HEAD from the home's
   `init.defaultBranch`, so cases passed or failed by machine (ISS-2592). */
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";
/* So is an identity the shell exports: it outranks the one a fixture writes (ISS-2912). */
for (const key of ["NAME", "EMAIL", "DATE"]) {
  delete process.env[`GIT_AUTHOR_${key}`];
  delete process.env[`GIT_COMMITTER_${key}`];
}
