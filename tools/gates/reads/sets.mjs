/* One set of repository paths per test file, collected from what that file's own process tree was
   watched to ask for, and the answer to which of a step's files this content still has to spend. A
   file is skipped only on positive evidence: a set nothing recorded, an unfinished record, a route
   this cannot follow and a moved execution context each spend it, bar a declared ceiling. */
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync }
  from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { digestFile, digestIn } from "../ledger.mjs";
import { READS_DIR, READS_ROOT, READS_TICKET } from "./audit.mjs";
import { opensNothing } from "./shell.mjs";
import { linkInto } from "./placing.mjs";
import { DECLARED_READS, declarationFor, TEST_FILE } from "../steps.mjs";
import { under } from "../scope.mjs";

const DIGEST_LENGTH = 12;
const ENTRY_NAME = new RegExp(`^([0-9a-f]{${DIGEST_LENGTH}})\\.(.+)$`, "u");

// A test file costs one re-run when its oldest entry is evicted, and the store holds every path it read.
export const ENTRIES_PER_FILE = 3;

const MANIFEST = /(?:^|\/)package(?:-lock)?\.json$/u;

const held = new Map();

/* A path that is there and is not a file digests as that and no more: a test that probed a
   directory claimed its presence, and the names in it are a listing's claim rather than this one's. */
const hashed = (root, one) => {
  if (!held.has(one)) {
    let found;
    try {
      found = digestIn(root, one);
    } catch {
      found = "not a file";
    }
    held.set(one, found);
  }
  return held.get(one);
};

const listing = (root, one, deep = false) => {
  try {
    return readdirSync(join(root, one), deep ? { recursive: true } : undefined).sort().join("\n");
  } catch {
    return "absent";
  }
};

/* Everything below a path, by content: what a copy reads and what a glob's or a directory watch's
   answer turns on. Each name and each entry's kind are in the hash beside the content — a file
   becoming an empty directory of that name moves what such a call answers with while the names alone
   stand — and a link hashes as its own target text, a copy told to follow one blinding instead. Out
   of the walk are the two the collector itself refuses, under the same repository-relative names, so
   a `node_modules` a fixture keeps below a copied source is walked like anything else (ISS-1760). */
const UNSEEN = new Set(["node_modules", ".git"]);

const walks = new Map();
const walking = new Set();

const walked = (root, one) => {
  const at = join(root, one);
  let found;
  try {
    found = lstatSync(at, { throwIfNoEntry: false });
  } catch {
    return "unreadable";
  }
  if (found?.isSymbolicLink()) {
    let text;
    try {
      text = readlinkSync(at);
    } catch {
      text = "unreadable";
    }
    const to = linkInto(root, at);
    // Its own text as well as what it points at: a copy keeps the link, and a reader may ask for either.
    return to === null ? `link ${text}` : `link ${text} into ${contents(root, to)}`;
  }
  if (!found?.isDirectory()) return `file ${hashed(root, one)}`;
  let names;
  try {
    names = readdirSync(at);
  } catch {
    return "unreadable";
  }
  const hash = createHash("sha256");
  for (const name of [...names].sort()) {
    const rel = join(one, name);
    if (!UNSEEN.has(rel)) hash.update(`${name} ${contents(root, rel)}\n`);
  }
  return `dir ${hash.digest("hex")}`;
};

let ringed = false;

const contents = (root, one) => {
  if (walks.has(one)) return walks.get(one);
  if (walking.has(one)) {
    ringed = true;
    return "a ring of links";
  }
  walking.add(one);
  const outer = ringed;
  ringed = false;
  try {
    const found = walked(root, one);
    /* A ring has no content of its own, and a digest that stopped at one answers for the walk that
       reached it: cached, it would hold a second claim over what it reaches the long way round. */
    if (!ringed) walks.set(one, found);
    return found;
  } finally {
    ringed = ringed || outer;
    walking.delete(one);
  }
};

export const forgetReads = () => {
  held.clear();
  walks.clear();
  walking.clear();
  ringed = false;
};

export const readsDir = (record) => join(record, "test-reads");

export const manifestsIn = (files) => files.filter((one) => MANIFEST.test(one));

/** What a recorded set answers to beyond its own paths: this node, the launcher, the node options a
 *  step's processes inherit, the audit, where it places a name, what it reads of a shell, this
 *  collector, and the declarations — a claim widened or dropped unseats the entry written under the ceiling before it,
 *  and nothing else can, `matchIn` answering with the entry whose body digests to its own name. */
