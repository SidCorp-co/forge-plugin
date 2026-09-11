/* One make-and-read-back for the paths a worktree borrows, shared by the grant and the repair so
   neither writes a path nor skips a read-back the other does not: `symlinkSync` returning is not a
   link — on this volume it left a reparse point the kernel could not follow, and the trees that got
   one learned of it from `eslint: not found` at their first gate step (ISS-883). */
import { existsSync, lstatSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { LINKED } from "../install.mjs";

export const LINKS_HELP = [
  "A borrowed path counts as linked only where its canonical form is the canonical form of the",
  "checkout path it was pointed at. `existsSync` is not that question twice over: a link the kernel",
  "cannot follow and a link pointed at some other install both read as present, and the second runs",
  "the wrong dependencies. So the grant reads every link it makes back before it says it made one,",
  "and refuses the whole worktree rather than hand back a tree whose gate will die on a tool it was",
  "never told is missing. What resolution means here is the link and never its content: whether the",
  "checkout's dependencies are installed at all is the line above it.",
  "",
  "`relink` is the same write for a tree already cut, `start` refusing a worktree it did not make.",
  "It removes nothing to do it — not the tree, not the branch, not work standing in either, and not",
  "a real directory somebody installed at a borrowed path, which it reports and leaves. Which tree",
  "it repairs is the one holding the copy of this script that runs, as a ship's is, and never the",
  "shell's directory: the checkout's own copy refuses, that install being what a worktree borrows.",
];

const canonical = (path) => {
  try {
    return { at: realpathSync(path) };
  } catch (error) {
    return { failed: error.message };
  }
};

const resolvesTo = (at, target) => {
  const here = canonical(at);
  return Boolean(here.at) && here.at === canonical(target).at;
};

const readsAs = (at) => {
  const here = canonical(at);
  if (here.at) return `it resolves to ${here.at}`;
  try {
    return `it points at ${readlinkSync(at)} and resolving that raised ${here.failed}`;
  } catch {
    return `resolving it raised ${here.failed}`;
  }
};

/* Absent and unreadable are two answers: reading the second as the first leaves a link on a guess. */
const standing = (at) => {
  try {
    return { held: lstatSync(at) };
  } catch (error) {
    return error.code === "ENOENT" ? { held: null } : { failed: `${at} could not be read: ${error.message}` };
  }
};

const said = {
  absent: (one, tail) => `${one.one} is not installed in the checkout, so nothing is linked for it: ${tail}`,
  kept: (one) => `${one.at} already resolves to ${one.target}`,
  made: (one) => `${one.at}`,
  occupied: (one, what) => `${one.at} is a real ${what} and not a link, so nothing was written there`,
};

/* A target the checkout stopped holding leaves the link live: dangling, or pointed at another
   install, either way a path the tree resolves through. So this takes it away, and only a link. */
const cleared = (at) => {
  const { failed, held } = standing(at);
  if (failed) return { failed: `${failed}, so nothing here can say whether a link is standing at it` };
  if (!held) return { said: "and nothing stands where it would be linked" };
  if (!held.isSymbolicLink()) {
    return { said: `and the real ${held.isDirectory() ? "directory" : "file"} at ${at} is left where it is` };
  }
  try {
    rmSync(at, { force: true });
    return { said: `and the link an earlier call left at ${at} is removed` };
  } catch (error) {
    return { failed: `${at} links to a target the checkout no longer holds and would not be removed: ${error.message}` };
  }
};

/** One borrowed path: made where it does not already resolve to the checkout's own, and read back
 *  before it counts as made. `write` is a parameter for the reason `finish` takes its gate reader as
 *  one — the defect this guards is a write that returns without throwing and leaves nothing that
 *  resolves, which no filesystem a case can ask for will do on demand. */
export const borrowed = (root, tree, one, write = symlinkSync) => {
  const link = { one, at: join(tree, one), target: join(root, one) };
  if (!existsSync(link.target)) {
    const gone = cleared(link.at);
    return gone.failed
      ? { ...link, kind: "unresolved", said: gone.failed }
      : { ...link, kind: "absent", said: said.absent(link, gone.said) };
  }
  if (resolvesTo(link.at, link.target)) return { ...link, kind: "kept", said: said.kept(link) };
  const { failed, held } = standing(link.at);
  if (failed) return { ...link, kind: "unresolved", said: failed };
  if (held && !held.isSymbolicLink()) {
    return { ...link, kind: "occupied", said: said.occupied(link, held.isDirectory() ? "directory" : "file") };
  }
  try {
    if (held) rmSync(link.at, { force: true });
    write(link.target, link.at);
  } catch (error) {
    return { ...link, kind: "unresolved",
      said: `${link.at} could not be linked to ${link.target}: ${error.message}` };
  }
  return resolvesTo(link.at, link.target)
    ? { ...link, kind: "made", said: said.made(link) }
    : { ...link, kind: "unresolved",
      said: `${link.at} was linked to ${link.target} and does not resolve to it: ${readsAs(link.at)}` };
};

/** Every path a worktree borrows, in the order the checkout lists them. */
export const borrowedInto = (root, tree, write) => LINKED.map((one) => borrowed(root, tree, one, write));

/** The two outcomes that leave a tree unable to resolve what it borrowed; an absent target is its own line. */
export const BROKEN = new Set(["occupied", "unresolved"]);
