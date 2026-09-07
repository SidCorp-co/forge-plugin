/* How a credit survives being written by several processes of one session at once. Carried from
   `tracker/comments.test.mjs` with the mechanism, because each case below is a shape that lost a
   credit: rebuilding the file left 1 of 12, a count of sessions evicted a live run (ISS-650), and a
   rotation under an append dropped lines until the append confirmed which journal it landed in. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("shown-journal");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(
  join(HOME.path, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME.path;

const { KEPT, credit, creditedTo, shedable } = await import("../../src/shown/journal.mjs");

const STORE = join(HOME.path, "forge", "shown.json");
const LOG = join(HOME.path, "forge", "shown.jsonl");
const store = () => JSON.parse(readFileSync(STORE, "utf8"));
const ids = (count, mark) => Array.from({ length: count }, (unused, at) => `${mark}-${at}`);

const seed = (rows) => {
  writeFileSync(STORE, JSON.stringify(rows));
  rmSync(LOG, { force: true });
  for (const one of readdirSync(join(HOME.path, "forge"))) {
    if (one.endsWith(".folding")) rmSync(join(HOME.path, "forge", one), { force: true });
  }
};

/* The credit is an append and the file is what the appends have been folded into, so a case that
   reads the file rather than asking `creditedTo` writes the journal up to the length that folds it. */
const foldNow = (session, surface) => {
  for (let at = 0; at < KEPT.lines; at += 1) credit(session, surface, [`fold-${at}`]);
  return store();
};

test("the state is keyed by session and by surface, and an empty credit records nothing", () => {
  seed({});
  credit("session-one", "surface-A", ["c1"]);
  assert.ok(creditedTo("session-one", "surface-A").has("c1"), "the session that was shown holds it");
  assert.equal(creditedTo("nobody-at-all", "surface-A").size, 0, "one key per session");
  assert.equal(creditedTo("session-one", "surface-B").size, 0, "one key per surface under it");
  assert.equal(credit("session-one", "surface-C", []), false, "an empty credit is not written");
  assert.equal(creditedTo("session-one", "surface-C").size, 0, "so that surface is owed the text again");
});

/* The defect ISS-650 is: eight was fitted to one device, and a wave writes under nine names or more,
   so the run in a gate wait was the coldest and lost every surface it had been shown. */
test("no count of sessions decides which stay: nine write, and all nine keep their credit", () => {
  seed({});
  const nine = ids(9, "wave");
  for (const session of nine) credit(session, "surface-A", ["c1"]);
  for (const session of nine) {
    assert.deepEqual([...creditedTo(session, "surface-A")], ["c1"], `${session} kept its own credit`);
  }
});

test("a session that has just written is kept whatever else the file holds", () => {
  seed(Object.fromEntries(ids(40, "other")
    .map((name) => [name, { at: new Date().toISOString(), surfaces: { "surface-A": ["c1"] } }])));
  credit("the-forty-first", "surface-A", ["c2"]);
  assert.deepEqual([...creditedTo("the-forty-first", "surface-A")], ["c2"], "forty others evict nobody");
  assert.deepEqual([...creditedTo("other-0", "surface-A")], ["c1"], "and none of the forty is dropped");
});

/* Age is what a dead session is, and the only thing that drops one. `<` is the comparison, so a
   session exactly at the cutoff is kept: the safe side is the one that costs no delivery. */
test("a session silent longer than a day goes, and one inside the day stays", () => {
  const ago = (ms) => new Date(Date.now() - ms).toISOString();
  const day = KEPT.days * 86_400_000;
  seed({
    "long-gone": { at: ago(day + 5_000), surfaces: { "surface-A": ["c1"] } },
    "just-inside": { at: ago(day - 5_000), surfaces: { "surface-A": ["c1"] } },
  });
  assert.equal(creditedTo("long-gone", "surface-A").size, 0, "a day of silence is a session that ended");
  assert.deepEqual([...creditedTo("just-inside", "surface-A")], ["c1"], "and one inside it is untouched");
  const held = foldNow("writing-now", "surface-B");
  assert.equal(held["long-gone"], undefined, "and the fold is where it leaves the file");
  assert.deepEqual(held["just-inside"].surfaces["surface-A"], ["c1"]);
  assert.equal(held["writing-now"].surfaces["surface-B"].length, KEPT.lines);
});

