/* One root per process, removed on exit: a directory per case ran a tmpfs out of inodes (ISS-125).
   A kill runs no handler, so the pid is in the name and the next process sweeps a root whose own
   is gone; a root this fixture never named is nobody's to delete. */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const OWNED = /^code-quality-test-(\d+)-/u;

let root;

function gone(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (refused) {
    return refused.code === "ESRCH";
  }
}

function sweep() {
  for (const name of readdirSync(tmpdir())) {
    const owner = OWNED.exec(name);
    if (!owner || Number(owner[1]) === process.pid || !gone(Number(owner[1]))) continue;
    try {
      rmSync(path.join(tmpdir(), name), { recursive: true, force: true });
    } catch {
      // Another process sweeping the same root, or one that is not this user's to remove.
    }
  }
}

export function tempRoom(prefix) {
  if (!root) {
    root = mkdtempSync(path.join(tmpdir(), `code-quality-test-${process.pid}-`));
    process.on("exit", () => rmSync(root, { recursive: true, force: true }));
    sweep();
  }
  return mkdtempSync(path.join(root, prefix));
}
