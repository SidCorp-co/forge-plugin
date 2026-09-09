/* What each step's inputs hashed to when it last passed, and how long that pass took. Keyed on
   content, never on a sha: a rebase rewrites the sha, and the tree a session gates most has none. */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { derivationFiles, under } from "./scope.mjs";
import { recordDir } from "./timing.mjs";

const DIGEST_LENGTH = 12;
// Seconds before the label, the last capture, which on `.+` swallows a suffix; optional, so an older entry still reads as a pass.
const ENTRY = new RegExp(`^([0-9a-f]{${DIGEST_LENGTH}}) (?:(\\d+)s )?(.+)$`, "u");

// Every step's input: a dependency change can break any of them, and no step declares node_modules.
const SHARED = /^package(?:-lock)?\.json$/u;

export const LEDGER_UNSEEN = `Keyed on repository file content, the manifests, this runner's own modules and ${process.version}.
It cannot see node_modules as installed, anything outside the repository, or a tool on PATH. --full ignores
those digests, and reads the seconds beside them all the same, for the order and for nothing else.`;

const hashed = new Map();

/* The mode with the bytes, because the suite executes files of this tree; a deletion answers as
   itself; and a path git calls a file that the disk does not is a shape no digest here models. */
export const digestFile = (path, rewrite = null) => {
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
  const bytes = readFileSync(path);
  return createHash("sha256").update(found.mode & 0o111 ? "x" : "-")
    .update(rewrite ? rewrite(bytes.toString("utf8")) : bytes).digest("hex");
};

const hashFile = (path) => {
  if (!hashed.has(path)) hashed.set(path, digestFile(path));
  return hashed.get(path);
};

export const contentOf = (root, files) => new Map(files.map((file) => [file, hashFile(join(root, file))]));

export const forgetContent = () => hashed.clear();

const digestOf = (root, files) => {
  const hash = createHash("sha256");
  hash.update(`${process.version}\n`);
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(hashFile(join(root, file)));
  }
  return hash.digest("hex").slice(0, DIGEST_LENGTH);
};

// Theirs alone: the runs series, the per-file seconds and the attribution row are the record's siblings, and a one-slot entry from before it was keyed on content stays up there, out of every listing below.
const passes = (dir) => join(dir, "passes");

const nameOf = (label) => label.replace(/[^\w.-]+/gu, "-");

// The digest first, so the label is the whole remainder and compares as one however many dots it holds; a staging file leads with a dot and the pid, which no entry can.
const fileFor = (dir, label, digest) => join(passes(dir), `${digest}.${nameOf(label)}`);
const stagingFor = (dir, label, digest) => join(passes(dir), `.${process.pid}.${digest}.${nameOf(label)}`);
const ENTRY_NAME = new RegExp(`^([0-9a-f]{${DIGEST_LENGTH}})\\.(.+)$`, "u");

// Retention and not protection for a live worktree: an evicted entry costs the tree that held it one re-run of that step, and the digest guard is what decides green.
export const ENTRIES_PER_STEP = 24;

const heldFor = (dir, label) => {
  const want = nameOf(label);
  let names;
  try {
    names = readdirSync(passes(dir));
  } catch {
    return [];
  }
  return names.filter((one) => ENTRY_NAME.exec(one)?.[2] === want)
    .map((one) => join(passes(dir), one))
    .map((path) => ({ path, at: lstatSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0 }))
    .sort((one, other) => other.at - one.at);
};

// Unreadable, truncated, or another step's are all "no entry"; none of them may read as "passed".
const entryAt = (path, label) => {
  try {
    const [, digest, seconds, saved] = ENTRY.exec(readFileSync(path, "utf8").trim()) ?? [];
    return saved === label ? { digest, seconds: seconds === undefined ? null : Number(seconds) } : {};
  } catch {
    return {};
  }
};

const recorded = (dir, label, digest) => entryAt(fileFor(dir, label, digest), label);

// One entry per step and content, added and never replaced, so a worktree gating other content takes nothing from this one; forced, an entry a sibling pruned first being the state this wants (ISS-948).
export const recordPass = (dir, step, seconds) => {
  const staging = stagingFor(dir, step.label, step.digest);
  mkdirSync(passes(dir), { recursive: true });
  writeFileSync(staging, `${step.digest} ${seconds === null ? "" : `${seconds}s `}${step.label}\n`);
  renameSync(staging, fileFor(dir, step.label, step.digest));
  for (const held of heldFor(dir, step.label).slice(ENTRIES_PER_STEP)) rmSync(held.path, { force: true });
};

const lastTook = (dir, label) => {
  for (const held of heldFor(dir, label)) {
    const { seconds } = entryAt(held.path, label);
    if (seconds !== undefined && seconds !== null) return seconds;
  }
  return null;
};

// By label, so a run that may trust none of these digests is ordered by this record anyway; `ledgerFor`'s own `took` answers for its skip line and not for this, two reads of a record every worktree writes to being free to disagree.
export const secondsFor = (root, steps) => {
  const dir = recordDir(root);
  return steps.map((step) => ({ ...step, seconds: lastTook(dir, step.label) }));
};

const LAST = Number.MAX_SAFE_INTEGER;

// Never recorded and recorded before this kept seconds are one case, `null`, spent last. Stable sort.
export const cheapestFirst = (timed) =>
  [...timed].sort((one, other) => (one.seconds ?? LAST) - (other.seconds ?? LAST));

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
    const was = recorded(dir, step.label, digest);
    return { ...step, digest, green: was.digest === digest, took: was.seconds };
  });
  return { dir, entries };
};