/* The bound is on what is kept. Forty was a count, and a dispatcher passes it in a morning. */
test("a session past forty-one surfaces still holds its first, being nowhere near the item budget", () => {
  seed({});
  for (let at = 0; at < 41; at += 1) credit("busy", `surface-${at}`, [`c${at}`]);
  assert.deepEqual([...creditedTo("busy", "surface-0")], ["c0"], "the first is there at the forty-first");
  assert.deepEqual([...creditedTo("busy", "surface-40")], ["c40"]);
});

test("past the item budget the coldest surface goes, and never the surface being credited", () => {
  const wide = Object.fromEntries(ids(30, "surface").map((key) => [key, ids(KEPT.items, key)]));
  seed({ big: { at: new Date().toISOString(), surfaces: wide } });
  const held = foldNow("big", "surface-just-read").big.surfaces;
  const total = Object.values(held).reduce((sum, kept) => sum + kept.length, 0);
  assert.ok(total <= KEPT.perSession, `${total} items kept is inside the budget of ${KEPT.perSession}`);
  assert.equal(held["surface-just-read"].length, KEPT.lines, "the surface this write read is kept");
  assert.equal(held["surface-0"], undefined, "and the coldest is the one paid with");
  assert.deepEqual(Object.keys(held).at(-1), "surface-just-read", "which is the last key, being newest");
});

test("one surface keeps the last four hundred items and no more", () => {
  seed({});
  credit("session-wide", "surface-many", ids(KEPT.items + 5, "many"));
  const kept = [...creditedTo("session-wide", "surface-many")];
  assert.equal(kept.length, KEPT.items, "no surface keeps more items than the cap");
  assert.equal(kept.at(-1), `many-${KEPT.items + 4}`, "and the ones kept are the most recently credited");
  assert.equal(kept.includes("many-0"), false);
});

/* Rebuilding the file left 1 of 12 credits and eleven went with no call having failed. Every child
   parks on one wall-clock instant, so the overlap is the case rather than the machine's scheduling
   of twelve start-ups, and the writers are processes because that is the losing shape. */
const SOURCE = new URL("../../src/shown/journal.mjs", import.meta.url).pathname;
const WRITERS = 12;

const allAtOnce = async (surface) => {
  const startAt = Date.now() + 1_000;
  const marks = ids(WRITERS, "from");
  await Promise.all(marks.map((mark) => new Promise((settle) => {
    spawn(process.execPath, ["--input-type=module", "-e", `
      import { credit } from ${JSON.stringify(SOURCE)};
      const gate = new Int32Array(new SharedArrayBuffer(4));
      while (Date.now() < ${startAt}) Atomics.wait(gate, 0, 0, 1);
      credit("one-session", ${JSON.stringify(surface)}, [${JSON.stringify(mark)}]);
    `], { stdio: ["ignore", "inherit", "inherit"] }).on("exit", settle);
  })));
  const kept = creditedTo("one-session", surface);
  return marks.filter((mark) => !kept.has(mark));
};

test("twelve processes credit one store at one instant and none of the twelve is lost", async () => {
  seed({});
  assert.deepEqual(await allAtOnce("surface-B"), [], "every credit is in the store");
});

/* An absent lock read as age zero was stale, and its removal fell on a live holder's (ISS-673). */
test("a lock that is not there is not a stale one, and only a stale one is taken", () => {
  const mine = "this-fold";
  const fresh = Date.now();
  assert.equal(shedable(undefined, null, mine), false, "no lock was read, so there is none to shed");
  assert.equal(shedable(undefined, "another-fold", mine), false,
    "a holder read a moment ago and a lock gone now is a lock this one must not remove");
  assert.equal(shedable(fresh, null, mine), false, "nor one whose holder it could not read");
  assert.equal(shedable(fresh, "another-fold", mine), false, "a live holder keeps its lock");
  assert.equal(shedable(fresh - 10_000, "another-fold", mine), true, "a stale one is reclaimed");
  assert.equal(shedable(fresh, mine, mine), true, "and a fold releases its own however fresh");
});

