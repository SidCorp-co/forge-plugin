/* The comparison is the profile twice and a difference named; every figure it prints is pinned to
   the profile over the same rows, and the mark to the corpus count, on a corpus small enough to
   count by hand. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WINDOW, evalRuns, evalLines, runsMark } from "../../src/stats/eval.mjs";
import { marksOf, marksPath, writeMark } from "../../src/stats/marks.mjs";
import { profileOf, runsUnder } from "../../src/stats/runs.mjs";
import { slugFor } from "../../src/stats/transcripts.mjs";
import { UNRECORDED, copyAt, installedCopies, spansInstall } from "../../src/stats/versions.mjs";
import { shiftBetween, tallied, twoWindows } from "../../src/stats/windows.mjs";
import { evalObject, evalWindows } from "../../src/codex/codex-stats.mjs";
import { tempRoom } from "../fixtures.mjs";

/* The mark writes a reading under the config directory, so the process's own is moved first. */
process.env.XDG_CONFIG_HOME = tempRoom("stats-eval-home-");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const CODEX_STATS = new URL("../../src/codex/codex-stats.mjs", import.meta.url).pathname;
const PROJECT = "/fixture/project";
const BASE = Date.parse("2026-09-01T00:00:00.000Z");
const HOUR = 3600;
const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

/* One run per hour, each a brief, a claim and its answer, lasting ten minutes plus two more for every
   fifth run, so the medians of two windows differ by something a hand can check. */
const runText = (n) => {
  const start = n * HOUR;
  const lasted = 600 + (n % 5) * 120;
  return [
    JSON.stringify({ timestamp: at(start), type: "user", message: { role: "user", content: `Skill forge:issue-flow ISS-${n}` } }),
    JSON.stringify({ timestamp: at(start + 30), message: { role: "assistant", content: [{ type: "tool_use", id: `c${n}`, name: "Bash", input: { command: `forge claim ISS-${n}` } }] } }),
    JSON.stringify({ timestamp: at(start + lasted), message: { role: "user", content: [{ type: "tool_result", tool_use_id: `c${n}`, content: "claimed" }] } }),
  ].join("\n");
};

const corpusOf = (many, room = tempRoom("stats-eval-")) => {
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session", "tasks");
  mkdirSync(tasks, { recursive: true });
  for (let n = 0; n < many; n += 1) writeFileSync(join(tasks, `a${String(n).padStart(4, "0")}.output`), `${runText(n)}\n`);
  return room;
};

/* HOME points at an empty room, so no install record answers and every run is unrecorded; the config
   directory is a fresh room unless the case hands over the one its own mark wrote into. */
const askStats = (room, argv, home = tempRoom("stats-eval-home-")) =>
  spawnSync(FORGE, ["stats", ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home, TMPDIR: room, HOME: tempRoom("stats-eval-user-") },
  });
const ask = (room, ...argv) => askStats(room, ["eval", "--checkout", PROJECT, ...argv]);

const runsOf = (many) => runsUnder(join(corpusOf(many), `claude-${process.getuid()}`, slugFor(PROJECT)), null).runs;

test("two windows are the last N and the N before them, adjacent, and a short list gives a short before", () => {
  const rows = Array.from({ length: 7 }, (_, n) => n);
  assert.deepEqual(twoWindows(rows, 3), { now: [4, 5, 6], before: [1, 2, 3] });
  assert.deepEqual(twoWindows(rows, 5), { now: [2, 3, 4, 5, 6], before: [0, 1] }, "before is what the list holds, not padded");
  assert.deepEqual(twoWindows([1, 2], 3), { now: [1, 2], before: [] });
  const dimensions = [["k", (row) => row.k]];
  const shifted = shiftBetween(tallied([{ k: "a" }, { k: "a" }], dimensions), tallied([{ k: "b" }], dimensions));
  assert.deepEqual(shifted, [{ name: "k", values: [{ value: "a", now: 2, before: 0 }, { value: "b", now: 0, before: 1 }] }]);
  assert.deepEqual(shiftBetween({ k: { a: 0 } }, { k: { a: 0 } }), [{ name: "k", values: [] }], "a value neither window holds is no difference");
});

