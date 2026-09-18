/* What blinds a test file, and every cause of it: a file is held back only on positive evidence, so
   a route the audit cannot follow spends it — and which routes those were is what a read ceiling
   gets written against, so one of them surviving a traversal was the whole of ISS-1756. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { contextOf, forgetReads, reaches, recordSets, selectTests, setsFrom }
  from "../../../../../tools/gates/reads/sets.mjs";
import { write } from "../scratch.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const FILE = "plugin/test/one.test.mjs";
const CONTEXT = contextOf(["--test"]);

const room = (files = {}) => {
  const at = tempRoom("gate-blind-");
  const root = join(at, "checkout");
  for (const [path, text] of Object.entries({ [FILE]: "the test\n", ...files })) write(root, path, text);
  return { at, root, dir: join(at, "records") };
};

const setOf = (paths, dirs = [], trees = []) =>
  ({ file: FILE, paths: new Set(paths), dirs: new Set(dirs), trees: new Set(trees), blind: [] });

const said = (one) => (/^[\w.,:@=/+-]+$/u.test(one) ? one : JSON.stringify(one));

const child = (file, cwd, args = []) =>
  ({ kind: "child", why: `${[file, ...args].map(said).join(" ")} in ${cwd}`, file, cwd, args });

const held = ({ root, dir }, sets, manifests = []) => {
  forgetReads();
  recordSets(dir, sets, { root, context: CONTEXT, manifests });
  forgetReads();
  return selectTests(dir, [FILE], { root, context: CONTEXT });
};

test("a blind set is written for nothing, so the file it belongs to is spent", () => {
  const where = room({ "plugin/src/one.mjs": "one\n" });
  try {
    assert.deepEqual(held(where, [{ ...setOf(["plugin/src/one.mjs"]), blind: [child("git", "the checkout")] }]).spend, [FILE]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("a child that left no record blinds its test file where it could have read this repository", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    const one = { ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [],
      blind: [], done: true, spawned: [{ ticket: "gone", file: "git", cwd: where.root, args: ["status"] }] };
    writeFileSync(join(out, "own-1.json"), JSON.stringify(one));
    assert.deepEqual(setsFrom(out, where.root)[0].blind, [child("git", where.root, ["status"])]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The first cause a `pop()` reached was the one kept, so which of several survived was traversal
   order — and it is the field a read ceiling gets written against (ISS-1756). */
test("a file two unrecorded children reached reports both causes and not whichever came first", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    writeFileSync(join(out, "own-1.json"), JSON.stringify({
      ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [], blind: [],
      done: true, spawned: [
        { ticket: "gone-1", file: "git", cwd: where.root, args: ["grep", "-l", "--", "*.mjs"] },
        { ticket: "gone-2", file: "sh", cwd: where.root, args: ["-c", "ls"] },
      ],
    }));
    assert.deepEqual(setsFrom(out, where.root)[0].blind,
      [child("git", where.root, ["grep", "-l", "--", "*.mjs"]), child("sh", where.root, ["-c", "ls"])]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A bounded command and a walk of the whole tree are two causes, and standing in the same directory
   is not what makes them one: a ceiling written against the first is wrong about the second. */
test("two children of one program in one directory are two causes where their commands differ", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    writeFileSync(join(out, "own-1.json"), JSON.stringify({
      ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [], blind: [],
      done: true, spawned: [
        { ticket: "gone-1", file: "git", cwd: where.root, args: ["grep", "-l", "--", "*.mjs"] },
        { ticket: "gone-2", file: "git", cwd: where.root, args: ["status", "--porcelain"] },
        { ticket: "gone-3", file: "git", cwd: where.root, args: ["status", "--porcelain"] },
      ],
    }));
    assert.deepEqual(setsFrom(out, where.root)[0].blind.map((one) => one.why), [
      `git grep -l -- "*.mjs" in ${where.root}`,
      `git status --porcelain in ${where.root}`,
    ], "and the same command twice is the same cause");
    writeFileSync(join(out, "own-1.json"), JSON.stringify({
      ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [], blind: [],
      done: true, spawned: [
        { ticket: "gone-1", file: "git", cwd: where.root, args: ["grep", "--", "a b"] },
        { ticket: "gone-2", file: "git", cwd: where.root, args: ["grep", "--", "a", "b"] },
      ],
    }));
    assert.deepEqual(setsFrom(out, where.root)[0].blind.map((one) => one.why), [
      `git grep -- "a b" in ${where.root}`,
      `git grep -- a b in ${where.root}`,
    ], "the arguments themselves are the identity, and the quoting says which is which");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The two kinds are different work — a classification the audit owns against a boundary one test
   file opens — so a census that fuses them tells nobody which of the two it is asking for. */
test("an unfollowable export and an unrecorded child are both reported, each under its own kind", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    writeFileSync(join(out, "own-1.json"), JSON.stringify({
      ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [], done: true,
      blind: ["cpSync: a tree copied whole"],
      spawned: [{ ticket: "gone", file: "git", cwd: where.root, args: ["grep", "-l"] }],
    }));
    assert.deepEqual(setsFrom(out, where.root)[0].blind, [
      child("git", where.root, ["grep", "-l"]),
      { kind: "export", why: "cpSync: a tree copied whole" },
    ]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// A cause a descendant record carried, which the root's own tree only reaches by following a ticket.
test("a cause a descendant process carried is the file's too, beside the root's own", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  try {
    writeFileSync(join(out, "own-1.json"), JSON.stringify({
      ticket: null, argv: [join(where.root, FILE)], paths: [FILE], dirs: [], trees: [], done: true,
      blind: ["globSync: a listing by pattern"],
      spawned: [{ ticket: "t-1", file: "node", cwd: where.root, args: ["child.mjs"] }],
    }));
    writeFileSync(join(out, "t-1.json"), JSON.stringify({
      ticket: "t-1", argv: ["child.mjs"], paths: [], dirs: [], trees: [], done: true,
      blind: ["cpSync: a tree copied whole"], spawned: [],
    }));
    assert.deepEqual(setsFrom(out, where.root)[0].blind.map((one) => one.why),
      ["cpSync: a tree copied whole", "globSync: a listing by pattern"]);
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

/* The exemption ISS-1793 adds, at the one place that spends a test file for it: a shell asked where a
   program is stood in the checkout and opened nothing there, while one asked to read a tracked path
   is the child nothing here can follow. Which shell command lines are which is shell.test.mjs. */
test("a shell that opens no file derives its file's set, and one that reads the tree still blinds it", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  const ran = (args) => JSON.stringify({ ticket: null, argv: [join(where.root, FILE)], paths: [FILE],
    dirs: [], trees: [], blind: [], done: true,
    spawned: [{ ticket: "gone", file: "/bin/sh", cwd: where.root, args, pathIn: false, funcIn: false }] });
  try {
    writeFileSync(join(out, "own-1.json"), ran(["-c", "command -v git"]));
    assert.deepEqual(setsFrom(out, where.root)[0].blind, []);
    writeFileSync(join(out, "own-1.json"), ran(["-c", `cat ${FILE}`]));
    assert.deepEqual(setsFrom(out, where.root)[0].blind,
      [child("/bin/sh", where.root, ["-c", `cat ${FILE}`])]);
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});
