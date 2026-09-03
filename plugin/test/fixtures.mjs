/* How Claude Code calls a gate. Unwrapping the answer stays each suite's: `deny()` and `block()` do
   not answer alike, and the git rules need a tree with work to lose. */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const callHook = (hook, event, env = process.env) =>
  spawnSync(process.execPath, [hook], { input: JSON.stringify(event), encoding: "utf8", env });

/* The same call, awaited: a gate that asks a server the test itself is running deadlocks under
   `spawnSync`, which holds the loop that would answer it. */
export const callHookAsync = (hook, event, env = process.env) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [hook], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => done({ stdout, stderr, status }));
    child.stdin.end(JSON.stringify(event));
  });

/* The suite has left thousands of these behind (ISS-42) and filled the mount a shell needed. The
   removal is registered here, where no caller can forget it, and handed back so a case proves it. */
export const tempHome = (name) => {
  const path = mkdtempSync(join(tmpdir(), `${name}-home-`));
  const remove = () => rmSync(path, { recursive: true, force: true });
  process.on("exit", remove);
  return { path, remove };
};

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
