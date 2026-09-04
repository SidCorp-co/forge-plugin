/* What each step's inputs hashed to when it last passed, and how long that pass took. Keyed on
   content, never on a sha: a rebase rewrites the sha, and the tree a session gates most has none. */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { derivationFiles, under } from "./scope.mjs";
import { recordDir } from "./timing.mjs";

const DIGEST_LENGTH = 12;
// Seconds before the label, the last capture, which on `.+` swallows a suffix; optional, so an older entry still reads as a pass.
const ENTRY = new RegExp(`^([0-9a-f]{${DIGEST_LENGTH}}) (?:(\\d+)s )?(.+)$`, "u");

// Every step's input: a dependency change can break any of them, and no step declares node_modules.
const SHARED = /^package(?:-lock)?\.json$/u;

export const LEDGER_UNSEEN = `Keyed on repository file content, the manifests, this runner's own modules and ${process.version}.
It cannot see node_modules as installed, anything outside the repository, or a tool on PATH; --full ignores it.`;

const hashed = new Map();

/* The mode with the bytes, because the suite executes files of this tree; a deletion answers as
   itself; and a path git calls a file that the disk does not is a shape no digest here models. */
const digested = (path) => {
  let found;
  try {
    found = lstatSync(path);
  } catch {
    return "absent";
  }
  if (!found.isFile()) {
    throw new Error(`git reports ${path} as a file and the disk has ${found.isDirectory() ? "a directory" : "something else"} `
      + `there, so it is a submodule or a link no digest here models. Gate with --full until it is.`);
  }
  return createHash("sha256").update(found.mode & 0o111 ? "x" : "-").update(readFileSync(path)).digest("hex");
};

const hashFile = (path) => {
  if (!hashed.has(path)) hashed.set(path, digested(path));
  return hashed.get(path);
};

const digestOf = (root, files) => {
  const hash = createHash("sha256");
  hash.update(`${process.version}\n`);
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(hashFile(join(root, file)));
  }
  return hash.digest("hex").slice(0, DIGEST_LENGTH);
};

const fileFor = (dir, label) => join(dir, label.replace(/[^\w.-]+/gu, "-"));

// Unreadable, truncated, or another step's are all "no entry"; none of them may read as "passed".
const recorded = (dir, label) => {
  try {
    const [, digest, seconds, saved] = ENTRY.exec(readFileSync(fileFor(dir, label), "utf8").trim()) ?? [];
    return saved === label ? { digest, seconds: seconds === undefined ? null : Number(seconds) } : {};
  } catch {
    return {};
  }
};

export const recordPass = (dir, step, seconds) => {
  const staging = `${fileFor(dir, step.label)}.${process.pid}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(staging, `${step.digest} ${seconds}s ${step.label}\n`);
  renameSync(staging, fileFor(dir, step.label));
};

/** One `reads` decides both whether the diff reaches a step and what its digest covers, so the
 *  ledger can never trust a wider or narrower set of inputs than the scoping already trusted. */
export const ledgerFor = (steps, { root, files, runner }) => {
  const dir = recordDir(root);
  const derivation = derivationFiles(runner, root);
  const entries = steps.map((step) => {
    const inputs = new Set(derivation);
    for (const file of files) {
      if (SHARED.test(file) || step.reads.some((claim) => under(file, claim))) inputs.add(file);
    }
    const digest = digestOf(root, inputs);
    const was = recorded(dir, step.label);
    return { ...step, digest, green: was.digest === digest, took: was.seconds };
  });
  return { dir, entries };
};
