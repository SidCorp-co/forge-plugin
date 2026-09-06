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
import { profileOf, runsUnder } from "../../src/stats/runs.mjs";
import { slugFor } from "../../src/stats/transcripts.mjs";
import { UNRECORDED, copyAt, installedCopies, spansInstall } from "../../src/stats/versions.mjs";
import { shiftBetween, twoWindows } from "../../src/stats/windows.mjs";
import { changedBetween, evalWindows } from "../../src/codex/codex-stats.mjs";
import { tempRoom } from "../fixtures.mjs";

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

const ask = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "eval", "--project", PROJECT, ...argv], {
    encoding: "utf8",
    /* HOME points at an empty room, so no install record answers and every run is unrecorded. */
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-eval-home-"), TMPDIR: room, HOME: tempRoom("stats-eval-user-") },
  });

const runsOf = (many) => runsUnder(join(corpusOf(many), `claude-${process.getuid()}`, slugFor(PROJECT)), null).runs;

test("two windows are the last N and the N before them, adjacent, and a short list gives a short before", () => {
  const rows = Array.from({ length: 7 }, (_, n) => n);
  assert.deepEqual(twoWindows(rows, 3), { now: [4, 5, 6], before: [1, 2, 3] });
  assert.deepEqual(twoWindows(rows, 5), { now: [2, 3, 4, 5, 6], before: [0, 1] }, "before is what the list holds, not padded");
  assert.deepEqual(twoWindows([1, 2], 3), { now: [1, 2], before: [] });
  const shifted = shiftBetween([{ k: "a" }, { k: "a" }], [{ k: "b" }], [["k", (row) => row.k]]);
  assert.deepEqual(shifted, [{ name: "k", values: [{ value: "a", now: 2, before: 0 }, { value: "b", now: 0, before: 1 }] }]);
});

/* Criterion 17: the codex eval and the runs eval split and tally through one pair of functions. */
test("the codex eval's split and tally are the shared functions, not a second copy", () => {
  const source = readFileSync(CODEX_STATS, "utf8");
  assert.match(source, /from "\.\.\/stats\/windows\.mjs"/u, "codex-stats imports the shared module");
  assert.doesNotMatch(source, /slice\(-size\)/u, "and keeps no split of its own");
  const rows = Array.from({ length: 250 }, (_, n) => ({ kind: "consult", ok: true, reply: "x", at: at(n), id: `w${n}`, slot: n < 150 ? "a" : "b" }));
  const { now, before } = evalWindows(rows);
  assert.deepEqual({ now, before }, twoWindows(rows, 100));
  assert.deepEqual(changedBetween(now, before)[0].values, [{ value: "b", now: 100, before: 0 }, { value: "a", now: 0, before: 100 }]);
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
  /* Nothing a reader can derive, and no dimension that re-tallies the group block (ISS-492). */
  assert.deepEqual(Object.keys(held.now).sort(), ["groups", "profile", "runs"]);
  assert.deepEqual(Object.keys(held.before).sort(), ["groups", "profile", "runs"]);
  assert.deepEqual(held.shifts.map((one) => one.name), ["tier", "spanned"], "copies are compared in the group block alone");
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
  assert.ok(held.now.profile.from <= held.now.profile.to, "the bounds are the profile's, not a second copy on the window");

  const sized = JSON.parse(ask(room, "--size", "7", "--json").stdout);
  assert.equal(sized.now.runs, 7);
  assert.equal(sized.before.runs, 7);

  for (const bad of ["0", "x", "2.5"]) {
    const refused = ask(room, "--size", bad);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, new RegExp(`stats eval: --size takes an integer of 1 or more, not \`${bad.replace(".", "\\.")}\``, "u"));
  }
  const relative = spawnSync(FORGE, ["stats", "eval", "--project", "../elsewhere"], {
    encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-eval-home-"), TMPDIR: room },
  });
  assert.equal(relative.status, 1);
  assert.match(relative.stderr, /stats eval: --project takes an absolute project directory, not `\.\.\/elsewhere`/u);
  const wrong = ask(room, "--sizee", "3");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /No stats eval flag named --sizee/u);
});

/* Criteria 14 to 16: the mark fires at a multiple of the window, from the corpus, and only there. */
test("the ship's mark is one line at a multiple of the window, read off the corpus, and silent otherwise", () => {
  const rootOf = (many) => {
    const room = corpusOf(many);
    process.env.TMPDIR = room;
    return room;
  };
  const was = process.env.TMPDIR;
  try {
    rootOf(50);
    assert.equal(runsMark(PROJECT), "stats: 50 issue-flow runs in this project's corpus — `forge stats eval`.");
    rootOf(100);
    assert.match(runsMark(PROJECT), /^stats: 100 issue-flow runs .* — `forge stats eval`\.$/u);
    rootOf(51);
    assert.equal(runsMark(PROJECT), null);
    rootOf(49);
    assert.equal(runsMark(PROJECT), null);
    assert.equal(runsMark("/fixture/nowhere"), null, "an empty corpus is no crossing");
    assert.equal(tmpdir(), process.env.TMPDIR, "the corpus root follows the temporary directory, so the case read what it wrote");
  } finally {
    process.env.TMPDIR = was;
  }
});

test("the eval subject stands beside runs in the verb's own help", () => {
  const env = { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-eval-home-") };
  const help = spawnSync(FORGE, ["stats", "eval", "-h"], { encoding: "utf8", env });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: forge stats eval/u);
  const wrong = spawnSync(FORGE, ["stats", "consults"], { encoding: "utf8", env });
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /no subject named consults\. There is: runs, eval\./u);
});
