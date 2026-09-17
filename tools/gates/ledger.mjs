/* What each step's inputs hashed to when it last passed, and how long that pass took. Keyed on
   content, never on a sha: a rebase rewrites the sha, and the tree a session gates most has none. */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { RELEASE_FILES } from "../run/landing.mjs";
import { derivationFiles, under } from "./scope.mjs";
import { recordDir } from "./timing.mjs";

const DIGEST_LENGTH = 12;
// Seconds before the label, the last capture, which on `.+` swallows a suffix; optional, so an older entry still reads as a pass.
const ENTRY = new RegExp(`^([0-9a-f]{${DIGEST_LENGTH}}) (?:(\\d+)s )?(.+)$`, "u");

// Every step's input: a dependency change can break any of them, and no step declares node_modules.
const SHARED = /^package(?:-lock)?\.json$/u;

export const LEDGER_UNSEEN = `Keyed on repository file content, the manifests, this runner's own modules and ${process.version}.
A file a release writes a version into is keyed on its values with that version taken out of them, so a rebase past
another release leaves every step where it stood; one left behind at a number the others moved past keeps that number
in the digest, and everything in those files that is not that number is content like any other.
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
    .update(rewrite ? rewrite(bytes) : bytes).digest("hex");
};

// Where a release writes a version and nowhere else: the file's own field, and in a lock file the root package's second copy at `packages[""]`.
const LOCK = "package-lock.json";
const versionLocations = (one) => basename(one) === LOCK ? [["version"], ["packages", "", "version"]] : [["version"]];

// The number this file's own package is at, by the ownership `sync-manifest-version.mjs` writes under and `shipped-version` reads back — the nearest package.json at or above it, which for the lock file and for a manifest with no package of its own is the root's. Agreement with some other package is not the agreement any step tests. And a release number this repository cannot have written is no release number: a string outside the grammar takes the raw-byte path, so nothing a checker over the text can see is struck out as though it were a version.
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

const releaseVersion = (root, rel) => {
  let dir = dirname(rel);
  for (;;) {
    const owner = join(root, dir, "package.json");
    if (existsSync(owner)) {
      try {
        const { version } = JSON.parse(readFileSync(owner, "utf8"));
        return typeof version === "string" && VERSION.test(version) ? version : null;
      } catch {
        return null;
      }
    }
    if (dir === "." || dir === "" || dir === dirname(dir)) return null;
    dir = dirname(dir);
  }
};

// A tag and never a value put in the number's place: any string chosen to stand for agreement is one a file could really hold, and a file holding it would then digest exactly as an agreeing one and skip the step that reads whether these files agree at all.
const AGREES = { release: true };

const masked = (found, [key, ...deeper], was) => {
  if (found === null || typeof found !== "object" || !(key in found)) return found;
  if (deeper.length === 0) return { ...found, [key]: found[key] === was ? AGREES : { held: found[key] } };
  return { ...found, [key]: masked(found[key], deeper, was) };
};

// Two halves, because neither answers alone. The values say whether each location agrees, which is the only thing about these numbers any step reads — `shipped-version` compares them and nothing compares their value. The bytes beside them, that number struck out wherever it stands, say everything else the file holds: re-serialised values alone would lose whitespace and an escape a checker over the raw text can tell apart, and a dependency pinned at the release's own number is struck from the bytes and kept in the values. Each of the three readings opens with a word of its own, because a file this cannot parse is digested as itself and a file holding exactly what the reading above it produces would otherwise key where that file keys. `latin1` and not `utf8`: every byte is one code point back and forth, so a sequence no decoder agrees on is still its own.
const OWNED = "owned";
const UNREAD = "unread";
const UNOWNED = "unowned";

const besideVersion = (root, rel) => {
  const was = releaseVersion(root, rel);
  const quoted = was === null ? null : JSON.stringify(was);
  return (bytes) => {
    const raw = bytes.toString("latin1");
    if (quoted === null) return `${UNOWNED}\u0000${raw}`;
    try {
      const values = versionLocations(rel)
        .reduce((found, at) => masked(found, at, was), JSON.parse(bytes.toString("utf8")));
      return `${OWNED}\u0000${JSON.stringify(values)}\u0000${raw.split(quoted).join("")}`;
    } catch {
      return `${UNREAD}\u0000${raw}`;
    }
  };
};

/** What one file of a checkout hashes to, and the only derivation of it: two are free to disagree about a manifest, which is how a release's own version survived ISS-939 inside every step's digest and charged the next run to rebase a whole gate (ISS-1716). */
export const digestIn = (root, rel) =>
  digestFile(join(root, rel), RELEASE_FILES.includes(rel) ? besideVersion(root, rel) : null);

const hashFile = (root, rel) => {
  const path = join(root, rel);
  if (!hashed.has(path)) hashed.set(path, digestIn(root, rel));
  return hashed.get(path);
};

export const forgetContent = () => hashed.clear();

const digestOf = (root, files) => {
  const hash = createHash("sha256");
  hash.update(`${process.version}\n`);
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(hashFile(root, file));
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
