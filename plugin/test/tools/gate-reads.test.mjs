/* The rules the per-file scoping of a test step rests on: a file is held back only on positive
   evidence, and every way the audit can fail to answer spends it instead (ISS-654). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { auditEnv, contextOf, forgetReads, reaches, recordSets, selectTests, setsFrom }
  from "../../../tools/gates/read-sets.mjs";
import { optionsIn } from "../../../tools/gates/reads.mjs";
import { entryNames, landed, run, scratch, write } from "./gates/scratch.mjs";
import { tempRoom } from "../fixtures.mjs";

const AUDIT = fileURLToPath(new URL("../../../tools/gates/reads.mjs", import.meta.url));
const FILE = "plugin/test/one.test.mjs";
const CONTEXT = contextOf(["--test"]);

const room = (files = {}) => {
  const at = tempRoom("gate-reads-");
  const root = join(at, "checkout");
  for (const [path, text] of Object.entries({ [FILE]: "the test\n", ...files })) write(root, path, text);
  return { at, root, dir: join(at, "records") };
};

const setOf = (paths, dirs = []) => ({ file: FILE, paths: new Set(paths), dirs: new Set(dirs) });

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

test("a blind set is written for nothing, so the file it belongs to is spent", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [{ ...setOf(["plugin/src/one.mjs"]), blind: "git in the checkout" }]).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a child that left no record blinds its test file where it could have read this repository", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    const one = { ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], done: true,
      spawned: [{ ticket: "gone", file: "git", cwd: where.root, args: ["status"] }] };
    writeFileSync(join(out, "own-1.json"), JSON.stringify(one));
    assert.equal(setsFrom(out, where.root)[0].blind, `git in ${where.root}`);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a child that stood outside this repository and was handed nothing in it holds nothing back", () => {
  const where = room();
  try {
    assert.equal(reaches(where.root, { file: "git", cwd: "/tmp", args: ["-C", "/tmp", "status"] }), false);
    assert.equal(reaches(where.root, { file: "git", cwd: where.root, args: ["status"] }), true);
    assert.equal(reaches(where.root, { file: "git", cwd: "/tmp", args: ["-C", join(where.root, "plugin")] }), true);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a process record no completion marker closed is not read at all", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    const one = { ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], spawned: [] };
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
    const parent = records.find((one) => one.ticket === null);
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
   test file reads is exactly the rebase this issue is about. */
test("a gate whose diff moved nothing any test file reads spends none of them, and names each", () => {
  const { at, work } = scratch("reads-gate", null, null);
  try {
    landed(work, "plugin/src/one.mjs", "one, moved\n");
    assert.match(run(work).stdout, /reads: \d+ of \d+ test file\(s\) recorded what they asked for/u);
    const before = entryNames(work).filter((one) => one.endsWith(".test")).length;
    landed(work, "docs/requirements/one.md", "the requirement moved\n");
    const { stdout } = run(work);
    assert.match(stdout, /=== reads: test — \d+ of \d+ test file\(s\) already answered for at this content ===/u);
    assert.match(stdout, /skip plugin\/test\/tools\/one\.test\.mjs {2}digest [0-9a-f]{12}/u);
    assert.equal(entryNames(work).filter((one) => one.endsWith(".test")).length, before,
      "a step that spent fewer files than its half holds recorded a pass of its own");
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
