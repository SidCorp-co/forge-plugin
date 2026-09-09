/* The comparison is the profile twice and a difference named; every figure it prints is pinned to
   the profile over the same rows, and the mark to the corpus count, on a corpus small enough to
   count by hand. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WINDOW, evalRuns, evalLines, releaseMark, runsMark, scopeFor } from "../../src/stats/eval.mjs";
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
    /* The line `flow/claim.mjs` prints for an ownership it granted, which is what joins a run to the
       issue it worked; a body merely saying so joins nothing (ISS-821). */
    JSON.stringify({ timestamp: at(start + lasted), message: { role: "user", content: [{ type: "tool_result", tool_use_id: `c${n}`, content: `ISS-${n}  claim: session iss-${n} (agent, pid 1), renewed for 30 minute(s)` }] } }),
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
  assert.deepEqual(held.shifts.map((one) => one.name), ["rung", "spanned"], "copies are compared in the group block alone");
  /* Criterion 18: off the window objects, and what the row tally said. */
  const rowTally = (rows) => tallied(rows, [["rung", (run) => run.rung], ["spanned", (run) => (run.spanned ? "saw a release land" : "one copy throughout")]]);
  const untallied = shiftBetween(rowTally(byEnd.slice(-50).map((run) => ({ ...run, spanned: false }))), rowTally(byEnd.slice(10, 60).map((run) => ({ ...run, spanned: false }))));
  assert.deepEqual(held.shifts, untallied, "the tallies the windows carry give the shifts the rows gave");
});