export const contextOf = (argv, options = process.env.NODE_OPTIONS ?? "", table = DECLARED_READS) => {
  const hash = createHash("sha256").update(`${process.version}\n`).update(`${argv.join(" ")}\n`)
    .update(`${options}\n`).update(`${JSON.stringify(table)}\n`);
  for (const one of ["./audit.mjs", "./placing.mjs", "./sets.mjs", "./shell.mjs"]) {
    hash.update(digestFile(fileURLToPath(new URL(one, import.meta.url))));
  }
  return hash.digest("hex").slice(0, DIGEST_LENGTH);
};

export const setDigest = (root, set, context) => {
  const hash = createHash("sha256").update(`${context}\n`);
  for (const one of [...set.paths].sort()) hash.update(`p ${one} ${hashed(root, one)}\n`);
  for (const one of [...set.dirs].sort()) hash.update(`d ${one} ${listing(root, one)}\n`);
  for (const one of [...set.trees].sort()) hash.update(`t ${one} ${listing(root, one, true)}\n`);
  for (const one of [...set.whole].sort()) hash.update(`w ${one} ${contents(root, one)}\n`);
  return hash.digest("hex").slice(0, DIGEST_LENGTH);
};

const nameOf = (file) => file.replace(/[^\w.-]+/gu, "-");

const entriesFor = (dir, file) => {
  const want = nameOf(file);
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((one) => ENTRY_NAME.exec(one)?.[2] === want).map((one) => join(dir, one));
};

// Newest first, so what a write evicts is the oldest and never the entry it has just recorded.
const newestFirst = (paths) => paths
  .map((path) => ({ path, at: lstatSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0 }))
  .sort((one, other) => other.at - one.at).map((one) => one.path);

const setAt = (path, file) => {
  try {
    const found = JSON.parse(readFileSync(path, "utf8"));
    return found.file === file && Array.isArray(found.paths) && Array.isArray(found.dirs)
      && Array.isArray(found.trees) && Array.isArray(found.whole) ? found : null;
  } catch {
    return null;
  }
};

/** The entry this content matches, or null; digested off the entry's own set rather than trusted from its name, which is what that set digested to when the file passed. */
const matchAmong = (paths, file, root, context) => {
  for (const path of paths) {
    const found = setAt(path, file);
    const digest = ENTRY_NAME.exec(path.split("/").at(-1))[1];
    if (found && setDigest(root, found, context) === digest) return { digest, set: found };
  }
  return null;
};

/** The newest set of this file's that reads back at all, no digest consulted: it answers for the content that recorded it
 *  and is still the only evidence anything holds of what the file reads, which is a claim about the file (ISS-1746). */
const closureAmong = (paths, file) => {
  for (const path of paths) {
    const found = setAt(path, file);
    if (found) return found;
  }
  return null;
};

const entriesIn = (dir, file) => newestFirst(entriesFor(dir, file));

/** The reach evidence alone, for the run that distrusts every digest here and narrows nothing: what a file reads is a different question from whether a pass covers it, and only the second is refused. */
export const closuresFor = (dir, files) => {
  const closures = new Map();
  for (const file of files) {
    const closure = closureAmong(entriesIn(dir, file), file);
    if (closure) closures.set(file, closure);
  }
  return closures;
};

/** Which of a step's files this content spends, and which the record already answers for. `unknown` are the spent files no readable set covers and `closures` the set of each of the rest, which decide nothing and report much (ISS-1746). */
export const selectTests = (dir, files, { root, context }) => {
  const kept = [];
  const spend = [];
  const unknown = [];
  const closures = new Map();
  for (const file of files) {
    const entries = entriesIn(dir, file);
    const found = matchAmong(entries, file, root, context);
    if (found) kept.push({ file, ...found });
    else {
      spend.push(file);
      const closure = closureAmong(entries, file);
      if (closure) closures.set(file, closure);
      else unknown.push(file);
    }
  }
  return { spend, kept, unknown, closures };
};

const subjectOf = (record, root) => {
  if (!Array.isArray(record.argv) || record.argv.length !== 1) return null;
  const one = String(record.argv[0]);
  const rel = one.startsWith(`${root}/`) ? one.slice(root.length + 1) : one;
  return TEST_FILE.test(rel) ? rel : null;
};

