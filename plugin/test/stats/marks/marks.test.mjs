/* A reading is held at one point and read back as the before window. The comparison those windows are
   put through is `eval.test.mjs`; what is pinned here is which reading answers, once. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NO_WINDOW_BEFORE, WINDOW, evalLines, evalRuns, releaseMark, runsMark } from "../../../src/stats/eval/eval.mjs";
import { marksOf, marksPath, scopeOf, writeMark } from "../../../src/stats/marks/marks.mjs";
import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { escaped, tempRoom } from "../../fixtures.mjs";
import { HOUR, PROJECT, ask, askStats, at, corpusOf, runsOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-eval-marks-home-");

/* The mark fires at a multiple of the window, from the corpus, and only there; and it writes the
   reading there once (ISS-478, criteria 1 to 3). */
test("the ship's mark is one line at a multiple of the window, read off the corpus, and silent otherwise", async () => {
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
    assert.equal(await runsMark(PROJECT),
      "stats: 50 issue-flow runs in this project's corpus — `forge stats eval`. The reading is held as mark 50 (`forge stats eval --against 50`).");
    const [record] = marksOf("runs", scopeOf(PROJECT));
    assert.equal(record.kind, "runs");
    assert.equal(record.mark, 50);
    assert.equal(record.root, root, "where the corpus was read is still recorded");
    assert.equal(record.scope, scopeOf(PROJECT), "and the scope is what it is held under");
    assert.ok(Date.parse(record.at) > 0, "the moment it was written");
    const printed = JSON.parse(ask(room, "--json").stdout);
    /* Every key of the printed object but the one the tracker read adds and the two the screen judges
       with: a mark is written with the cost figures alone, because the ship must not spend a hundred
       tracker requests per release and one written where no credential resolves would take the
       release down with it (ISS-821) — and an angle stored would have the ship spend a floor over the
       whole corpus as well, for a verdict nobody is reading at that moment (ISS-1987). What those
       angles do not measure travels with them and is stored no more than they are (ISS-1996). */
    const JUDGED = ["requests", "angles", "notMeasured"];
    /* And the two the store does not keep: nothing reads a stored `before` or a stored `classes`,
       so a record that carried them would be half a file nobody opens (ISS-1984, ISS-2106). */
    const UNREAD = ["before", "classes"];
    const costOnly = Object.keys(printed).filter((one) => ![...JUDGED, ...UNREAD].includes(one));
    assert.deepEqual(Object.keys(record), ["kind", "mark", "at", ...costOnly],
      "the object --json prints less its tracker read and less what no reader of a stored reading reads");
    assert.equal(record.before, undefined, "criterion 16: the store keeps no before window of its own");
    assert.equal(record.classes, undefined, "nor its class table");
    assert.ok("before" in printed && "classes" in printed, "criterion 16: while the eval's own JSON keeps both");
    assert.equal(record.now.outcomes, undefined, "a stored reading carries no outcome figure rather than zeroes");
    assert.deepEqual(record.comparability, { comparable: false, short: [NO_WINDOW_BEFORE],
      reach: { from: Date.parse("2026-09-01T00:00:00.000Z"), earlier: null } },
      "criterion 6: the mark carries whether its reading was comparable, so what /tmp held that day need not be recomputed");
    /* The profile and the count: the groups and `spanned` name copies, and this process sees the real cache where the spawned verb sees an empty HOME. */
    assert.deepEqual([record.now.runs, record.now.profile], [printed.now.runs, printed.now.profile], "and the same figures");
    const bytes = readFileSync(marksPath());
    assert.equal(await runsMark(PROJECT), null,
      "criterion 1: a crossing the last reading held already covers is no crossing, so the second landing says nothing");
    assert.deepEqual(readFileSync(marksPath()), bytes, "and appends nothing");

    rootOf(100);
    assert.match(await runsMark(PROJECT), /^stats: 100 issue-flow runs .* — `forge stats eval`\. The reading is held as mark 100/u);
    rootOf(51);
    assert.equal(await runsMark(PROJECT), null, "criterion 3: one past a crossing already held is no crossing");
    rootOf(49);
    assert.equal(await runsMark(PROJECT), null);
    assert.equal(marksOf("runs").length, 2, "and neither wrote");
    assert.equal(await runsMark("/fixture/nowhere"), null, "an empty corpus is no crossing");
    assert.equal(tmpdir(), process.env.TMPDIR, "the corpus root follows the temporary directory, so the case read what it wrote");
  } finally {
    Object.assign(process.env, was);
  }
});

