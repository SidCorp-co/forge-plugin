/* The rooms a suite stands its cases in, and this process's own share of the machine's temporary
   root: a checkout, a git repository, a home directory, each made once and swept once the process
   that made it is gone. Split out of ../fixtures.mjs, whose own body stopped at the line cap this
   file answers to; every export here is re-exported there unchanged. */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { checkoutAt } from "../../src/git/checkout-at.mjs";
import { madeIn } from "./room.mjs";

/* Thousands of these have filled the mount a shell needed (ISS-42, ISS-125), on a tmpfs out of inodes while gigabytes are free.
   So a suite's rooms go inside one root this process removes on its way out, the pid in its name because Ctrl-C runs no handler:
   a root whose process is gone is swept by the next to ask for one, and one this fixture never named is nobody's — so the flag
   renames rather than only spares, a kept root's pid being dead at once. Made at import because `TMPDIR` points at it below and
   a gate stamps under `tmpdir()` per call, so a suite leaving that alone fills the room every hook reaps; `MACHINE` is first. */
const OWNED = /^forge-plugin-test-(\d+)-/u;
const MACHINE = tmpdir();

const gone = (pid) => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (refused) {
    return refused.code === "ESRCH";
  }
};

const sweep = () => {
  for (const name of readdirSync(MACHINE)) {
    const owner = OWNED.exec(name);
    if (!owner || Number(owner[1]) === process.pid || !gone(Number(owner[1]))) continue;
    try {
      rmSync(join(MACHINE, name), { recursive: true, force: true });
    } catch {
      /* Another process sweeping the same root, or one that is not this user's to remove. */
    }
  }
};

const KEPT = process.env.KEEP_TEST_ROOMS === "1";
const PREFIX = join(MACHINE, `forge-plugin-test-${KEPT ? "kept-" : ""}${process.pid}-`);
const root = madeIn(PREFIX, () => mkdtempSync(PREFIX));
if (KEPT) process.stderr.write(`keeping this test process's room: ${root}\n`);
else process.on("exit", () => rmSync(root, { recursive: true, force: true }));
sweep();

process.env.TMPDIR = root;

export const tempRoom = (prefix) => madeIn(join(root, prefix), () => mkdtempSync(join(root, prefix)));

/* A case about which run a call is controls the tree it stands in as it controls the config home: a
   suite run from a worktree naming its own run resolves that id, where a case written about the
   inherited one wants a tree naming none (ISS-467).

   The room is a checkout of its own, and a fresh `git init` names no run. It carried a committed
   project file until ISS-1403, on the reasoning that leaving the checkout then moved nothing else;
   that stopped being true when the project's configuration stopped being a file a directory could
   carry, and a room in no checkout resolves no project at all — so a case standing
   in one had every project-scoped call refused for want of a slug rather than answering about the
   run. Where the case needs keys as well as a checkout, `projectRecord(at, home, keys)` writes
   them. */
export const standsInNoTree = (name) => {
  const at = tempRoom(`${name}-no-tree-`);
  spawnSync("git", ["init", "-q", at], { cwd: at, encoding: "utf8" });
  process.chdir(at);
  return at;
};

/** Where this machine's record of the project a room belongs to is kept, which is the path every
 *  report names after its arrow. Keyed on the room's REPOSITORY's root folder, exactly as the
 *  resolver keys it, so a linked worktree and the checkout it was added from compose one path — and
 *  so a case pinning a source pins a path its own home resolves to and not a shape. A room no
 *  checkout holds has no project at all, which is a case's mistake rather than an empty answer. */
export const projectEntry = (room, home) => {
  const repository = checkoutAt(room)?.repository;
  if (!repository) throw new Error(`${room} belongs to no checkout, so it has no project record`);
  return join(home, "forge", "projects", basename(repository), "config.json");
};

/** This machine's record of the project a room ALREADY belongs to, written where the resolver reads
 *  it, under the configuration home the case runs against. Returns the entry. */
export const projectRecord = (room, home, config) => {
  const entry = projectEntry(room, home);
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(entry, `${JSON.stringify(config, null, 2)}\n`);
  return entry;
};

/** A room that is a checkout, holding this machine's record of its project: `git init` gives a bare
 *  room a repository for the entry to be keyed on, and the record follows. Returns the room. A room
 *  that is already a checkout — this repository, or a worktree of it — takes `projectRecord`. */
export const projectRoom = (room, home, config) => {
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  projectRecord(room, home, config);
  return room;
};

export const tempHome = (name) => {
  const path = tempRoom(`${name}-home-`);
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
};

export const homeEnv = (name) => {
  const room = tempRoom(`${name}-home-`);
  return { ...process.env, HOME: room, XDG_CONFIG_HOME: room };
};

export const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args],
    { cwd: room, encoding: "utf8" });

export const dirtyRepo = () => {
  const room = tempRoom("dirty-repo-");
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  writeFileSync(join(room, "tracked.txt"), "changed, and never committed\n");
  return room;
};

/** A repository with nothing to lose, which is where every git rule in bash-guard stands down. */
export const cleanRepo = () => {
  const room = tempRoom("clean-repo-");
  spawnSync("git", ["init", "-q", room], { cwd: room, encoding: "utf8" });
  return room;
};