test("the rows that moved most carry both values and both counts, and a row absent on one side is not a fall", () => {
  const runs = runsOf(110);
  const held = evalRuns(runs, [], WINDOW);
  /* The fixture's tenth run of every ten is the long one on both sides, so the medians match and nothing moves. */
  assert.equal(held.moved.rungs.rose, null);
  assert.equal(held.moved.rungs.fell, null);
  const lines = evalLines(held).join("\n");
  assert.match(lines, /the last 50 issue-flow run\(s\)/u);
  assert.match(lines, /the 50 before them/u);
  assert.match(lines, /rung {3}no row rose on both sides/u);
  assert.match(lines, /copy unrecorded — began before every copy the cache still holds/u);

  /* Shorten the recent window's runs and the row for the runs that named no rung falls, with the
     counts beside it. */
  const cheaper = runs.map((run, n) => (n >= 60 ? { ...run, seconds: run.seconds / 2 } : run));
  const moved = evalRuns(cheaper, [], WINDOW).moved.rungs;
  assert.equal(moved.rose, null);
  assert.equal(moved.fell.row, "unknown");
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
  assert.deepEqual(Object.keys(held),
    ["root", "project", "skipped", "unreadable", "copies", "requests", "size", "total", "now", "before", "moved", "shifts"]);
  assert.deepEqual(Object.keys(held.now), ["runs", "spanned", "profile", "groups", "outcomes"],
    "criterion 15: the window carries spanned, and ISS-821's outcomes beside the cost");
  /* No credential resolves in this room, so every tracker read is refused and every outcome figure
     says so — which is the shape a reader must be able to tell from a window that read and found
     nothing (ISS-821). */
  assert.equal(held.requests, 0, "a refused reading spends none of the budget");
  for (const figure of held.now.outcomes.figures) {
    assert.equal(figure.count, null, `${figure.name} is unavailable, not zero`);
    assert.equal(figure.over, 0);
  }
  assert.equal(held.now.outcomes.pairs, 50, "the pairs are the transcripts' and need no tracker");
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
    /* Every key of the printed object but the two the tracker read adds: a mark is written with the
       cost figures alone, because the ship must not spend a hundred tracker requests per release
       and one written where no credential resolves would take the release down with it (ISS-821). */
    const costOnly = Object.keys(printed).filter((one) => one !== "requests");
    assert.deepEqual(Object.keys(record), ["kind", "mark", "at", ...costOnly],
      "the object --json prints less its tracker read, under the mark's own three fields");
    assert.equal(record.now.outcomes, undefined, "a stored reading carries no outcome figure rather than zeroes");
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
    assert.match(empty.stdout, /^No reading is held for this project yet; the release step writes one at every multiple of fifty runs in the corpus, and the release step writes one at every release\./u);
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
    assert.equal(json.before.outcomes, undefined, "which is why the before side of a pinned comparison has no outcome figure");
    assert.equal(json.now.runs, 50);
    assert.deepEqual(Object.keys(json).slice(5, 9), ["requests", "size", "total", "against"]);

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

/* Every mark on a device predating this change holds its rung rows under the retired key, with the
   runs that named none under the retired word. Read as they stand, a comparison against one reports
   every rung as newly arrived and the whole shift block moves (ISS-822). */
test("a reading held before the rung had one word is read as the canonical one", () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-retired-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(runsMark(PROJECT), /held as mark 50/u);
    const [record] = marksOf("runs");
    const retire = (rows) => rows.map(({ rung, ...row }) =>
      ({ tier: rung === "unknown" ? "untiered" : rung, ...row }));
    const { rungs, ...profile } = record.now.profile;
    const groups = record.now.groups.map(({ profile: held, ...group }) => {
      const { rungs: rows, ...rest } = held;
      return { ...group, profile: { ...rest, tiers: retire(rows) } };
    });
    writeFileSync(marksPath(), `${JSON.stringify({
      ...record, now: { ...record.now, profile: { ...profile, tiers: retire(rungs) }, groups },
    })}\n`);
    corpusOf(75, room);
    const held = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--against", "50", "--json"], home).stdout);
    assert.equal(held.before.profile.tiers, undefined, "the retired key is not carried forward");
    assert.deepEqual(held.before.profile.rungs.map((row) => row.rung), rungs.map((row) => row.rung),
      "the rows are the ones the reading held, under the canonical key and the canonical name");
    const shift = held.shifts.find((one) => one.name === "rung");
    assert.deepEqual(shift.values.map((one) => one.value).filter((one) => one === "untiered"), [],
      "so no row arrives out of the rename, which would read as every run changing rung at once");
    assert.deepEqual(shift.values.find((one) => one.value === "unknown"), { value: "unknown", now: 50, before: 50 });
    assert.equal(/\b(?:tiers?|untiered)\b/u.test(JSON.stringify(held.before)), false,
      "and no group of the stored window prints the retired spelling, which `--json` prints whole");
    assert.deepEqual(held.before.groups.map((one) => one.profile.rungs),
      record.now.groups.map((one) => one.profile.rungs),
      "each group's rows and every measurement on them as the reading held them");
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

/* Attribution by copy answers which copy was installed, never which change did it: on 2026-09-09 the
   recent window held sixteen copies with one to eight runs each. So a release is marked in its own
   right, and what a comparison since one cannot hold apart is printed rather than removed (ISS-821). */
test("a release mark carries its version and head, resolves apart from a count mark at one corpus count, and names what the comparison since it is confounded by", () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-release-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    const root = join(room, `claude-${process.getuid()}`, slugFor(PROJECT));

    assert.match(releaseMark(PROJECT, { version: "3.35.300", head: "abc1234" }),
      /^stats: this release is held as 3\.35\.300 over 50 run\(s\) \(`forge stats eval --since-release 3\.35\.300`\)\./u);
    const [held] = marksOf("releases", root);
    assert.equal(held.kind, "releases");
    assert.equal(held.version, "3.35.300");
    assert.equal(held.head, "abc1234");
    assert.equal(held.mark, 50, "the corpus count it was taken at");
    assert.equal(held.now.outcomes, undefined, "a mark is the cost figures alone");

    /* The count mark at the same corpus count: two records at one count, neither resolving the other. */
    assert.match(runsMark(PROJECT), /held as mark 50/u);
    assert.equal(marksOf("runs", root).length, 1);
    assert.equal(marksOf("releases", root).length, 1, "one count, two kinds, no collision");

    assert.equal(releaseMark(PROJECT, { version: "3.35.300", head: "abc1234" }),
      "stats: this release is held as 3.35.300 over 50 run(s) (`forge stats eval --since-release 3.35.300`). "
      + "Version 3.35.300 was already held, so nothing was written.");
    assert.equal(releaseMark(PROJECT, { version: null, head: "abc1234" }), null, "no version is no mark");
    assert.equal(releaseMark("/fixture/nowhere", { version: "3.35.301", head: "d" }), null, "and no corpus is none either");

    const listed = askStats(room, ["marks", "--checkout", PROJECT], home);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /^mark {4}50 {2}\S+ \S+ {2}release 3\.35\.300 at abc1234 {3}50 run\(s\)/mu,
      "the release mark lists its version and its head");
    assert.match(listed.stdout, /^mark {4}50 {2}\S+ \S+ +50 run\(s\)/mu, "beside the count mark at the same count");

    corpusOf(75, room);
    const since = askStats(room, ["eval", "--checkout", PROJECT, "--since-release", "3.35.300"], home);
    assert.equal(since.status, 0, since.stderr);
    assert.match(since.stdout, /^the 50 held at release 3\.35\.300 {2}/mu, "the release names itself where a count mark names its count");
    assert.match(since.stdout, /^what a comparison since 3\.35\.300 is confounded by$/mu);
    assert.match(since.stdout, /^ {2}\d+ release\(s\) landed after it inside this window$/mu);
    assert.match(since.stdout, /^ {2}\d+ run\(s\) saw a release land while they ran/mu);
    assert.match(since.stdout, /a dispatching session may still have held a role, a skill stub or a hook registration/u);

    const newest = askStats(room, ["eval", "--checkout", PROJECT, "--since-release"], home);
    assert.equal(newest.status, 0, newest.stderr);
    assert.match(newest.stdout, /held at release 3\.35\.300/u, "bare --since-release is the newest held");

    const missing = askStats(room, ["eval", "--checkout", PROJECT, "--since-release", "9.9.9"], home);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /stats eval: no release reading for version 9\.9\.9 on this project\. `forge stats marks` lists what is held\./u);
    const unheld = askStats(room, ["eval", "--checkout", PROJECT, "--since-release"], tempRoom("stats-eval-home-"));
    assert.equal(unheld.status, 1);
    assert.match(unheld.stderr, /--since-release names no reading — none is held for this project yet/u);

    /* Two releases at one corpus count, which a count-keyed store discards the second of: the
       version is a release's identity and `--since-release` has nothing else to resolve by. */
    assert.match(releaseMark(PROJECT, { version: "3.35.400", head: "aaa1111" }), /held as 3\.35\.400 over 75 run\(s\)/u);
    assert.match(releaseMark(PROJECT, { version: "3.35.401", head: "bbb2222" }), /held as 3\.35\.401 over 75 run\(s\)/u);
    assert.equal(marksOf("releases", root).filter((one) => one.mark === 75).length, 2, "both are held at one count");
    assert.equal(releaseMark(PROJECT, { version: "3.35.400", head: "aaa1111" }),
      "stats: this release is held as 3.35.400 over 75 run(s) (`forge stats eval --since-release 3.35.400`). "
      + "Version 3.35.400 was already held, so nothing was written.", "and rewriting either writes nothing twice");
    for (const version of ["3.35.400", "3.35.401"]) {
      const read = askStats(room, ["eval", "--checkout", PROJECT, "--since-release", version], home);
      assert.equal(read.status, 0, read.stderr);
      assert.match(read.stdout, new RegExp(`held at release ${version.replaceAll(".", "\\.")}`, "u"),
        "each version resolves to its own reading");
    }
  } finally {
    Object.assign(process.env, was);
  }
});