/* Criteria 6 to 8, 10, 20 and 22: a reading held at a mark is the before window, through the lines
   the sliding before takes, and the list subject shows what is held. */
test("a stored reading is the before window, and the screen says where the windows overlap", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-against-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    const empty = askStats(room, ["marks", "--checkout", PROJECT], home);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /^No reading is held for this project yet; one is written when this project's corpus reaches a multiple of fifty runs, by this verb or by a release, and the release step writes one at every release\./u);
    const none = ask(room, "--against");
    assert.equal(none.status, 1);
    assert.match(none.stderr, /stats eval: --against names no reading — none is held for this project yet/u);

    assert.match(await runsMark(PROJECT), /held as mark 50/u);
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
    assert.deepEqual(Object.keys(json).slice(9, 13), ["requests", "size", "total", "against"]);

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
      assert.match(await runsMark(PROJECT), /The reading could not be written, so mark 50 is not held\.$/u, "a runs crossing says the write failed, not that the mark was held");
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
test("a reading held before the rung had one word is read as the canonical one", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-retired-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
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

/* Attribution by copy answers which copy was installed, never which change did it: on 2026-09-09 the
   recent window held sixteen copies with one to eight runs each. So a release is marked in its own
   right, and what a comparison since one cannot hold apart is printed rather than removed (ISS-821). */
test("a release mark carries its version and head, resolves apart from a count mark at one corpus count, and names what the comparison since it is confounded by", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-release-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;

    assert.match(await releaseMark(PROJECT, { version: "3.35.300", head: "abc1234" }),
      /^stats: this release is held as 3\.35\.300 over 50 run\(s\) \(`forge stats eval --since-release 3\.35\.300`\)\./u);
    const [held] = marksOf("releases", scopeOf(PROJECT));
    assert.equal(held.kind, "releases");
    assert.equal(held.version, "3.35.300");
    assert.equal(held.head, "abc1234");
    assert.equal(held.mark, 50, "the corpus count it was taken at");
    assert.equal(held.now.outcomes, undefined, "a mark is the cost figures alone");

    /* The count mark at the same corpus count: two records at one count, neither resolving the other. */
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    assert.equal(marksOf("runs", scopeOf(PROJECT)).length, 1);
    assert.equal(marksOf("releases", scopeOf(PROJECT)).length, 1, "one count, two kinds, no collision");

    assert.equal(await releaseMark(PROJECT, { version: "3.35.300", head: "abc1234" }),
      "stats: this release is held as 3.35.300 over 50 run(s) (`forge stats eval --since-release 3.35.300`). "
      + "Version 3.35.300 was already held, so nothing was written.");
    assert.equal(await releaseMark(PROJECT, { version: null, head: "abc1234" }), null, "no version is no mark");
    assert.equal(await releaseMark("/fixture/nowhere", { version: "3.35.301", head: "d" }), null, "and no corpus is none either");

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
    assert.match(await releaseMark(PROJECT, { version: "3.35.400", head: "aaa1111" }), /held as 3\.35\.400 over 75 run\(s\)/u);
    assert.match(await releaseMark(PROJECT, { version: "3.35.401", head: "bbb2222" }), /held as 3\.35\.401 over 75 run\(s\)/u);
    assert.equal(marksOf("releases", scopeOf(PROJECT)).filter((one) => one.mark === 75).length, 2, "both are held at one count");
    assert.equal(await releaseMark(PROJECT, { version: "3.35.400", head: "aaa1111" }),
      "stats: this release is held as 3.35.400 over 75 run(s) (`forge stats eval --since-release 3.35.400`). "
      + "Version 3.35.400 was already held, so nothing was written.", "and rewriting either writes nothing twice");
    for (const version of ["3.35.400", "3.35.401"]) {
      const read = askStats(room, ["eval", "--checkout", PROJECT, "--since-release", version], home);
      assert.equal(read.status, 0, read.stderr);
      assert.match(read.stdout, new RegExp(`held at release ${escaped(version)}`, "u"),
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
test("two anchors are refused with both of them named, and either flag alone answers as it did", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-eval-anchor-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    corpusOf(75, room);
    assert.match(await releaseMark(PROJECT, { version: "3.35.500", head: "cafe123" }), /held as 3\.35\.500 over 75 run\(s\)/u);
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
test("the header and the confounding lines are read off one anchor", async () => {
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
