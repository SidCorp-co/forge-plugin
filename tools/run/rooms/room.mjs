/* A detached worktree of one commit with the checkout's node_modules lent to it, and its removal: the
   gate's candidate is run in one and so are the generators a moved path is read against, and neither
   is ever run in the tree that built the change. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loud } from "../../checkout.mjs";
import { LINKED } from "../install.mjs";

export const roomFor = (root, commit, prefix = "forge-landing-") => {
  const path = mkdtempSync(join(tmpdir(), prefix));
  loud("git", ["worktree", "add", "--detach", path, commit], root,
    "The candidate is gated in a tree of the landing's own, never in the one that built it.");
  for (const one of LINKED) {
    if (existsSync(join(root, one))) symlinkSync(join(root, one), join(path, one));
  }
  return path;
};

export const dropRoom = (root, path) => {
  if (!path) return;
  spawnSync("git", ["worktree", "remove", "--force", path], { cwd: root, encoding: "utf8" });
  rmSync(path, { recursive: true, force: true });
};