/* A fold killed between its rename and its release leaves a lock nothing else sweeps, and its own
   lines in an aside. Neither may cost a credit: the lock is reclaimed only from the holder read
   stale, and an aside is read exactly as the journal is until some fold puts it in the file. */
test("twelve contenders lose no credit past a stranded lock and a stranded aside", async () => {
  seed({});
  const lock = `${STORE}.lock`;
  writeFileSync(lock, "a holder that died");
  writeFileSync(`${LOG}.a-fold-that-died.folding`, `${JSON.stringify({
    at: new Date().toISOString(), session: "one-session", surface: "surface-C", items: ["stranded"],
  })}\n`);
  const old = Date.now() / 1000 - 600;
  const { utimesSync } = await import("node:fs");
  utimesSync(lock, old, old);
  assert.deepEqual(await allAtOnce("surface-C"), [], "no credit waited on the lock at all");
  assert.ok(creditedTo("one-session", "surface-C").has("stranded"), "the abandoned fold's line reads");
  const held = foldNow("one-session", "surface-C")["one-session"].surfaces["surface-C"];
  assert.ok(held.includes("stranded"), "the fold takes the abandoned lines into the file");
});

/* Two rotations by one process behind a lock it never gets. Each rename needs its own destination:
   named once per process, the second rotation renames over the aside the first one left waiting. */
test("a second rotation behind a lock it cannot get keeps the first rotation's lines", () => {
  seed({});
  const lock = `${STORE}.lock`;
  writeFileSync(lock, "a holder that is alive");
  for (let at = 0; at < KEPT.lines; at += 1) credit("one-session", "surface-P", [`p-${at}`]);
  for (let at = 0; at < KEPT.lines; at += 1) credit("one-session", "surface-Q", [`q-${at}`]);
  const asides = () => readdirSync(join(HOME.path, "forge")).filter((one) => one.endsWith(".folding"));
  assert.equal(creditedTo("one-session", "surface-P").size, KEPT.lines, "the rotation that lost the lock kept its lines");
  assert.equal(creditedTo("one-session", "surface-Q").size, KEPT.lines, "and so did the one after it");
  assert.equal(asides().length, 2, "each rotation waits in an aside of its own");
  rmSync(lock, { force: true });
  for (let at = 0; at < KEPT.lines; at += 1) credit("one-session", "surface-R", [`r-${at}`]);
  assert.equal(asides().length, 0, "and the first fold to get the lock reads them in and sweeps them");
  assert.equal(creditedTo("one-session", "surface-P").size, KEPT.lines, "keeping what was waiting in them");
});

/* One append is one call, and the rotation under it is another process's: the line can land in an
   inode a fold has already read and unlinked, which no lock the appender takes can prevent. Each
   writer folds every second line, because at the shipped threshold the window is too narrow to
   watch — the same harness lost nothing against code that confirmed nothing, and 2 to 7 credits of
   2400 once the rotations were this frequent. */
test("a credit survives the journal being rotated and folded away under its append", async () => {
  seed({});
  const each = 300;
  const marks = ids(8, "surface-W");
  await Promise.all(marks.map((mark) => new Promise((settle) => {
    spawn(process.execPath, ["--input-type=module", "-e", `
      import { KEPT, credit } from ${JSON.stringify(SOURCE)};
      KEPT.lines = 2;
      for (let at = 0; at < ${each}; at += 1) {
        credit("hot-session", ${JSON.stringify(mark)}, ["c-" + at]);
      }
    `], { stdio: ["ignore", "inherit", "inherit"] }).on("exit", settle);
  })));
  for (const mark of marks) {
    const kept = creditedTo("hot-session", mark);
    const missing = ids(each, "c").filter((id) => !kept.has(id));
    assert.deepEqual(missing, [], `${mark} lost a credit to a rotation under the append`);
  }
});
