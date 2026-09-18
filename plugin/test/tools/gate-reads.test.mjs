/* The rules the per-file scoping of a test step rests on: a file is held back only on positive
   evidence, and every way the audit can fail to answer spends it instead (ISS-654). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { auditEnv, contextOf, ENTRIES_PER_FILE, forgetReads, recordSets, selectTests, setsFrom }
  from "../../../tools/gates/reads/sets.mjs";
import { CLASSIFIED, optionsIn, shimSource, SHIMMED } from "../../../tools/gates/reads/audit.mjs";
import { landed, run, scratch, write } from "./gates/scratch.mjs";
import { tempRoom } from "../fixtures.mjs";

const AUDIT = fileURLToPath(new URL("../../../tools/gates/reads/audit.mjs", import.meta.url));
const FILE = "plugin/test/one.test.mjs";
const CONTEXT = contextOf(["--test"]);

const room = (files = {}) => {
  const at = tempRoom("gate-reads-");
  const root = join(at, "checkout");
  for (const [path, text] of Object.entries({ [FILE]: "the test\n", ...files })) write(root, path, text);
  return { at, root, dir: join(at, "records") };
};

const setOf = (paths, dirs = [], trees = []) =>
  ({ file: FILE, paths: new Set(paths), dirs: new Set(dirs), trees: new Set(trees), blind: [] });

const held = ({ root, dir }, sets, manifests = []) => {
  forgetReads();
  recordSets(dir, sets, { root, context: CONTEXT, manifests });
  forgetReads();
  return selectTests(dir, [FILE], { root, context: CONTEXT });
};

const again = ({ root, dir }, context = CONTEXT) => {
  forgetReads();
  return selectTests(dir, [FILE], { root, context });
};

/* Through the environment the gate hands a step and not through a flag on the line: the preload
   reaching a child at all is what the ticket in that child's record is evidence of. */
const audited = (root, out, script) => {
  write(root, "ran.mjs", script);
  return spawnSync(process.execPath, [join(root, "ran.mjs")],
    { cwd: root, encoding: "utf8", env: { ...process.env, ...auditEnv(out, root) } });
};

const recordsIn = (out) => readdirSync(out).map((one) => JSON.parse(readFileSync(join(out, one), "utf8")));

test("a file the record holds a matching set for is held back, and one it holds nothing for is spent", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(selectTests(where.dir, [FILE], { root: where.root, context: CONTEXT }).spend, [FILE]);
    const { kept, spend } = held(where, [setOf(["plugin/src/one.mjs"])]);
    assert.deepEqual(spend, []);
    assert.equal(kept.length, 1);
    assert.match(kept[0].digest, /^[0-9a-f]{12}$/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a path in the set whose content moved spends the file, and one that was deleted spends it too", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "plugin/src/two.mjs": "two\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/one.mjs", "plugin/src/two.mjs"])]).spend, []);
    write(where.root, "plugin/src/one.mjs", "one, moved\n");
    assert.deepEqual(again(where).spend, [FILE], "a path that moved");
    write(where.root, "plugin/src/one.mjs", "one\n");
    rmSync(join(where.root, "plugin/src/two.mjs"));
    assert.deepEqual(again(where).spend, [FILE], "a path that was deleted");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* Asking is the read: the probe that found nothing is what makes the file appearing a change to
   this test, and a record of what was opened alone could not say it. */
test("a path the test probed and did not find spends the file once that path exists", () => {
  const where = room();
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/absent.json"])]).spend, []);
    write(where.root, "plugin/src/absent.json", "{}\n");
    assert.deepEqual(again(where).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a name appearing in a directory the test listed spends it, though no path it read moved", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/one.mjs"], ["plugin/src"])]).spend, []);
    write(where.root, "plugin/src/three.mjs", "three\n");
    assert.deepEqual(again(where).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A specifier's target is chosen by a manifest node reads through internals no audit here sees, so
   a mapping moved to another existing file would otherwise move nothing in the set. */
test("a manifest of this repository moving spends every file recorded beside it", () => {
  const where = room({ "package.json": "{}\n", "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/one.mjs"])], ["package.json"]).spend, []);
    write(where.root, "package.json", `{ "imports": {} }\n`);
    assert.deepEqual(again(where).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a set recorded under another execution context answers for nothing", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/one.mjs"])]).spend, []);
    assert.deepEqual(again(where, contextOf(["--test", "--conditions=other"])).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* Every recorded set carries the manifests, so a release moving the number in one of them would
   otherwise spend every test file on the head every branch is cut from. */
test("the number a release writes leaves a set the record holds green, and a dependency beside it does not", () => {
  const where = room({ "package.json": `{ "version": "1.0.0" }\n`, "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/one.mjs"])], ["package.json"]).spend, []);
    write(where.root, "package.json", `{ "version": "1.0.1" }\n`);
    assert.deepEqual(again(where).spend, [], "the number alone moved, and nothing carried it");
    write(where.root, "package.json", `{ "version": "1.0.1", "dependencies": { "dep": "1.0.0" } }\n`);
    assert.deepEqual(again(where).spend, [FILE], "and a dependency moved with it is content");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a process record no completion marker closed is not read at all", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    const one = { ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [],
      blind: [], spawned: [] };
    writeFileSync(join(out, "own-1.json"), JSON.stringify(one));
    assert.deepEqual(setsFrom(out, where.root), [], "unclosed");
    writeFileSync(join(out, "own-1.json"), JSON.stringify({ ...one, done: true }));
    assert.equal(setsFrom(out, where.root).length, 1, "closed");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* Every route into the builtins, because one missed is a wrong skip: the named import this
   repository uses everywhere, a dynamic import, a listing, and a probe that found nothing. */
