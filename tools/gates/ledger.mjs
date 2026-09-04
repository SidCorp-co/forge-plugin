/* What each step's inputs hashed to when it last passed. Keyed on content, never on a sha: a rebase
   rewrites the sha and leaves the code alone, and the tree a session gates most has no sha at all.
   One file per step under the common git directory, the one path every worktree resolves to. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gitCommonDir } from "../checkout.mjs";
import { derivationFiles, under } from "./scope.mjs";

const DIGEST_LENGTH = 12;
const ENTRY = new RegExp(`^([0-9a-f]{${DIGEST_LENGTH}}) (.+)$`, "u");

// Every step's input: a dependency change can break any of them, and no step declares node_modules.
const SHARED = /^package(?:-lock)?\.json$/u;

export const LEDGER_UNSEEN = `Keyed on repository file content, the manifests, this runner's own modules and ${process.version}.
It cannot see node_modules as installed, anything outside the repository, or a tool on PATH; --full ignores it.`;

const hashed = new Map();

/* An absent file hashes to a value of its own rather than throwing: git lists a path it has been
   told to delete, and that deletion is exactly a change the digest has to carry. */
const hashFile = (path) => {
  if (!hashed.has(path)) {
    let content;
    try {
      content = readFileSync(path);
    } catch {
      content = "absent";
    }
    hashed.set(path, createHash("sha256").update(content).digest("hex"));
  }
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
const recordedDigest = (dir, label) => {
  try {
    const [, digest, saved] = ENTRY.exec(readFileSync(fileFor(dir, label), "utf8").trim()) ?? [];
    return saved === label ? digest : undefined;
  } catch {
    return undefined;
  }
};

export const recordPass = (dir, step) => {
  const staging = `${fileFor(dir, step.label)}.${process.pid}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(staging, `${step.digest} ${step.label}\n`);
  renameSync(staging, fileFor(dir, step.label));
};

/** One `reads` decides both whether the diff reaches a step and what its digest covers, so the
 *  ledger can never trust a wider or narrower set of inputs than the scoping already trusted. */
export const ledgerFor = (steps, { root, files, runner }) => {
  const dir = join(gitCommonDir(root), "gate-ledger");
  const derivation = derivationFiles(runner, root);
  const entries = steps.map((step) => {
    const inputs = new Set(derivation);
    for (const file of files) {
      if (SHARED.test(file) || step.reads.some((claim) => under(file, claim))) inputs.add(file);
    }
    const digest = digestOf(root, inputs);
    return { ...step, digest, green: recordedDigest(dir, step.label) === digest };
  });
  return { dir, entries };
};