/* A reading is held at one point and every line answers for that point. Given both flags the verb
   took the count mark's window and printed the release's name over it, and counted the releases
   inside it from the release the header named rather than from the window the figures came from — so
   the disclosure that says what a reading cannot attribute misstated instead of omitting (ISS-849). */
test("two anchors are refused with both of them named, and either flag alone answers as it did", () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-anchor-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(runsMark(PROJECT), /held as mark 50/u);
    corpusOf(75, room);
    assert.match(releaseMark(PROJECT, { version: "3.35.500", head: "cafe123" }), /held as 3\.35\.500 over 75 run\(s\)/u);
    corpusOf(100, room);

    /* Two marks holding two windows, which is what makes a window labelled with the other's source
       visible in the span the header prints beside the name. */
    const spanOf = (said, named) => new RegExp(`^the 50 held at ${named} {2}(\\S+ \\S+ to \\S+ \\S+)`, "mu").exec(said)?.[1];
    const mark = askStats(room, ["eval", "--checkout", PROJECT, "--against", "50"], home);
    assert.equal(mark.status, 0, mark.stderr);
    const since = askStats(room, ["eval", "--checkout", PROJECT, "--since-release", "3.35.500"], home);
    assert.equal(since.status, 0, since.stderr);
    const marked = spanOf(mark.stdout, "mark 50");
    const released = spanOf(since.stdout, "release 3\\.35\\.500");
    assert.ok(marked && released, `both headers name their own anchor: ${marked} / ${released}`);
    assert.notEqual(marked, released, "and each over its own window");
    assert.match(since.stdout, /^what a comparison since 3\.35\.500 is confounded by$/mu);
    assert.doesNotMatch(mark.stdout, /confounded by/u, "a count mark keeps the screen it has always had");

    const argv = ["eval", "--checkout", PROJECT, "--against", "50", "--since-release", "3.35.500"];
    const both = askStats(room, argv, home);
    assert.equal(both.status, 1);
    assert.equal(both.stdout, "", "no window, no header and no confounding line");
    assert.match(both.stderr, /^stats eval: --against 50 and --since-release 3\.35\.500 name two anchors, and a reading has one/u);
    assert.match(both.stderr, /Run one alone: `forge stats eval --against 50` for the reading held at a count mark, or `forge stats eval --since-release 3\.35\.500` for the one held at a release\./u);
    assert.equal(askStats(room, argv, home).stderr, both.stderr, "and the same call is refused the same way twice");

    const bare = askStats(room, ["eval", "--checkout", PROJECT, "--against", "--since-release"], home);
    assert.equal(bare.status, 1);
    assert.match(bare.stderr, /^stats eval: --against and --since-release name two anchors/u,
      "the flags are named where no anchor was typed to name");
  } finally {
    Object.assign(process.env, was);
  }
});

