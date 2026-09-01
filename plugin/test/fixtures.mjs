/* How Claude Code calls a gate. Unwrapping the answer stays each suite's: `deny()` and `block()` do
   not answer alike, and the git rules need a tree with work to lose. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const callHook = (hook, event, env = process.env) =>
  spawnSync(process.execPath, [hook], { input: JSON.stringify(event), encoding: "utf8", env });

export const homeEnv = (name) => ({
  ...process.env,
  XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), `${name}-home-`)),
});

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

export const dirtyRepo = () => {
  const room = mkdtempSync(join(tmpdir(), "dirty-repo-"));
  spawnSync("git", ["init", "-q", room], { encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  writeFileSync(join(room, "tracked.txt"), "changed, and never committed\n");
  return room;
};
