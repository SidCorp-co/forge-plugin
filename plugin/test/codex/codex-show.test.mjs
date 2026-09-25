import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

/* `show` prints the record whole and `pending` what a commit is asked for, so the one read first names
   the other rather than claiming its word (ISS-45). */
test("show labels the record what it is and names the verb that says what a commit is asked for", () => {
  const forge = new URL("../../bin/forge", import.meta.url).pathname;
  const home = tempRoom("codex-show-home-");
  const room = tempRoom("codex-show-");
  spawnSync("git", ["init", "-q"], { cwd: room });
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: room, encoding: "utf8" }).stdout.trim();
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex.json"),
    JSON.stringify({ turns: { [root]: { files: ["work.mjs"], at: new Date().toISOString() } } }));
  const run = spawnSync(forge, ["codex", "show"],
    { cwd: room, encoding: "utf8", env: { ...process.env, HOME: home, XDG_CONFIG_HOME: home } });
  const line = run.stdout.split("\n").find((one) => one.startsWith("recorded")) ?? "";
  assert.match(line, /^recorded {2}: work\.mjs — `forge codex pending` says which of them a commit is asked for$/u, run.stdout);
  assert.doesNotMatch(run.stdout, /^pending\s*:/mu, "the word is the other verb's");
});