/* Criterion 17: the codex eval and the runs eval split and tally through one pair of functions. */
test("the codex eval's split and tally are the shared functions, not a second copy", () => {
  const source = readFileSync(CODEX_STATS, "utf8");
  assert.match(source, /from "\.\.\/stats\/windows\.mjs"/u, "codex-stats imports the shared module");
  assert.doesNotMatch(source, /slice\(-size\)/u, "and keeps no split of its own");
  const rows = Array.from({ length: 250 }, (_, n) => ({ kind: "consult", ok: true, reply: "x", at: at(n), id: `w${n}`, slot: n < 150 ? "a" : "b" }));
  const { now, before } = evalWindows(rows);
  assert.deepEqual({ now, before }, twoWindows(rows, 100));
  assert.deepEqual(evalObject(rows).shifts[0].values, [{ value: "b", now: 100, before: 0 }, { value: "a", now: 0, before: 100 }]);
});

test("the copy a run began under is the newest installed before its first record, or unrecorded", () => {
  const copies = [{ copy: "1.0.0", at: 100, born: true }, { copy: "1.1.0", at: 200, born: true }];
  assert.equal(copyAt(copies, 150), "1.0.0");
  assert.equal(copyAt(copies, 200), "1.1.0", "at the install moment the new copy is the one on the path");
  assert.equal(copyAt(copies, 50), UNRECORDED, "older than every copy present is said, not filed under the oldest");
  assert.equal(spansInstall(copies, { startedAt: 150, endedAt: 250 }), true);
  assert.equal(spansInstall(copies, { startedAt: 200, endedAt: 250 }), false, "an install at the first record is the run's own copy");
  assert.equal(spansInstall(copies, { startedAt: 210, endedAt: 250 }), false);
});

test("installed copies are read off the cache directory with their creation moment, oldest first", () => {
  const root = tempRoom("stats-eval-cache-");
  mkdirSync(join(root, "3.35.2"));
  writeFileSync(join(root, "not-a-copy.txt"), "");
  mkdirSync(join(root, "3.35.1"));
  const held = installedCopies(root);
  assert.deepEqual(held.map((one) => one.copy).sort(), ["3.35.1", "3.35.2"], "a file beside the directories is no copy");
  assert.ok(held.every((one) => one.at > 0), "each carries the moment it arrived");
  assert.ok(held[0].at <= held[1].at, "oldest first");
  assert.deepEqual(installedCopies(null), [], "no cache root is no copies, not a throw");
});

/* Criterion 7: the eval's figures are the profile's over the same rows. */
test("every figure of a window is the profile over that window's runs, ordered by their last record", () => {
  const runs = runsOf(110);
  const held = evalRuns(runs, [], WINDOW);
  const byEnd = [...runs].sort((a, b) => a.endedAt - b.endedAt);
  assert.equal(held.now.runs, 50);
  assert.equal(held.before.runs, 50);
  assert.equal(held.total, 110);
  assert.deepEqual(held.now.profile, profileOf(byEnd.slice(-50)));
  assert.deepEqual(held.before.profile, profileOf(byEnd.slice(10, 60)));
  assert.deepEqual(held.now.groups.map((one) => one.copy), [UNRECORDED], "no cache answers, so one group");
  assert.deepEqual(held.shifts.find((one) => one.name === "spanned").values, [{ value: "one copy throughout", now: 50, before: 50 }]);
  /* Nothing a reader can derive, and no dimension that re-tallies the group block (ISS-492); `spanned`
     is the one count the shifts need that neither the profile nor the groups hold (ISS-478). */
  assert.deepEqual(Object.keys(held.now).sort(), ["groups", "profile", "runs", "spanned"]);
  assert.deepEqual(Object.keys(held.before).sort(), ["groups", "profile", "runs", "spanned"]);
  assert.equal(held.now.spanned, 0);
  assert.deepEqual(held.shifts.map((one) => one.name), ["tier", "spanned"], "copies are compared in the group block alone");
  /* Criterion 18: off the window objects, and what the row tally said. */
  const rowTally = (rows) => tallied(rows, [["tier", (run) => run.tier], ["spanned", (run) => (run.spanned ? "saw a release land" : "one copy throughout")]]);
  const untallied = shiftBetween(rowTally(byEnd.slice(-50).map((run) => ({ ...run, spanned: false }))), rowTally(byEnd.slice(10, 60).map((run) => ({ ...run, spanned: false }))));
  assert.deepEqual(held.shifts, untallied, "the tallies the windows carry give the shifts the rows gave");
});