test("the audit records what a process imported dynamically, read by path, listed and probed", () => {
  const where = room({ "plugin/src/late.mjs": "export const one = 1;\n" });
  const out = join(where.at, "out");
  try {
    const said = audited(where.root, out, [`import { readFileSync, readdirSync, existsSync } from "node:fs";`,
      `await import("./plugin/src/late.mjs");`, `readFileSync("plugin/src/late.mjs");`,
      `readdirSync("plugin/src");`, `existsSync("plugin/src/never.mjs");`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    const [one] = recordsIn(out);
    assert.ok(one.paths.includes("plugin/src/late.mjs"), `imported and read: ${one.paths.join(" ")}`);
    assert.ok(one.paths.includes("plugin/src/never.mjs"), `probed: ${one.paths.join(" ")}`);
    assert.deepEqual(one.dirs, ["plugin/src"]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a node child's own reads are recorded under the ticket the process that spawned it holds", () => {
  const where = room({
    "plugin/src/child.mjs": `import { readFileSync } from "node:fs";\nreadFileSync("plugin/src/deep.mjs");\n`,
    "plugin/src/deep.mjs": "deep\n",
  });
  const out = join(where.at, "out");
  try {
    const said = audited(where.root, out, [`import { spawnSync } from "node:child_process";`,
      `const said = spawnSync(process.execPath, ["plugin/src/child.mjs"], { encoding: "utf8" });`,
      `if (said.status !== 0) { console.error(said.stderr); process.exit(1); }`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    const records = recordsIn(out);
    const parent = records.find((one) => one.argv[0].endsWith("ran.mjs"));
    assert.ok(parent, `no record for the process that spawned it: ${records.length}`);
    assert.equal(parent.spawned.length, 1);
    const child = records.find((one) => one.ticket === parent.spawned[0].ticket);
    assert.ok(child, `no record under the ticket: ${records.map((one) => one.ticket).join(" ")}`);
    assert.ok(child.paths.includes("plugin/src/deep.mjs"), child.paths.join(" "));
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("the audit writes nothing at all where the gate named no directory", () => {
  const where = room();
  const out = join(where.at, "out");
  try {
    write(where.root, "ran.mjs", `import { readFileSync } from "node:fs";\nreadFileSync("${FILE}");\n`);
    const said = spawnSync(process.execPath, [join(where.root, "ran.mjs")],
      { cwd: where.root, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: `--import=file://${AUDIT}` } });
    assert.equal(said.status, 0, said.stderr);
    assert.throws(() => readdirSync(out), /ENOENT/u);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The ticket rides in the options argument, which every spawning signature places differently: one
   put in the wrong place is a child spawned with the caller's arguments shifted. */
test("every spawning signature gets its options, and a callback stays last", () => {
  assert.deepEqual(optionsIn(["git", ["status"]]), { before: ["git", ["status"]], options: {}, after: [] });
  assert.deepEqual(optionsIn(["git", ["status"], { cwd: "/tmp" }]),
    { before: ["git", ["status"]], options: { cwd: "/tmp" }, after: [] });
  const back = () => {};
  assert.deepEqual(optionsIn(["ls -l", { cwd: "/tmp" }, back]), { before: ["ls -l"], options: { cwd: "/tmp" }, after: [back] });
  assert.deepEqual(optionsIn(["ls -l", back]), { before: ["ls -l"], options: {}, after: [back] });
});

/* The whole of it against the runner itself: a landing under a path the `test` step reads that no
   test file reads is exactly the rebase this issue is about. What it spent, it proved; what it held
   back, a record at this same content proved — so the step passed, and the gate after it skips the
   step outright rather than re-deciding file by file. */
test("a gate whose diff moved nothing any test file reads spends none of them, and names each", () => {
  const { at, work } = scratch("reads-gate", null, null);
  try {
    landed(work, "plugin/src/one.mjs", "one, moved\n");
    assert.match(run(work).stdout, /reads: \d+ of \d+ test file\(s\) recorded what they asked for/u);
    landed(work, "docs/requirements/one.md", "the requirement moved\n");
    const { stdout } = run(work);
    assert.match(stdout, /=== reads: test — \d+ of \d+ test file\(s\) already answered for at this content ===/u);
    assert.match(stdout, /skip plugin\/test\/tools\/one\.test\.mjs {2}digest [0-9a-f]{12}/u);
    assert.match(run(work).stdout, /skip test {19}digest [0-9a-f]{12}/u,
      "the narrowed step recorded no pass of its own, so the whole of it is spent again");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("--full spends every test file whatever the record holds", () => {
  const { at, work } = scratch("reads-full", null, null);
  try {
    landed(work, "plugin/src/one.mjs", "one, moved\n");
    run(work);
    const { stdout } = run(work, ["--full"]);
    assert.doesNotMatch(stdout, /=== reads: /u);
    assert.match(stdout, /=== test ===/u);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* A walk of everything below a directory is a different claim from the names in it: a file added
   under a directory that already existed moves neither the names above it nor any path read. */
test("a file appearing deep under a directory the test walked spends it, where a listing would not", () => {
  const where = room({ "plugin/src/deep/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf([], [], ["plugin/src"])]).spend, []);
    write(where.root, "plugin/src/deep/two.mjs", "two\n");
    assert.deepEqual(again(where).spend, [FILE], "the walk");
    forgetReads();
    recordSets(where.dir, [setOf([], ["plugin/src"])], { root: where.root, context: CONTEXT, manifests: [] });
    forgetReads();
    write(where.root, "plugin/src/deep/three.mjs", "three\n");
    assert.deepEqual(again(where).spend, [], "the names one level down, which did not move");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a file read through the promises export of node:fs is in the set", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  const out = join(where.at, "out");
  try {
    const said = audited(where.root, out, [`import { promises } from "node:fs";`,
      `await promises.readFile("plugin/src/one.mjs");`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    assert.ok(recordsIn(out)[0].paths.includes("plugin/src/one.mjs"), recordsIn(out)[0].paths.join(" "));
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* An import that failed resolves through no load hook, so the candidate goes in before the attempt:
   a test passing on its fallback would otherwise answer for the file appearing. */
test("an import that did not resolve is in the set, and a walk by pattern blinds the file instead", () => {
  const where = room();
  const out = join(where.at, "out");
  try {
    const said = audited(where.root, out, [`try { await import("./plugin/src/optional.mjs"); } catch { /* the fallback */ }`,
      `const { globSync } = await import("node:fs");`, `globSync("plugin/**/*.mjs");`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    const [one] = recordsIn(out);
    assert.ok(one.paths.includes("plugin/src/optional.mjs"), one.paths.join(" "));
    assert.deepEqual(one.blind, ["globSync: a listing by pattern"]);
    assert.equal(setsFrom(out, where.root).length, 0, "no test file, so no set; the blindness is the record's");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a process that walked by pattern blinds the test file whose tree it is in", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    writeFileSync(join(out, "own-1.json"), JSON.stringify({
      ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [],
      blind: ["globSync: a listing by pattern"], spawned: [], done: true,
    }));
    assert.deepEqual(setsFrom(out, where.root)[0].blind,
      [{ kind: "export", why: "globSync: a listing by pattern" }]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The whole-tree readers list the root itself, and `relative` gives that no name at all: dropped, a
   file appearing at the top would move nothing they hold. */
test("a listing of the repository root is a claim about the names in it", () => {
  const where = room();
  const out = join(where.at, "out");
  try {
    const said = audited(where.root, out, [`import { readdirSync } from "node:fs";`, `readdirSync(".");`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    assert.deepEqual(recordsIn(out)[0].dirs, ["."]);
    assert.deepEqual(held(where, [setOf([], ["."])]).spend, []);
    write(where.root, "one-more.md", "at the top\n");
    assert.deepEqual(again(where).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a path in the set that is a directory digests as one rather than refusing the whole set", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src", "plugin/src/one.mjs"])]).spend, []);
    write(where.root, "plugin/src/two.mjs", "two\n");
    assert.deepEqual(again(where).spend, [], "the names in it are a listing's claim and not this one's");
    write(where.root, "plugin/src/one.mjs", "one, moved\n");
    assert.deepEqual(again(where).spend, [FILE], "the file it did read");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a file copied out of this repository is a read of it, whichever half of the copy answers", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    const said = audited(where.root, out, [`import { promises } from "node:fs";`,
      `await promises.copyFile("plugin/src/one.mjs", process.env.GATE_READS + "/../copied.mjs");`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    assert.ok(recordsIn(out).some((one) => one.paths.includes("plugin/src/one.mjs")),
      recordsIn(out).flatMap((one) => one.paths).join(" "));
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a set recorded under other node options answers for nothing", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [setOf(["plugin/src/one.mjs"])]).spend, []);
    assert.deepEqual(again(where, contextOf(["--test"], "--conditions=other")).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The one rule that keeps the rest honest as node moves: a member classified nowhere blinds the file
   that called it, and a member nobody has looked at is a read this would never have seen. */
test("every export of every shimmed builtin is classified, so a name node adds fails here", () => {
  for (const specifier of [...SHIMMED].filter((one) => one.startsWith("node:"))) {
    const real = process.getBuiltinModule(specifier);
    const loose = Object.keys(real).filter((one) => /^[A-Za-z_$][\w$]*$/u.test(one)
      && !CLASSIFIED.some((set) => set.has(one)));
    assert.deepEqual(loose, [], `${specifier} exports these, and the audit says nothing about them`);
  }
});

test("a member the audit classifies nowhere is wrapped to blind the file that called it", () => {
  const source = shimSource("node:fs", { readFileSync: () => {}, inventedRead: () => {} });
  assert.match(source, /export const readFileSync = asked\(real\.readFileSync\);/u);
  assert.match(source, /export const inventedRead = blinded\(real\.inventedRead, "inventedRead: classified in no set/u);
});

/* A wrapper that dropped what the export held would change what the suite does — `promisify(exists)`
   rejects with `true` where the custom promisify is gone — and what it carries has to record too. */
test("a wrapper carries what the export it replaces held, and what it carries records as well", () => {
  const where = room({ "plugin/src/one.mjs": "one\n", "plugin/src/read-me.md": "read\n" });
  const out = join(where.at, "out");
  try {
    const said = audited(where.root, out, [`import { exists, realpathSync, ReadStream } from "node:fs";`,
      `import { promisify } from "node:util";`,
      `if (await promisify(exists)("plugin/src/one.mjs") !== true) throw new Error("exists lost its promisify");`,
      `if (await promisify(exists)("plugin/src/gone.mjs") !== false) throw new Error("absent read as a failure");`,
      `realpathSync.native("plugin/src/one.mjs");`,
      `await new Promise((done) => new ReadStream("plugin/src/read-me.md").on("close", done).resume());`].join("\n"));
    assert.equal(said.status, 0, said.stderr);
    const [one] = recordsIn(out);
    for (const path of ["plugin/src/one.mjs", "plugin/src/gone.mjs", "plugin/src/read-me.md"]) {
      assert.ok(one.paths.includes(path), `${path} is in none of ${one.paths.join(" ")}`);
    }
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// What a write evicts is the oldest entry: evicting the one it just made costs that file every run.
test("a file past the entries a record keeps for it loses its oldest and keeps the newest", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  const how = { root: where.root, context: CONTEXT, manifests: [] };
  try {
    for (const each of ["one", "two", "three", "four", "five"]) {
      write(where.root, "plugin/src/one.mjs", `${each}\n`);
      forgetReads();
      recordSets(where.dir, [setOf(["plugin/src/one.mjs"])], how);
    }
    assert.equal(readdirSync(where.dir).length, ENTRIES_PER_FILE);
    assert.deepEqual(again(where).spend, [], "the content the newest entry was written at");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A run that may not trust the ledger's digests may not trust these either: no digest here covers a
   path no step claims, so the record would hand the widening straight back. */
test("a run that may not read the ledger's digests spends every test file too", () => {
  const { at, work } = scratch("reads-unread", null, null);
  try {
    landed(work, "plugin/src/one.mjs", "one, moved\n");
    assert.match(run(work).stdout, /reads: \d+ of \d+ test file\(s\) recorded/u);
    landed(work, "newdir/one.mjs", "export const one = 1;\n");
    const { stdout } = run(work);
    assert.match(stdout, /=== ledger: digests not read — no step claims newdir\/one\.mjs/u, stdout);
    assert.doesNotMatch(stdout, /=== reads: /u, stdout);
    for (const label of ["test", "test:tree"]) assert.match(stdout, new RegExp(`=== ${label} ===`, "u"), stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
