/* The comparison is the profile twice and a difference named; every figure it prints is pinned to
   the profile over the same rows, on a corpus small enough to count by hand. The mark it writes and
   the anchors that read one back are `marks.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { WINDOW, evalRuns, evalLines } from "../../src/stats/eval/eval.mjs";
import { scopeFor } from "../../src/stats/corpus/release.mjs";
import { profileOf } from "../../src/stats/runs.mjs";
import { slugFor } from "../../src/stats/corpus/corpus.mjs";
import { UNRECORDED, copyAt, installedCopies, servedCopies, spansInstall } from "../../src/stats/versions.mjs";
import { shiftBetween, tallied, twoWindows } from "../../src/stats/windows.mjs";
import { evalObject, evalWindows } from "../../src/codex/codex-stats.mjs";
import { SAYS } from "../../src/stats/stats.mjs";
import { scopeOf, writeMark } from "../../src/stats/marks/marks.mjs";
import { escaped, projectRoom, tempRoom } from "../fixtures.mjs";
import { BASE, FORGE, HOUR, PROJECT, ask, askStats, at, corpusOf, runsOf } from "./fixture-eval.mjs";

/* The mark writes a reading under the config directory, so the process's own is moved first. */
process.env.XDG_CONFIG_HOME = tempRoom("stats-eval-home-");

const CODEX_STATS = new URL("../../src/codex/codex-stats.mjs", import.meta.url).pathname;

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