test("the rows that moved most carry both values and both counts, and a row absent on one side is not a fall", () => {
  const runs = runsOf(110);
  const held = evalRuns(runs, [], WINDOW);
  /* The fixture's tenth run of every ten is the long one on both sides, so the medians match and nothing moves. */
  assert.equal(held.moved.tiers.rose, null);
  assert.equal(held.moved.tiers.fell, null);
  const lines = evalLines(held).join("\n");
  assert.match(lines, /the last 50 issue-flow run\(s\)/u);
  assert.match(lines, /the 50 before them/u);
  assert.match(lines, /tier {3}no row rose on both sides/u);
  assert.match(lines, /copy unrecorded — began before every copy the cache still holds/u);

  /* Shorten the recent window's runs and the untiered row falls, with the counts beside it. */
  const cheaper = runs.map((run, n) => (n >= 60 ? { ...run, seconds: run.seconds / 2 } : run));
  const moved = evalRuns(cheaper, [], WINDOW).moved.tiers;
  assert.equal(moved.rose, null);
  assert.equal(moved.fell.row, "untiered");
  assert.equal(moved.fell.runsBefore, 50);
  assert.equal(moved.fell.runsNow, 50);
  assert.ok(moved.fell.by < 0 && moved.fell.now < moved.fell.before);
});

test("fewer than two full windows is said: the shortfall, or nothing yet to compare", () => {
  const short = ask(corpusOf(70));
  assert.equal(short.status, 0, short.stderr);
  assert.match(short.stdout, /the 20 before them .* — short of a full 50 by 30/u, short.stdout);

  const few = ask(corpusOf(50));
  assert.equal(few.status, 0, few.stderr);
  assert.match(few.stdout, /nothing yet to compare this one against/u, few.stdout);
  assert.match(few.stdout, /the corpus holds 50 run\(s\) in all/u);

  const none = ask(tempRoom("stats-eval-empty-"));
  assert.equal(none.status, 0, none.stderr);
  assert.match(none.stdout, /No issue-flow run under .*-fixture-project, so there is nothing to compare/u);
});

test("--json is the comparison alone, --size sets both windows, and a bad size is refused by name", () => {
  const room = corpusOf(110);
  const json = ask(room, "--json");
  assert.equal(json.status, 0, json.stderr);
  const held = JSON.parse(json.stdout);
  assert.equal(held.size, 50);
  assert.equal(held.now.runs, 50);
  assert.equal(held.before.runs, 50);
  assert.equal(held.project, PROJECT);
  assert.equal(held.copies, 0);
  assert.deepEqual(Object.keys(held), ["root", "project", "skipped", "unreadable", "copies", "size", "total", "now", "before", "moved", "shifts"]);
  assert.deepEqual(Object.keys(held.now), ["runs", "spanned", "profile", "groups"], "criterion 15: the window carries spanned and nothing else new");
  assert.ok(held.now.profile.from <= held.now.profile.to, "the bounds are the profile's, not a second copy on the window");

  const sized = JSON.parse(ask(room, "--size", "7", "--json").stdout);
  assert.equal(sized.now.runs, 7);
  assert.equal(sized.before.runs, 7);

  for (const bad of ["0", "x", "2.5"]) {
    const refused = ask(room, "--size", bad);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, new RegExp(`stats eval: --size takes an integer of 1 or more, not \`${bad.replace(".", "\\.")}\``, "u"));
  }
  const relative = spawnSync(FORGE, ["stats", "eval", "--checkout", "../elsewhere"], {
    encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-eval-home-"), TMPDIR: room },
  });
  assert.equal(relative.status, 1);
  assert.match(relative.stderr, /stats eval: --checkout takes an absolute directory, not `\.\.\/elsewhere`/u);
  const wrong = ask(room, "--sizee", "3");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /No stats eval flag named --sizee/u);
});