const within = (root, at) => {
  const rel = relative(root, at);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/** Whether a child that left no record could have read this repository at all: it could where it
 *  stood in the tree, or where something it was handed names a path in it. One that stood outside and
 *  was handed nothing in here read none of this content, and so did one whose own record says it
 *  opened no file of this repository, wherever it stood (ISS-1793). */
export const reaches = (root, one) => {
  const cwd = typeof one.cwd === "string" ? one.cwd : root;
  if (opensNothing(one)) return false;
  if (within(root, cwd)) return true;
  return [one.file, ...(one.args ?? [])].flatMap((each) => String(each).split(/\s+/u))
    .some((each) => each.length > 0 && within(root, resolve(cwd, each)));
};

// Every cause, not the first a LIFO queue popped; a child keyed on its arguments, quoted (ISS-1756).
const byCause = (one, other) => one.kind.localeCompare(other.kind) || one.why.localeCompare(other.why);

const said = (one) => (/^[\w.,:@=/+-]+$/u.test(one) ? one : JSON.stringify(one));

const gather = (start, byTicket, root) => {
  const paths = new Set();
  const dirs = new Set();
  const trees = new Set();
  const whole = new Set();
  const queue = [start];
  const blind = new Map();
  while (queue.length > 0) {
    const one = queue.pop();
    for (const path of one.paths) paths.add(path);
    for (const path of one.dirs) dirs.add(path);
    for (const path of one.trees) trees.add(path);
    for (const path of one.whole) whole.add(path);
    for (const why of one.blind) blind.set(JSON.stringify(["export", why]), { kind: "export", why });
    for (const each of one.spawned) {
      const child = each.ticket === null ? null : byTicket.get(each.ticket);
      if (child) queue.push(child);
      else if (reaches(root, each)) {
        const args = (each.args ?? []).map(String);
        const why = `${[each.file, ...args].map(said).join(" ")} in ${each.cwd}`;
        blind.set(JSON.stringify(["child", each.file, args, each.cwd]),
          { kind: "child", why, file: each.file, cwd: each.cwd, args });
      }
    }
  }
  return { paths, dirs, trees, whole, blind: [...blind.values()].sort(byCause) };
};

const wellFormed = (one) => one !== null && typeof one === "object" && one.done === true
  && Array.isArray(one.paths) && Array.isArray(one.dirs) && Array.isArray(one.trees)
  && Array.isArray(one.whole) && Array.isArray(one.spawned) && Array.isArray(one.blind);

/** Two processes under one ticket, put back together: a child that spawns node outside the shimmed
 *  import hands on the ticket it holds, and both write a record of the same subtree. Sets of paths
 *  and lists of children both belong to that subtree, so they add; `argv` is the first reader's and
 *  is read of a root alone; and a subtree is finished when every process in it finished (ISS-2119). */
const together = (one, other) => ({
  ...one,
  paths: [...one.paths, ...other.paths],
  dirs: [...one.dirs, ...other.dirs],
  trees: [...one.trees, ...other.trees],
  whole: [...one.whole, ...other.whole],
  spawned: [...one.spawned, ...other.spawned],
  blind: [...one.blind, ...other.blind],
});

/** The records a step left, apart from the sets, so a candidate change applied to them re-derives through this same code (ISS-1756). */
export const recordsIn = (out) => {
  let names;
  try {
    names = readdirSync(out);
  } catch {
    return { byTicket: new Map(), roots: [] };
  }
  const byTicket = new Map();
  const roots = [];
  for (const name of names) {
    let one;
    try {
      one = JSON.parse(readFileSync(join(out, name), "utf8"));
    } catch {
      continue;
    }
    if (!wellFormed(one)) continue;
    if (one.ticket) {
      const held = byTicket.get(one.ticket);
      byTicket.set(one.ticket, held ? together(held, one) : one);
    } else {
      roots.push(one);
    }
  }
  return { byTicket, roots };
};

/** One set per test file, from records already read; a file the audit could not follow carries every cause of it, and nothing is written for it. */
export const setsOf = ({ byTicket, roots }, root) =>
  roots.map((one) => ({ file: subjectOf(one, root), ...gather(one, byTicket, root) }))
    .filter((one) => one.file !== null);

export const setsFrom = (out, root) => setsOf(recordsIn(out), root);

// The preload `auditEnv` adds, which is this gate's instrument and never a step's subject.
const INSTRUMENT = ["./audit.mjs", "./placing.mjs", "./shell.mjs"];

// Every record a step left, children no root reaches included, as the one set it is judged by (ISS-1911).
export const stepSetOf = ({ byTicket, roots }, root) => {
  const sets = [...roots, ...byTicket.values()].map((one) => gather(one, byTicket, root));
  const mine = new Set(INSTRUMENT.map((one) => relative(root, fileURLToPath(new URL(one, import.meta.url)))));
  const all = (key) => new Set(sets.flatMap((one) => [...one[key]]).filter((each) => !mine.has(each)));
  const causes = sets.flatMap((one) => one.blind).map((one) => [`${one.kind}\u0000${one.why}`, one]);
  return { paths: all("paths"), dirs: all("dirs"), trees: all("trees"), whole: all("whole"),
    blind: [...new Map(causes).values()].sort(byCause) };
};

export const stepSetFrom = (out, root) => stepSetOf(recordsIn(out), root);

/** A declaration's claims in the shape a derived set has, so one comparison answers for both; a
 *  claim no tracked path is is a directory: the walk below it and every tracked file in it. */
export const declaredSet = (claims, tracked) => {
  const paths = new Set();
  const dirs = new Set();
  const trees = new Set();
  const whole = new Set();
  for (const claim of claims) {
    if (tracked.includes(claim)) {
      paths.add(claim);
      continue;
    }
    if (claim === ".") dirs.add(claim);
    else trees.add(claim);
    for (const one of tracked) if (under(one, claim)) paths.add(one);
  }
  return { paths, dirs, trees, whole };
};

// The audit's reads kept beside the ceiling: a path git does not track has a content it cannot reach.
const withSeen = (held, seen) => ({
  paths: new Set([...held.paths, ...seen.paths]),
  dirs: new Set([...held.dirs, ...seen.dirs]),
  trees: new Set([...held.trees, ...seen.trees]),
  whole: new Set([...held.whole, ...seen.whole]),
});

// One comparison, two doors: a ceiling keeps the walk it saw, a step keys its digest on the claim alone.
const shallow = (kind, one, claim) =>
  claim === "." && kind !== "path" && !(kind === "listing" && one === ".");

const escaping = (set, claims, past) =>
  [["path", set.paths], ["listing", set.dirs], ["walk", set.trees], ["content", set.whole]]
    .flatMap(([kind, seen]) => [...seen]
      .filter((one) => !claims.some((claim) => under(one, claim) && !past(kind, one, claim)))
      .map((one) => ({ kind, one })));

export const escapesIn = (set, claims) => escaping(set, claims, () => false);

export const stepEscapes = (set, claims) => escaping(set, claims, shallow);

/** Every declared file's observed reads against its own ceiling, judged whichever way the step went:
 *  a ceiling the evidence contradicts is the tree's defect, not the step's, and a step that failed
 *  spent those files too. Writing is `recordSets`, which only a step that passed reaches. */
export const claimsJudged = (sets, { manifests, declared: table = [] }) => {
  const dead = [];
  const escaped = [];
  const several = [];
  for (const set of sets) {
    const claim = declarationFor(set.file, table);
    if (!claim) continue;
    if (set.blind.length === 0) {
      dead.push({ file: set.file, blind: claim.blind, where: claim.where });
      continue;
    }
    // A ceiling is written against one cause, and nothing said the audit had seen two (ISS-1761).
    if (set.blind.length > 1) {
      several.push({ file: set.file, where: claim.where, blind: claim.blind, causes: set.blind });
    }
    const escapes = escapesIn(set, [...claim.reads, ...manifests, set.file]);
    if (escapes.length > 0) {
      escaped.push({ file: set.file, where: claim.where, claims: claim.reads, escapes });
    }
  }
  return { dead, escaped, several };
};

/** Written whole and renamed into place, one entry per file and content, so a worktree gating other
 *  content adds an entry beside this tree's rather than replacing it. A blind file is written from
 *  its declaration, and never one `claimsJudged` found reading outside it. */
export const recordSets = (dir, sets, { root, context, manifests, tracked = [], declared: table = [], escaped = [] }) => {
  let wrote = 0;
  const declared = [];
  const refused = new Set(escaped.map((one) => one.file));
  for (const set of sets) {
    const blind = set.blind.length > 0;
    const claim = blind ? declarationFor(set.file, table) : null;
    if (blind && (!claim || refused.has(set.file))) continue;
    let held = set;
    if (blind) {
      held = withSeen(declaredSet([...claim.reads, set.file], tracked), set);
      declared.push(set.file);
    }
    const paths = [...new Set([...held.paths, ...manifests])].sort();
    /* `context` is in the body and not in the name every digest here is keyed on: an entry written
       before it reads back the same, and a run can name the context as why it spent (ISS-1746). */
    const body = { file: set.file, context, ...(claim && { declared: claim.blind }), paths,
      dirs: [...held.dirs].sort(), trees: [...held.trees].sort(), whole: [...held.whole].sort() };
    const digest = setDigest(root, body, context);
    mkdirSync(dir, { recursive: true });
    const staging = join(dir, `.${process.pid}.${digest}.${nameOf(set.file)}`);
    writeFileSync(staging, `${JSON.stringify(body)}\n`);
    renameSync(staging, join(dir, `${digest}.${nameOf(set.file)}`));
    wrote += 1;
    for (const path of newestFirst(entriesFor(dir, set.file)).slice(ENTRIES_PER_FILE)) rmSync(path, { force: true });
  }
  return { wrote, declared };
};

/** The environment a step's processes are audited under: where each writes its record, what counts
 *  as inside this repository, and the preload that does it. The ticket is emptied: a step's
 *  processes begin a tree of their own, and one inherited would file them under somebody else's. */
export const auditEnv = (out, root) => ({
  [READS_DIR]: out,
  [READS_ROOT]: root,
  [READS_TICKET]: "",
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${new URL("./audit.mjs", import.meta.url).href}`.trim(),
});
