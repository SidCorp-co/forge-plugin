/* Node's own runner writes the stream, never this file: a typed one is a guess at the format, and the
   environment drops the mark node sets or a runner under it exits zero whatever its cases did. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

const SHELL_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT"));

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