/* The mark fires at a multiple of the window, from the corpus, and only there; and it writes the
   reading there once (ISS-478, criteria 1 to 3). */
test("the ship's mark is one line at a multiple of the window, read off the corpus, and silent otherwise", () => {
  const rootOf = (many, room) => {
    const held = corpusOf(many, room);
    process.env.TMPDIR = held;
    return held;
  };
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  process.env.XDG_CONFIG_HOME = tempRoom("stats-eval-marks-");
  try {
    const room = rootOf(50);
    const root = join(room, `claude-${process.getuid()}`, slugFor(PROJECT));
    assert.equal(runsMark(PROJECT),
      "stats: 50 issue-flow runs in this project's corpus — `forge stats eval`. The reading is held as mark 50 (`forge stats eval --against 50`).");
    const [record] = marksOf("runs", root);
    assert.equal(record.kind, "runs");
    assert.equal(record.mark, 50);
    assert.equal(record.root, root);
    assert.ok(Date.parse(record.at) > 0, "the moment it was written");
    const printed = JSON.parse(ask(room, "--json").stdout);
    assert.deepEqual(Object.keys(record), ["kind", "mark", "at", ...Object.keys(printed)], "the object --json prints, under the mark's own three fields");
    /* The profile and the count: the groups and `spanned` name copies, and this process sees the real cache where the spawned verb sees an empty HOME. */
    assert.deepEqual([record.now.runs, record.now.profile], [printed.now.runs, printed.now.profile], "and the same figures");
    const bytes = readFileSync(marksPath());
    assert.equal(runsMark(PROJECT), "stats: 50 issue-flow runs in this project's corpus — `forge stats eval`. Mark 50 was already held, so nothing was written.");
    assert.deepEqual(readFileSync(marksPath()), bytes, "criterion 2: a second landing on the same count appends nothing");

    rootOf(100);
    assert.match(runsMark(PROJECT), /^stats: 100 issue-flow runs .* — `forge stats eval`\. The reading is held as mark 100/u);
    rootOf(51);
    assert.equal(runsMark(PROJECT), null, "criterion 3: fifty-one is no crossing");
    rootOf(49);
    assert.equal(runsMark(PROJECT), null);
    assert.equal(marksOf("runs").length, 2, "and neither wrote");
    assert.equal(runsMark("/fixture/nowhere"), null, "an empty corpus is no crossing");
    assert.equal(tmpdir(), process.env.TMPDIR, "the corpus root follows the temporary directory, so the case read what it wrote");
  } finally {
    Object.assign(process.env, was);
  }
});

/* Criteria 6 to 8, 10, 20 and 22: a reading held at a mark is the before window, through the lines
   the sliding before takes, and the list subject shows what is held. */
