/* A CLI call's config home, off the tree it stands in: the reading `inRunHome` gives a hook there
   whatever the shell exports (ISS-2651), so the CLI and the hooks cannot disagree about where one
   run's state is. Outside any run's worktree the environment answers, unchanged.

   An explicit, disagreeing `XDG_CONFIG_HOME` is refused rather than overridden, and no other variable
   is read to second-guess a tree that names its run (G-13). A spawned call that means a different home
   stands somewhere naming no run; that is its caller's arrangement, not an exception here (G-12). */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { fail } from "../../refusal.mjs";
import { BORROW_VAR } from "../machine/borrowed.mjs";
import { runHomeAt } from "./run-home.mjs";

/** This machine's own config: the file a shell exporting no home reads, which is what a run's brief
 *  borrows from and what a run home that borrows nothing is pointed back at. */
export const developerConfigPath = () => join(homedir(), ".config", "forge", "config.json");

/** The tree's own run home off `here`, the shell's `XDG_CONFIG_HOME` if named, and whether the two
 *  disagree. `tree: null` is a call outside any run's worktree: nothing here to disagree with. */
export const configHomeRow = (here = process.cwd()) => {
  const tree = runHomeAt(here);
  const asked = process.env.XDG_CONFIG_HOME || null;
  return { tree, asked, conflict: Boolean(tree && asked && resolve(asked) !== resolve(tree)) };
};

const exportLine = (tree) => `  export XDG_CONFIG_HOME=${tree} ${BORROW_VAR}=${developerConfigPath()}`;

/** Both paths named, and the export line the tree's brief printed, so the reader retypes nothing.
 *  `refused` is a call stopped on it, which read and wrote no configuration. Null where
 *  `configHomeRow` finds no conflict. */
export const configHomeConflict = (here = process.cwd(), refused = false) => {
  const { tree, asked, conflict } = configHomeRow(here);
  if (!conflict) return null;
  return `XDG_CONFIG_HOME=${asked} names a different home than this tree's own run keeps its state `
    + `under, ${tree}. A hook firing here reads the tree's home whatever the shell exports, so this `
    + "call would read and write this run's records in a second place the hooks never see."
    + `${refused ? " No configuration was read or written." : ""} Point the shell at the run's own home, `
    + `borrowing this machine's credentials read-only as its brief did:\n${exportLine(tree)}`;
};

/** `forge doctor`'s report keeps running on a conflicted home; a write through one, to a store or to
 *  the tracker, is refused with the same text a plain call is. */
export const refusedOnConflict = (writes, here = process.cwd()) => {
  if (writes && configHomeConflict(here)) fail(configHomeConflict(here, true));
};

/* What the last settle filled, for the doctor to say why the home is the one it is. */
let filled = [];

/** Fills what the shell left unset from the tree: the home, and the borrow of this machine's own
 *  config where that file exists, which is a reference and never a copy. Returns the conflict a
 *  disagreeing home earned instead, before anything is filled: a plain call refuses on it, and
 *  `forge doctor` reports it and keeps running. */
export const settleConfigHome = (here = process.cwd()) => {
  filled = [];
  const { tree, asked, conflict } = configHomeRow(here);
  if (!tree) return null;
  if (conflict) return configHomeConflict(here, true);
  if (!asked) {
    process.env.XDG_CONFIG_HOME = tree;
    filled.push("XDG_CONFIG_HOME");
  }
  if (!process.env.FORGE_BORROW_FROM && existsSync(developerConfigPath())) {
    process.env.FORGE_BORROW_FROM = developerConfigPath();
    filled.push(BORROW_VAR);
  }
  return null;
};

const borrowRow = () => {
  const borrow = process.env.FORGE_BORROW_FROM || null;
  const machine = developerConfigPath();
  if (!borrow) {
    return { level: "note", label: "borrow", detail: `none, and ${machine} is not there to borrow from, so this `
      + "run's home reads no credential but its own config.json" };
  }
  if (resolve(borrow) !== resolve(machine)) {
    return { level: "note", label: "borrow", detail: `${borrow}  ← ${BORROW_VAR}, which is not this machine's own `
      + `config, the file a run's brief borrows: export ${BORROW_VAR}=${machine}` };
  }
  const why = filled.includes(BORROW_VAR) ? `this machine's own config, filled because the shell exported no ${BORROW_VAR}`
    : `this machine's own config, as ${BORROW_VAR} names`;
  return { level: "ok", label: "borrow", detail: `${borrow}  ← ${why}; read, never written` };
};

/** What `forge doctor` says of the home this call resolved and why, and of the borrow where a run's
 *  tree answered, as the rows its report prints; a `note` is a row the run has an act on. */
export const configHomeRows = (here = process.cwd()) => {
  const { tree, asked, conflict } = configHomeRow(here);
  if (conflict) return [{ level: "note", label: "config home", detail: configHomeConflict(here) }];
  if (!tree) {
    const home = asked ?? join(homedir(), ".config");
    const why = asked ? "XDG_CONFIG_HOME" : "this machine's default, the shell exporting no XDG_CONFIG_HOME";
    return [{ level: "ok", label: "config home", detail: `${home}  ← ${why}; no run's tree stands here` }];
  }
  const why = filled.includes("XDG_CONFIG_HOME")
    ? "this tree's own run, filled because the shell exported no XDG_CONFIG_HOME"
    : "this tree's own run, as the shell exports";
  return [{ level: "ok", label: "config home", detail: `${tree}  ← ${why}` }, borrowRow()];
};
