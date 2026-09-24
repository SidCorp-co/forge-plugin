/* A stored reading is read against the recent window only as far as the two can be told apart: what
   they share is counted and said, a reading sharing most of the window is refused with what it owes,
   and a bare anchor flag takes the newest reading sharing none (ISS-1890). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { WINDOW, evalRuns, runsMark } from "../../../src/stats/eval/eval.mjs";
import { overlapOf } from "../../../src/stats/marks/overlap.mjs";
import { CONSULTS, writeMark } from "../../../src/stats/marks/marks.mjs";
import { evalObject } from "../../../src/codex/codex-stats.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { FORGE, PROJECT, askStats, corpusOf, runsOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-overlap-home-");

test("what is owed is stepped arrival by arrival: a short window grows keeping what it shares, a full one drops its oldest", () => {
  assert.deepEqual(overlapOf(50, 50, 50), { shared: 50, recent: 50, untilReadable: 25, untilDisjoint: 50 });
  assert.deepEqual(overlapOf(25, 50, 50), { shared: 25, recent: 50, untilReadable: 0, untilDisjoint: 25 },
    "exactly half is readable");
  assert.deepEqual(overlapOf(26, 50, 50).untilReadable, 1, "and one past half is one arrival from it");
  assert.deepEqual(overlapOf(30, 30, 50), { shared: 30, recent: 30, untilReadable: 25, untilDisjoint: 50 },
    "twenty arrivals fill the window before the first shared row leaves it");
  assert.deepEqual(overlapOf(0, 0, 50), { shared: 0, recent: 0, untilReadable: 0, untilDisjoint: 0 });
});

test("a runs reading shares no more runs than its own window holds, whatever size the recent window is read at", () => {
  const runs = runsOf(200);
  const stored = { kind: "runs", mark: 100, now: evalRuns(runs.slice(0, 100), [], WINDOW).now };
  const wide = evalRuns(runs.slice(0, 100), [], 100, stored);
  assert.deepEqual(wide.overlap, { shared: 50, recent: 100, untilReadable: 0, untilDisjoint: 100 },
    "every one of the hundred ended before the stored window closed, fifty of them are its, and the fifty older go first");
  assert.equal(evalRuns(runs.slice(0, 150), [], 100, stored).overlap.shared, 50,
    "so fifty arrivals push out only the runs older than the stored window");
  assert.equal(evalRuns(runs.slice(0, 200), [], 100, stored).overlap.shared, 0, "and a hundred push out all of it");
});

const PLANTED = (n, clock = n) => ({
  kind: "consult", ok: true, id: `o${n}`, at: new Date(Date.UTC(2026, 8, 5) + clock * 60_000).toISOString(),
  root: "/planted", reply: "CODEX: 0 findings",
});

test("a consult reading's overlap follows the answered log's order, so a consult logged after the mark is never its own", () => {
  /* The first consult after the mark carries the mark's own clock: by time it would read as shared. */
  const rows = Array.from({ length: 150 }, (one, n) => PLANTED(n, n === 100 ? 99 : n));
  const stored = { kind: CONSULTS, mark: 100, ...evalObject(rows.slice(0, 100)) };
  assert.deepEqual(evalObject(rows, stored).overlap, { shared: 50, recent: 100, untilReadable: 0, untilDisjoint: 50 });
});

/* One home and one corpus per case, as the verbs read them; the corpus grows between the calls. */
const place = () => {
  const home = tempRoom("stats-overlap-");
  process.env.XDG_CONFIG_HOME = home;
  const room = corpusOf(50);
  process.env.TMPDIR = room;
  return { home, room };
};