test("a stored reading is the before window, and the screen says where the windows overlap", () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-against-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    const empty = askStats(room, ["marks", "--checkout", PROJECT], home);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /^No reading is held for this project yet; the release step writes one at every multiple of fifty runs/u);
    const none = ask(room, "--against");
    assert.equal(none.status, 1);
    assert.match(none.stderr, /stats eval: --against names no reading — none is held for this project yet/u);

    assert.match(runsMark(PROJECT), /held as mark 50/u);
    const [record] = marksOf("runs");
    corpusOf(75, room);
    const pinned = askStats(room, ["eval", "--checkout", PROJECT, "--against", "50"], home);
    assert.equal(pinned.status, 0, pinned.stderr);
    assert.match(pinned.stdout, /^the last 50 issue-flow run\(s\)/u);
    assert.match(pinned.stdout, /^the 50 held at mark 50 {2}.* — overlapping the recent window, which begins before this one ends$/mu);
    assert.match(pinned.stdout, /moved most, in median minutes before → now/u, "the rest of the screen is the sliding one's");

    const json = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--against", "50", "--json"], home).stdout);
    assert.equal(json.against, 50, "criterion 7");
    assert.deepEqual(json.before, record.now, "the stored recent window, byte for byte, as the before");
    assert.equal(json.now.runs, 50);
    assert.deepEqual(Object.keys(json).slice(5, 8), ["size", "total", "against"]);

    const newest = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--against", "--json"], home).stdout);
    assert.equal(newest.against, 50, "criterion 8: bare --against is the newest held");
    const sliding = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--json"], home).stdout);
    assert.equal(sliding.against, undefined, "and without it nothing is pinned");
    assert.equal(sliding.before.runs, 25);

    const missing = askStats(room, ["eval", "--checkout", PROJECT, "--against", "999"], home);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /stats eval: no runs reading at mark 999 for this project\. `forge stats marks` lists what is held\./u);
    /* Over an empty corpus too: the mark asked for is judged before the corpus is (codex F1, this change). */
    const bare = askStats(tempRoom("stats-eval-empty-"), ["eval", "--checkout", PROJECT, "--against", "999"], home);
    assert.equal(bare.status, 1);
    assert.match(bare.stderr, /no runs reading at mark 999 for this project/u);
    const unheld = askStats(tempRoom("stats-eval-empty-"), ["eval", "--checkout", PROJECT, "--against"], tempRoom("stats-eval-home-"));
    assert.equal(unheld.status, 1);
    assert.match(unheld.stderr, /--against names no reading — none is held for this project yet/u);
    const bad = askStats(room, ["eval", "--checkout", PROJECT, "--against", "x"], home);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /--against takes a mark — the count the mark line printed — not `x`/u);

    const listed = askStats(room, ["marks", "--checkout", PROJECT], home);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /^mark {4}50 {2}\d{4}-\d\d-\d\d \d\d:\d\d {3}50 run\(s\) {2}\d{4}-\d\d-\d\d \d\d:\d\d to \d{4}-\d\d-\d\d \d\d:\d\d$/mu, listed.stdout);
    const elsewhere = askStats(room, ["marks", "--checkout", "/fixture/elsewhere"], home);
    assert.match(elsewhere.stdout, /^No reading is held for this project yet/u, "a runs reading is its project's");
    /* The store's own once: the same kind, mark and root twice is one record; and a write that fails
       is said as failed, never as held (codex F3). */
    assert.equal(writeMark(record), "held");
    process.env.XDG_CONFIG_HOME = join(tempRoom("stats-eval-file-"), "a-file");
    writeFileSync(process.env.XDG_CONFIG_HOME, "");
    const cried = [];
    const said = console.error;
    console.error = (line) => cried.push(line);
    try {
      assert.equal(writeMark({ ...record, mark: 51 }), "failed");
    } finally {
      console.error = said;
    }
    assert.match(cried[0], /could not write .*eval-marks\.jsonl .*; this reading is not held\./u);
    process.env.TMPDIR = corpusOf(50);
    console.error = () => {};
    try {
      assert.match(runsMark(PROJECT), /The reading could not be written, so mark 50 is not held\.$/u, "a runs crossing says the write failed, not that the mark was held");
    } finally {
      console.error = said;
    }
  } finally {
    Object.assign(process.env, was);
  }
});

test("the eval subject stands beside runs in the verb's own help", () => {
  const env = { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-eval-home-") };
  const help = spawnSync(FORGE, ["stats", "eval", "-h"], { encoding: "utf8", env });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: forge stats eval/u);
  const wrong = spawnSync(FORGE, ["stats", "consults"], { encoding: "utf8", env });
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /no subject named consults\. There is: runs, eval, marks\./u);
});
