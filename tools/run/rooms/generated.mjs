/* Which of a change's moved paths the tree's own generators write back at the merged head, so a file
   no hand wrote is not a fresh subject for the landing (ISS-1421). A generator is a `generate:` script
   of the merged head's own package.json, where this repository writes every command line, so the
   declaration is the writer and never a list of the files it writes. Each moved path is removed alone
   before the generators run, which is what shows one of them writes it at all: a path they leave
   missing, one they write back with other bytes, and one whose removal fails them or moves anything
   else stays a move. Alone, because a moved source a generator loads would otherwise fail it for every
   path removed with it (ISS-2817). docs/cli/the-candidate.md. */
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
    if (run.error || run.status !== 0) return `${name} exited ${run.error ? run.error.message : run.status}`;
  }
  return null;
};

/* A path the merged head tracks, asked before anything is removed: status reads a tracked path against
   the index whatever an ignore rule says, and a path the head lacks is a deletion, never a file written
   back — so neither an absent file nor an ignored one is cleared by reading as unlisted. */
const tracked = (room, path) => git(["cat-file", "-e", `HEAD:${path}`], room).status === 0;

/* The room put back at its commit, ignored files included and what the room borrowed kept, so one
   run's removal, writes and caches are not the next run's starting tree. */
const putBack = (room) => git(["reset", "-q", "--hard", "HEAD"], room).status === 0
  && git(["clean", "-fdxq", ...LINKED.flatMap((one) => ["-e", `/${one}`])], room).status === 0;

/** The generators run once over the room with `removed` gone: which script failed, or what they left moved. */
const ranWithout = (room, scripts, removed) => {
  if (!putBack(room)) return { why: "git could not put the room back at the merged head between runs" };
  for (const path of removed) rmSync(join(room, path), { force: true });
  const failed = ranIn(room, scripts);
  if (failed) return { failed };
  const moved = movedIn(room);
  return moved ? { moved } : { why: "git could not read what the generators left in their room" };
};

/* Why a path whose removal failed the generators or moved another file is not taken as generated —
   asked of the head with nothing removed, run once and only then, so the common landing pays one run
   per path. A head its generators fail or move on their own is the candidate's, and clears nothing. */
const headFault = (head) => {
  if (head.why) return head.why;
  if (head.failed) return `${head.failed}, so nothing it writes is taken as generated`;
  return head.moved.length
    ? `they also moved ${head.moved.join(", ")} with nothing removed, so the merged head is not what its generators make`
    : null;
};

const blamed = (path, run) => (run.failed
  ? `${run.failed} once ${path} alone was removed and not with it in place, so ${path} is a file they need rather than one they write`
  : `removing ${path} alone also moved ${run.moved.filter((one) => one !== path).join(", ")}, so ${path} is a file they read rather than one they write`);

const judged = (room, scripts, paths) => {
  const generated = [];
  const unwritten = paths.filter((path) => !tracked(room, path));
  const needed = [];
  let head = null;
  for (const path of paths.filter((one) => !unwritten.includes(one))) {
    const run = ranWithout(room, scripts, [path]);
    if (run.why) return { generated: [], why: run.why };
    if (!run.failed && run.moved.every((one) => one === path)) {
      (run.moved.length ? unwritten : generated).push(path);
      continue;
    }
    head ??= ranWithout(room, scripts, []);
    const fault = headFault(head);
    if (fault) return { generated: [], why: fault };
    needed.push(blamed(path, run));
  }
  const left = paths.filter((path) => unwritten.includes(path));
  const why = [...(left.length ? [`they did not write ${left.join(", ")} back byte for byte`] : []), ...needed];
  return { generated, why: why.length ? why.join("; ") : null };
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
