/* One repository with an origin and two worktrees besides the checkout, and a config home of its own
   per case: the brief verb and the gate read both, and the developer's are never the fixture. */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { git, tempRoom } from "../fixtures.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CLI = join(PLUGIN, "src", "cli.mjs");
export const HOOK = join(PLUGIN, "hooks", "entries", "brief.mjs");

export const RUN = "iss-7-0123abcd";

const gitDirOf = (tree) =>
  spawnSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: tree, encoding: "utf8" }).stdout.trim();

/** The checkout, `busy` holding one commit and one uncommitted file, `idle` holding nothing, and
 *  `mine` carrying the run id and scratch records a started run leaves in its git directory. */
export const repository = () => {
  const room = tempRoom("brief-repo-");
  const origin = join(room, "origin.git");
  const main = join(room, "main");
  spawnSync("git", ["init", "-q", "--bare", "-b", "main", origin], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", "-b", "main", main], { encoding: "utf8" });
  writeFileSync(join(main, "base.txt"), "base\n");
  git(main, "add", "base.txt");
  git(main, "commit", "-qm", "base");
  git(main, "remote", "add", "origin", origin);
  git(main, "push", "-q", "origin", "main");
  git(main, "remote", "set-head", "origin", "main");
  const trees = Object.fromEntries(["busy", "idle", "mine"].map((name) => {
    const at = join(room, name);
    git(main, "worktree", "add", "-q", "-b", name, at);
    return [name, at];
  }));
  writeFileSync(join(trees.busy, "landed.txt"), "one\n");
  git(trees.busy, "add", "landed.txt");
  git(trees.busy, "commit", "-qm", "one");
  writeFileSync(join(trees.busy, "open.txt"), "open\n");
  const records = gitDirOf(trees.mine);
  writeFileSync(join(records, "forge-run-id"), `${RUN}\n`);
  writeFileSync(join(records, "forge-run-scratch"), `/tmp/forge-run-${RUN}\n`);
  return { main, ...trees };
};

/** A home and config directory of the case's own, and the session the verb writes for. */
export const homeFor = (session = "session-one") => {
  const home = tempRoom("brief-home-");
  const config = join(home, "config");
  mkdirSync(config, { recursive: true });
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: config, CLAUDE_CODE_SESSION_ID: session };
  delete env.CLAUDE_PID;
  return { home, config, env, session };
};

export const brief = (args, cwd, env) =>
  spawnSync(process.execPath, [CLI, "brief", ...args], { cwd, env, encoding: "utf8" });
