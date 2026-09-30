/* The one sweep, proven at its home and at each room that spends it: the stamps, plan-scope, the
   briefs store and the config directory's stranded temp files. Every bound is pinned on a clock of
   its own, so a file exactly as old as its bound is past it and one a millisecond younger is not. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { tempHome } from "../fixtures.mjs";

import { aged, reap } from "../../src/rooms/reap.mjs";

const ROOT = tempHome("reap").path;
process.env.TMPDIR = ROOT;
process.env.XDG_CONFIG_HOME = join(ROOT, "config");

const { FRESH_MS, keepBrief } = await import("../../src/brief/record.mjs");
const { writeJsonPrivate } = await import("../../src/resolve/config.mjs");
const stamps = await import("../../src/hooks/stamps.mjs");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");
const HOME = join(SRC, "rooms", "reap.mjs");
const SPENDERS = ["hooks/stamps.mjs", "flow/record/plan-scope.mjs", "brief/record.mjs", "resolve/config.mjs"];
const NOW = Date.parse("2026-09-15T00:00:00.000Z");
const DAY = 86_400_000;

const aging = (at, ageMs, now = NOW) => utimesSync(at, (now - ageMs) / 1000, (now - ageMs) / 1000);

const planted = (room, name, ageMs, now = NOW) => {
  mkdirSync(room, { recursive: true });
  writeFileSync(join(room, name), "");
  aging(join(room, name), ageMs, now);
  return join(room, name);
};

const roomOf = (name) => {
  const room = join(ROOT, name);
  mkdirSync(room, { recursive: true });
  return room;
};

test("the sweep takes a room, a life and a clock, and answers with the names it left", () => {
  const room = roomOf("swept");
  planted(room, "a-day", DAY);
  planted(room, "a-day-less-a-millisecond", DAY - 1);
  planted(room, "an-hour", 3_600_000);
  assert.deepEqual(reap(room, DAY, NOW).sort(), ["a-day-less-a-millisecond", "an-hour"]);
  assert.deepEqual(readdirSync(room).sort(), ["a-day-less-a-millisecond", "an-hour"], "and the day-old one is gone");
  assert.deepEqual(reap(room, 3_600_000, NOW), [], "a shorter life takes both");
  assert.deepEqual(reap(join(ROOT, "never-made"), DAY, NOW), [], "a room nobody made answers with nothing");
});

test("an entry exactly as old as its life is past it, and a file already gone is not", () => {
  const room = roomOf("bound");
  const at = planted(room, "on-the-bound", 60_000);
  assert.equal(aged(at, 60_000, NOW), true, "the bound itself is past it");
  assert.equal(aged(at, 60_001, NOW), false, "a millisecond more of life is not");
  assert.equal(aged(join(room, "never-written"), 60_000, NOW), false, "nothing to remove is nobody's to remove");
});

test("a directory past its life goes with what it holds only where the room is swept whole", () => {
  const room = roomOf("directories");
  mkdirSync(join(room, "session"));
  planted(join(room, "session"), "record", 0);
  aging(join(room, "session"), DAY);
  assert.deepEqual(reap(room, DAY, NOW), [], "a room of files cannot empty a directory, and does not answer for it");
  assert.equal(existsSync(join(room, "session", "record")), true, "so what it holds is left");
  assert.deepEqual(reap(room, DAY, NOW, { whole: true }), [], "swept whole");
  assert.equal(existsSync(join(room, "session")), false, "it is gone with its record");
});

test("a sweep told which names are its own judges no other and answers for none of them", () => {
  const room = roomOf("shared");
  planted(room, "mine.tmp", DAY);
  planted(room, "mine-too.tmp", 0);
  planted(room, "someone-elses.json", DAY * 30);
  const kept = reap(room, DAY, NOW, { only: (name) => name.endsWith(".tmp") });
  assert.deepEqual(kept, ["mine-too.tmp"], "the admitted name inside its life, and no other");
  assert.deepEqual(readdirSync(room).sort(), ["mine-too.tmp", "someone-elses.json"], "a month-old file it was not told of stands");
});

/* Real time: `keepBrief` takes a clock, so the store's entries are planted against the one it is handed. */
test("keeping a brief removes a session's directory past ten minutes, with what it holds", () => {
  const briefs = join(process.env.XDG_CONFIG_HOME, "forge", "briefs");
  const old = join(briefs, "gone-session");
  planted(old, "a-brief", FRESH_MS);
  aging(old, FRESH_MS);
  const live = join(briefs, "live-session");
  planted(live, "a-brief", FRESH_MS - 1);
  aging(live, FRESH_MS - 1);
  keepBrief("this-session", "the brief", NOW);
  assert.equal(existsSync(old), false, "a directory exactly ten minutes old is past the window, and its brief with it");
  assert.equal(existsSync(join(live, "a-brief")), true, "one a millisecond inside it survives, and so does its brief");
  assert.equal(readdirSync(join(briefs, "this-session")).length, 1, "and the brief being kept is written");
});

/* The write reads the clock itself, so the clock is held still: the bound is then a millisecond, not a race. */
test("a config write sweeps its own path's stranded temp files and no other file of the directory", (t) => {
  const room = join(process.env.XDG_CONFIG_HOME, "forge");
  const now = NOW;
  t.mock.method(Date, "now", () => now);
  const target = join(room, "swept.json");
  const stranded = planted(room, "swept.json.999999.tmp", 60_000, now);
  const busy = planted(room, "swept.json.999998.tmp", 59_999, now);
  const others = [
    planted(room, "config.json", DAY * 30, now),
    planted(room, "other.json.999997.tmp", DAY * 30, now),
    planted(room, "swept.json.999996.bak", DAY * 30, now),
  ];
  writeJsonPrivate(target, { a: 1 });
  assert.equal(existsSync(stranded), false, "a temp file exactly a minute old is a killed writer's");
  assert.equal(existsSync(busy), true, "one a millisecond younger may be a write in progress");
  for (const one of others) assert.equal(existsSync(one), true, `${one} is not this path's temp file`);
  assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { a: 1 });
});

/* The module graph and not the text: what each module loads is the claim, and the one-home guard's
   row in `plugin/test/markdown.test.mjs` is what holds each of them to no loop of its own. */
const importsOf = (path) => [...readFileSync(path, "utf8").matchAll(/from\s+"([^"]+)"/gu)].map(([, one]) => one);

test("the home imports nothing outside node:, and every room loads it", () => {
  assert.ok(importsOf(HOME).length > 0, "the scan read the home's imports");
  assert.deepEqual(importsOf(HOME).filter((one) => !one.startsWith("node:")), [], "a module outside node: would load on every spender's path");
  for (const rel of SPENDERS) {
    const home = importsOf(join(SRC, rel)).filter((one) => one.endsWith("/rooms/reap.mjs"));
    assert.equal(home.length, 1, `${rel} loads the home`);
  }
});

test("the stamps no longer hand out the sweep, so there is one route to it", () => {
  assert.equal("reap" in stamps, false);
  assert.equal("aged" in stamps, false);
});
