/* The two-branch state every case of the review-answers step builds, and the consult log it is judged
   against: shared by the files those cases are split across, since a case file that copied them
   would drift from the others the first time one was changed. */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, git, pushed } from "../run-fixtures.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

/* Two branches off one base. The change is built on one; the other lands on master and moves a file
   under review. Before this step the ship rebased, gated and pushed, and the mark it wrote named a
   reviewed head the landing did not carry — consistent and wrong (ISS-962). The shared file is
   seeded with room in it, so the two writes are the same path and not the same lines: a rebase that
   conflicts is refused two steps later anyway and proves nothing about this one. */
export const UNDER_REVIEW = join("plugin", "src", "under-review.mjs");

export const rewrote = (work, path, at, message) => {
  mkdirSync(join(work, "plugin", "src"), { recursive: true });
  const held = readFileSync(join(work, path), "utf8").split("\n");
  held[at] = `${held[at]} rewritten`;
  writeFileSync(join(work, path), held.join("\n"));
  git(work, "add", path);
  git(work, "commit", "-m", message);
  return git(work, "rev-parse", "HEAD").stdout.trim();
};

export const baseMoved = (name, landing) => {
  const { at, work } = pushed(name);
  for (const path of new Set([UNDER_REVIEW, landing])) {
    mkdirSync(join(work, "plugin", "src"), { recursive: true });
    writeFileSync(join(work, path), [...Array(40).keys()].map((one) => `line ${one}`).join("\n"));
    git(work, "add", path);
  }
  git(work, "commit", "-m", "the files the two sides write");
  git(work, "push", "origin", "master:master");
  const base = git(work, "rev-parse", "HEAD").stdout.trim();

  git(work, "checkout", "-b", "iss-962");
  const mine = rewrote(work, UNDER_REVIEW, 1, "the change under review");
  git(work, "checkout", "master");
  const pin = rewrote(work, landing, 38, "what landed between the read and the ship");
  git(work, "push", "origin", "master:master");
  git(work, "checkout", "iss-962");
  return { at, work, base, mine, pin, remote: join(at, "origin.git") };
};

/* The replay above clears the base question and answers the other one not at all: nothing in git
   tells a branch replayed and re-read from one replayed and shipped, because the two leave the same
   tree. What separates them is when the read was taken, which the consult log records (ISS-972). */
export const readsTaken = (root, reads) => {
  const home = tempRoom("run-replayed-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), reads.map(({ head, files, ...more }, at) =>
    `${JSON.stringify({
      kind: "consult", id: `c${at + 1}`, at: String(at + 1), ok: true, reply: "CODEX: 0 findings",
      send: "bodies", root: realpathSync(root), head, files,
      sent: files.map((rel) => ({ rel, chars: 40, clipped: false })),
      ...more,
    })}\n`).join(""));
  return { ...BARE, XDG_CONFIG_HOME: home };
};

export const readTaken = (root, head, files, more = {}) => readsTaken(root, [{ head, files, ...more }]);

/* One ship per case: a pass runs the release out and moves master, so a second assertion in the
   same checkout would be about a branch with nothing left on it. `beside.mjs` is what the landing
   writes throughout, so the base half of this step passes and the read is what is left to judge. */
export const ELSEWHERE = join("plugin", "src", "beside.mjs");

export const ADDED = join("plugin", "src", "added.mjs");

/* The read that clipped. A bodies pass over a set above the bundle cap carries whole bodies for some
   of it and clipped ones for the rest, and answered no differently from a pass that covered it all:
   the review said approved, the ship said nothing, and the sentence the contract states was
   unreachable rather than skipped (ISS-1087). These fixtures build that log by hand — one pass at
   the head that would land, whole for one file and short for the other. */
export const clippedRead = (name, short, more = {}) => {
  const held = baseMoved(name, ELSEWHERE);
  writeFileSync(join(held.work, ADDED), short);
  git(held.work, "add", ADDED);
  git(held.work, "commit", "-m", "the second file of the change");
  const head = git(held.work, "rev-parse", "HEAD").stdout.trim();
  const files = [ADDED, UNDER_REVIEW];
  return {
    ...held,
    head,
    env: readTaken(held.work, head, files, {
      run: "r1",
      sent: files.map((rel) => ({ rel, chars: 40, clipped: rel === ADDED })),
      ...more,
    }),
  };
};