/* The construction rather than the call: one anchor argument, so the header and the confounding lines
   cannot be handed two. Flipping the one object's kind moves both together (ISS-849). */
test("the header and the confounding lines are read off one anchor", () => {
  const runs = runsOf(110);
  const copies = [
    { copy: "3.35.500", at: Date.parse(at(70 * HOUR)), born: true },
    { copy: "3.35.600", at: Date.parse(at(400 * HOUR)), born: true },
  ];
  const stored = evalRuns(runs.slice(0, 60), [], WINDOW);
  const anchor = { kind: "releases", mark: 60, version: "3.35.400", at: at(60 * HOUR), now: stored.now };
  const lines = evalLines(evalRuns(runs, copies, WINDOW, anchor), anchor, copies).join("\n");
  assert.match(lines, /^the 50 held at release 3\.35\.400 {2}/mu);
  assert.match(lines, /^what a comparison since 3\.35\.400 is confounded by$/mu);
  assert.match(lines, /^ {2}1 release\(s\) landed after it inside this window$/mu,
    "counted from the anchor the header named, over the window that anchor's reading gave");

  const counted = { ...anchor, kind: "runs" };
  const said = evalLines(evalRuns(runs, copies, WINDOW, counted), counted, copies).join("\n");
  assert.match(said, /^the 50 held at mark 60 {2}/mu, "the same reading held at a count says so");
  assert.doesNotMatch(said, /confounded by/u, "and carries no disclosure anchored at a release it was not read against");
});

test("each outcome figure discloses both windows' coverage, and says which window every reason is about", () => {
  const runs = runsOf(4);
  const [older, second] = runs;
  const threads = new Map([
    ["ISS-0", { unread: "the tracker refused" }],
    ["ISS-1", { records: [{ kind: "finding", at: second.endedAt + 3 * 86_400_000, fields: {} }] }],
    ["ISS-2", { records: [] }],
    ["ISS-3", { records: [] }],
  ]);
  assert.equal(older.issues[0], "ISS-0", "the fixture's runs own one issue each, oldest first");

  const read = { threads, ruled: new Map(), parks: { owned: new Map(), loose: new Map() }, horizon: 86_400_000, now: Date.now() };
  const lines = evalLines(evalRuns(runs, [], 2, null, read)).join("\n");
  assert.match(lines, /reopened .*0\/1 pair\(s\).*→.*0\/2 pair\(s\)/u, "both windows print their own fraction");
  assert.match(lines, /before 1 later than the horizon, counted apart/u,
    "a note about the before window says so rather than reading as the recent one's");
  assert.match(lines, /1 pair\(s\) unread before: the tracker refused/u,
    "and the before window's own coverage loss is printed, not only the recent window's");
});

test("the tracker read of a named checkout is scoped to the project that checkout declares, not the shell's", () => {
  const elsewhere = tempRoom("stats-eval-other-");
  writeFileSync(join(elsewhere, ".forge.json"), JSON.stringify({ slug: "another-project" }));
  const nested = join(elsewhere, "src", "deep");
  mkdirSync(nested, { recursive: true });

  const aimed = scopeFor(nested);
  assert.equal(aimed.slug, "another-project", "the checkout's own project file decides, from anywhere under it");
  assert.match(aimed.from, /the project file under /u, "and the reading says where that came from");

  const quiet = tempRoom("stats-eval-none-");
  assert.equal(scopeFor(quiet), null, "a checkout declaring no project contradicts nothing, so nothing is aimed");
  assert.equal(scopeFor(process.cwd()), null, "and a checkout that is this project's own aims nowhere either");
});

/* Under three runs a median is one run's accident wearing a statistic (ISS-821). */
test("a window under the floor prints insufficient evidence, and a copy's thin side prints its count and no median", () => {
  const room = corpusOf(4);
  const held = ask(room, "--size", "2");
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.stdout, /^ {2}now +2 run\(s\) {2}.* {2}insufficient evidence: fewer than the floor of 3 runs, so no median$/mu);
  assert.match(held.stdout, /^ {2}before +2 run\(s\) {2}.* {2}insufficient evidence: fewer than the floor of 3 runs, so no median$/mu);

  const wide = ask(room, "--size", "3");
  assert.equal(wide.status, 0, wide.stderr);
  assert.match(wide.stdout, /median \d+(\.\d+)? min/u, "at the floor the median prints");
});
