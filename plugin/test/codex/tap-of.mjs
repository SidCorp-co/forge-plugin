/* A TAP stream from node's own runner rather than one typed into a fixture: a stream written out by
   hand is a guess at the format, and reading TAP instead of failure words rests on it not being one. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { SHELL_ENV, tempRoom } from "../fixtures.mjs";

export const tapOf = (cases, prefix = "tap-of-") => {
  const room = tempRoom(prefix);
  const file = join(room, "s.test.mjs");
  writeFileSync(file, `import test from "node:test";\n${cases}`);
  try {
    execFileSync(process.execPath, ["--test", "--test-reporter=tap", "--test-reporter-destination=stdout", file],
      { cwd: room, encoding: "utf8", env: SHELL_ENV, stdio: ["ignore", "pipe", "pipe"] });
  } catch (refused) {
    return { out: `${refused.stdout ?? ""}${refused.stderr ?? ""}`, file, room };
  }
  throw new Error("the fixture suite was meant to fail and did not");
};
