/* Loaded by every launcher of the suite through `--import`, ahead of the file under test, so isolation
   from the shell that started a run does not turn on whether a file remembered to import a fixture: a
   file that imported none took a run's borrow into one case and a run's empty home into two others,
   and no shell a delegated run was handed passed the whole suite (ISS-2681). `fixtures.mjs` imports it
   too, for a file run by hand. A case wanting any of these sets it after this. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { madeIn } from "../room.mjs";

/* Which session a call resolves is the case's to name, never the shell's: a case's outcome turned on
   whether it ran inside a Claude Code session or from CI (ISS-2570). A borrow is the same kind of
   thing, and one inherited hands a case the machine's credential under a home it thinks is its own
   (ISS-2612). */
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.FORGE_SESSION_ID;
delete process.env.FORGE_BORROW_FROM;

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