test("a reading sharing most of the recent window is refused with what it shares, what it owes and the newest reading sharing none", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  try {
    const { home, room } = place();
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    corpusOf(100, room);
    assert.match(await runsMark(PROJECT), /held as mark 100/u);
    corpusOf(110, room);

    const refused = askStats(room, ["eval", "--checkout", PROJECT, "--against", "100", "--json"], home);
    assert.equal(refused.status, 1);
    assert.equal(refused.stdout, "", "no figure beside the refusal");
    assert.equal(refused.stderr.trim(), "stats eval: mark 100 shares 40 of the recent 50 run(s), so most of both sides "
      + "would be the same run(s); it can be read once 15 more have ended, and shares none once 40 have. The newest "
      + `reading sharing none is mark 50: \`forge stats eval --checkout ${PROJECT} --against 50\`.`);

    const bare = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--against", "--json"], home).stdout);
    assert.equal(bare.against, 50, "bare --against passes over the newer mark 100 for the newest sharing none");
    assert.deepEqual(bare.overlap, { shared: 0, recent: 50, untilReadable: 0, untilDisjoint: 0 });
    const screen = askStats(room, ["eval", "--checkout", PROJECT, "--against", "50"], home);
    assert.match(screen.stdout, /^the 50 held at mark 50 {2}.* — shares none of the recent window$/mu, screen.stderr);
  } finally {
    Object.assign(process.env, was);
  }
});

test("with no reading sharing none, the refusal and a bare flag name the sliding comparison", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  try {
    const { home, room } = place();
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    corpusOf(60, room);
    const slide = `\`forge stats eval --checkout ${PROJECT}\` compares the recent window with the one before it, which share nothing.`;
    const named = askStats(room, ["eval", "--checkout", PROJECT, "--against", "50"], home);
    assert.equal(named.status, 1);
    assert.match(named.stderr, /^stats eval: mark 50 shares 40 of the recent 50 run\(s\), so most of both sides/u);
    assert.ok(named.stderr.trim().endsWith(slide), named.stderr);
    const bare = askStats(room, ["eval", "--checkout", PROJECT, "--against"], home);
    assert.equal(bare.status, 1);
    assert.equal(bare.stderr.trim(), "stats eval: --against alone takes the newest reading sharing none of the recent "
      + "window, and no reading held shares none yet: mark 50, the newest, shares 40 of the recent 50 run(s), so most "
      + "of both sides would be the same run(s); it can be read once 15 more have ended, and shares none once 40 have. "
      + slide);

    /* A command a refusal names is the one the caller typed with the anchor swapped, so it reads the
       same checkout over the same window and is answered rather than refused again. */
    const narrow = askStats(room, ["eval", "--checkout", PROJECT, "--size", "20", "--against"], home);
    assert.equal(narrow.status, 1);
    const typed = /`forge (stats eval --checkout \S+ --size 20 --against 50)` reads it with that overlap stated\.$/u.exec(narrow.stderr.trim());
    assert.ok(typed, narrow.stderr);
    const followed = askStats(room, typed[1].split(" ").slice(1), home);
    assert.equal(followed.status, 0, followed.stderr);
    assert.match(followed.stdout, /^the 50 held at mark 50 {2}.* — shares 10 of the recent 20 run\(s\), and none once 10 more have ended$/mu);
  } finally {
    Object.assign(process.env, was);
  }
});

test("the consult eval refuses a mark sharing most of its recent window, by place in the log", () => {
  const home = tempRoom("codex-overlap-");
  mkdirSync(join(home, "forge"), { recursive: true });
  const rows = Array.from({ length: 130 }, (one, n) => PLANTED(n));
  writeFileSync(join(home, "forge", "codex-log.jsonl"), `${rows.map((one) => JSON.stringify(one)).join("\n")}\n`);
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    assert.equal(writeMark({ kind: CONSULTS, mark: 100, at: rows[99].at, ...evalObject(rows.slice(0, 100)) }), "written");
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
  const asked = spawnSync(FORGE, ["codex", "eval", "--against", "100"], {
    encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home },
  });
  assert.equal(asked.status, 1);
  assert.equal(asked.stderr.trim(), "codex eval: mark 100 shares 70 of the recent 100 consult(s), so most of both sides "
    + "would be the same consult(s); it can be read once 20 more have been answered, and shares none once 70 have. "
    + "`forge codex eval` compares the recent window with the one before it, which share nothing.");
});
