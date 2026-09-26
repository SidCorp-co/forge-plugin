/* Which of a change's moved paths the tree's own generators write back at the merged head, so a file
   no hand wrote is not a fresh subject for the landing (ISS-1421). A generator is a `generate:` script
   of the merged head's own package.json, where this repository writes every command line, so the
   declaration is the writer and never a list of the files it writes. Each moved path is removed before
   the generators run, which is what shows one of them writes it at all: a path they leave missing, one
   they write back with other bytes, and one beside a generator that failed or moved anything else
   stays a move. docs/cli/the-candidate.md. */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { git, gitOut, parsed, Stop } from "../../checkout.mjs";
import { LINKED } from "../install.mjs";
import { dropRoom, roomFor } from "./room.mjs";

export const GENERATE = "generate:";

/** The `generate:` scripts a commit's own package.json declares, in its order. */
export const generatorsAt = (tree, commit) => {
  const scripts = parsed(gitOut(["show", `${commit}:package.json`], tree) ?? "")?.scripts;
  return scripts && typeof scripts === "object" ? Object.keys(scripts).filter((name) => name.startsWith(GENERATE)) : [];
};

/* Every path the room holds that is not its commit's, untracked ones included: a generator writing a
   file the merged head lacks is a head its generators do not agree with. `-z` and no renames, so a path
   is the path whatever it is spelled with; less what the room borrowed, which no generator wrote. */
const movedIn = (room) => {
  const run = git(["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], room);
  if (run.status !== 0) return null;
  return (run.stdout ?? "").split("\0").filter(Boolean).map((entry) => entry.slice(3))
    .filter((path) => !LINKED.includes(path));
};

const ranIn = (room, scripts) => {
  for (const name of scripts) {
    const run = spawnSync("npm", ["run", "--silent", name], { cwd: room, encoding: "utf8" });
    if (run.error || run.status !== 0) {
      return `${name} exited ${run.error ? run.error.message : run.status}, so nothing it writes is taken as generated`;
    }
  }
  return null;
};

const judged = (room, scripts, paths) => {
  for (const path of paths) rmSync(join(room, path), { force: true });
  const failed = ranIn(room, scripts);
  if (failed) return { generated: [], why: failed };
  const moved = movedIn(room);
  if (!moved) return { generated: [], why: "git could not read what the generators left in their room" };
  const beside = moved.filter((path) => !paths.includes(path));
  if (beside.length) {
    return { generated: [], why: `they also moved ${beside.join(", ")}, so the merged head is not what its generators make` };
  }
  const generated = paths.filter((path) => !moved.includes(path));
  const left = paths.filter((path) => moved.includes(path));
  return { generated, why: left.length ? `they did not write ${left.join(", ")} back byte for byte` : null };
};

const asked = new Map();

/** Of `paths`, which the generators `merged` declares write back byte for byte at `merged`, the
 *  scripts that ran and, where some path was not cleared, why. Once per commit and set of paths:
 *  the chain, the gate's search and the mark ask the same candidate the same question. */
export const regenerated = (tree, merged, paths) => {
  if (!merged || !paths.length) return { generated: [], scripts: [], why: null };
  const key = `${merged} ${[...paths].sort().join("\0")}`;
  if (asked.has(key)) return asked.get(key);
  const scripts = generatorsAt(tree, merged);
  let found = { generated: [], scripts, why: null };
  if (scripts.length) {
    let room = null;
    try {
      room = roomFor(tree, merged, "forge-generated-");
      found = { ...judged(room, scripts, paths), scripts };
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      found = { generated: [], scripts, why: `no room could be made at the merged head: ${error.message}` };
    } finally {
      dropRoom(tree, room);
    }
  }
  asked.set(key, found);
  return found;
};