/* ISS-2031: the cache root is machine-wide, so the copies a rate is taken against are the ones a run of this corpus began under. */
test("the copies that served a run count each once, and leave out a copy no run began under and a run older than every copy", () => {
  const copies = [{ copy: "1.0.0", at: 100, born: true }, { copy: "1.1.0", at: 200, born: true }, { copy: "1.2.0", at: 300, born: true }];
  const runs = [{ startedAt: 50 }, { startedAt: 150 }, { startedAt: 160 }, { startedAt: 310 }];
  assert.equal(servedCopies(copies, runs), 2, "1.0.0 twice and 1.2.0 once; 1.1.0 served none, and the run at 50 is unrecorded");
  assert.equal(servedCopies(copies, [{ startedAt: 50 }]), 0, "a run older than every copy is no copy served");
  assert.equal(servedCopies([], runs), 0);
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

/* The window lines report what was selected and leave the reader to decide whether it was evidence,
   and a corpus swept an hour ago reports exactly what a young project's does. The judgement is the
   line a reader acts on; it fires on either window falling short, the shortfall having been the case
   nobody read for twenty releases (ISS-1328, criteria 1 and 4). */
test("fewer than two full windows is said as a shortfall, and judged not a comparison", () => {
  const short = ask(corpusOf(70));
  assert.equal(short.status, 0, short.stderr);
  assert.match(short.stdout, /the 20 before them .* — short of a full 50 by 30/u, short.stdout);
  assert.match(short.stdout,
    /not a comparison: the window before it holds 20 of 50, over a corpus holding 70 run\(s\) in all\./u,
    short.stdout);

  const few = ask(corpusOf(50));
  assert.equal(few.status, 0, few.stderr);
  assert.match(few.stdout, /no window before them: the corpus holds 50 run\(s\) in all\./u, few.stdout);
  assert.match(few.stdout,
    /not a comparison: there is no window before it, over a corpus holding 50 run\(s\) in all\./u, few.stdout);
  assert.doesNotMatch(few.stdout, /nothing yet to compare/u,
    "which asserted a young corpus in the one case where a swept one is indistinguishable");

  const both = ask(corpusOf(100));
  assert.equal(both.status, 0, both.stderr);
  assert.doesNotMatch(both.stdout, /not a comparison/u, "two full windows are a comparison and are not judged one");
  assert.doesNotMatch(both.stdout, /the corpus reaches back to/u, "and owe no account of what bounded them");

  const none = ask(tempRoom("stats-eval-empty-"));
  assert.equal(none.status, 0, none.stderr);
  assert.match(none.stdout, /No issue-flow run under .*-fixture-project, so there is nothing to compare/u);
});

/* This project's corpus fell from 70 runs to 2 inside ninety minutes on 2026-09-12, and the eighteen
   releases marked after it each reported a short window as a clean reading. A young corpus and a
   swept one print the same counts; a reading held when the store was deeper is the only thing here
   that separates them, and the marks had been recording that reach all along (ISS-1328, criteria 2,
   3 and 5). Plant the shallow corpus, watch the sentence change when the mark arrives. */
test("a reading held deeper than the corpus reaches is what tells a swept corpus from a young one", () => {
  const home = tempRoom("stats-eval-reach-");
  const room = corpusOf(9);
  const root = join(room, `claude-${process.getuid()}`, slugFor(PROJECT));

  const silent = askStats(room, ["eval", "--checkout", PROJECT], home);
  assert.equal(silent.status, 0, silent.stderr);
  assert.match(silent.stdout, /the corpus reaches back to 2026-09-01 00:00; no reading held for this project/u, silent.stdout);
  assert.match(silent.stdout, /which is not to say the corpus was never deeper — a mark is a snapshot and not a history/u,
    "the record's silence is silence, never evidence the depth was never there");

  const was = process.env.XDG_CONFIG_HOME;
  try {
    process.env.XDG_CONFIG_HOME = home;
    writeMark({ kind: "releases", mark: 70, version: "3.35.339", head: null, at: at(0), root, scope: scopeOf(PROJECT),
      now: { runs: 50, profile: { from: BASE - 48 * HOUR * 1000, to: BASE } } });
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }

  const said = askStats(room, ["eval", "--checkout", PROJECT], home);
  assert.equal(said.status, 0, said.stderr);
  assert.match(said.stdout,
    /the corpus reaches back to 2026-09-01 00:00; release 3\.35\.339's reading reached back to 2026-08-30 00:00, so depth this project once read is no longer here\./u,
    said.stdout);

  /* A mark taken over a deep corpus records a LATE floor in its window — the recent fifty begin long
     after the corpus does — so the reading's own corpus reach is the field carrying the depth, and a
     reader going by the window floor alone sees none of it (consult c5d393 F1). */
  try {
    process.env.XDG_CONFIG_HOME = home;
    writeMark({ kind: "runs", mark: 100, at: at(0), root, scope: scopeOf(PROJECT),
      now: { runs: 50, profile: { from: BASE + 50 * HOUR * 1000, to: BASE + 99 * HOUR * 1000 } },
      comparability: { comparable: true, short: [], reach: { from: BASE - 200 * HOUR * 1000, earlier: null } } });
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
  const deeper = askStats(room, ["eval", "--checkout", PROJECT], home);
  assert.match(deeper.stdout, /mark 100's reading reached back to 2026-08-23 16:00/u,
    `${deeper.stdout}\nthe window floor of that mark is later than the corpus reaches now, and only its own reach carries the depth`);

  const held = JSON.parse(askStats(room, ["eval", "--checkout", PROJECT, "--json"], home).stdout);
  assert.equal(held.comparability.comparable, false);
  assert.deepEqual(held.comparability.short,
    ["the recent window holds 9 of 50", "there is no window before it"]);
  assert.equal(held.comparability.reach.earlier.by, "mark 100",
    "criterion 5: the judgement is a field of the reading, so a mark can be read back for it");
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
  assert.equal(held.served, 0);
  assert.deepEqual(Object.keys(held),
    ["root", "scope", "sources", "project", "device", "contract", "skipped", "unreadable", "copies",
      "served", "populations", "requests", "size", "total", "now",
      "before", "comparability", "moved", "classes", "shifts", "angles", "notMeasured"]);
  assert.deepEqual(Object.keys(held.populations), ["total", "copies", "served"],
    "ISS-2031: every count at the top of the reading names what it was counted over");
  assert.match(held.populations.total, /this project's admitted issue-flow run/u);
  assert.match(held.populations.copies, /this machine's plugin cache root, whichever project each served/u);
  assert.match(held.populations.served, /at least one of this project's admitted runs began under/u);
  assert.deepEqual(held.comparability,
    { comparable: true, short: [], reach: { from: BASE, earlier: null } },
    "two full windows: the judgement is on the record either way, and the reach is the corpus's own floor, not the window's");
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
    assert.match(refused.stderr, new RegExp(`stats eval: --size takes an integer of 1 or more, not \`${escaped(bad)}\``, "u"));
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

test("the eval subject stands beside runs in the verb's own help", () => {
  const env = { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-eval-home-") };
  const help = spawnSync(FORGE, ["stats", "eval", "-h"], { encoding: "utf8", env });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: forge stats eval/u);
  const wrong = spawnSync(FORGE, ["stats", "consults"], { encoding: "utf8", env });
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, new RegExp(`no subject named consults\\. There is: ${Object.keys(SAYS).join(", ")}\\.`, "u"));
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
  const elsewhere = projectRoom(tempRoom("stats-eval-other-"), process.env.XDG_CONFIG_HOME,
    { slug: "another-project" });
  const nested = join(elsewhere, "src", "deep");
  mkdirSync(nested, { recursive: true });

  const aimed = scopeFor(nested);
  assert.equal(aimed.slug, "another-project",
    "this machine's record of that checkout's project decides, from anywhere under it");
  assert.match(aimed.from, /the project file under /u, "and the reading says where that came from");

  const quiet = tempRoom("stats-eval-none-");
  assert.equal(scopeFor(quiet), null, "a directory declaring no project contradicts nothing, so nothing is aimed");
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
