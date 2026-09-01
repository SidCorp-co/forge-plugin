#!/usr/bin/env node
// A claim CLAUDE.md makes about the repository is read as fact by every session that opens it, and
// it rots silently. Checked where it is written. why/claude-md.md.

import { spawnSync } from "node:child_process";
import { relative } from "node:path";

import { checkClaims, readClaudeMd } from "../src/claude-md.mjs";
import { repoRoot } from "../src/codex.mjs";
import { block, readEvent, touched, why } from "./_hook.mjs";

/* The eight kinds `forge doctor` reports, in its words: why/claude-md.md. */
const KINDS = [
  ["missingPaths", "names no such path"],
  ["missingScripts", "is in no package.json here"],
  ["missingHelp", "is told to answer `-h`, and handles no such flag"],
  ["missingTools", "is told to answer `-h`, and is not on PATH"],
  ["missingRefs", "is a git ref that does not resolve here"],
  ["presentForbidden", "is said not to exist, and it does"],
  ["strandedShas", "is cited and is no ancestor of HEAD"],
  ["uncitedIdentifiers", "is cited and is defined nowhere else in the repo"],
];

const named = (text, root) => {
  const held = checkClaims(text, root);
  return KINDS.flatMap(([key, said]) => (held[key] ?? []).map((token) => `\`${token}\` ${said}`));
};

/* The baseline, so a repository whose CLAUDE.md is already wrong still gets the edit that fixes it. */
const asCommitted = (root) => {
  const run = spawnSync("git", ["show", "HEAD:CLAUDE.md"], { cwd: root, encoding: "utf8", timeout: 5000 });
  return run.status === 0 ? (run.stdout ?? "") : "";
};

const ev = readEvent();
const root = repoRoot(ev.cwd ?? process.cwd());
if (!root) process.exit(0);

/* Whichever route wrote it, and only this file: a project's own guides are its business. */
if (!touched(ev).some((file) => relative(root, file) === "CLAUDE.md")) process.exit(0);

const held = readClaudeMd(root);
if (!held) process.exit(0);

const before = named(asCommitted(root), root);
const fresh = named(held.text, root).filter((one) => !before.includes(one));
if (!fresh.length) process.exit(0);

block(
  `CLAUDE.md now claims ${fresh.length === 1 ? "something" : `${fresh.length} things`} this repository `
    + `does not bear out:\n\n${fresh.map((one) => `- ${one}`).join("\n")}\n\n`
    + "Do this: correct each claim, or delete it — the file it names is the authority, and a claim it "
    + "has outlived is worse than silence."
    + why(),
);
