/* What becomes of the readings already held when the rule about what a record may carry arrives after
   the records do, and what makes that rule one no writer can forget. What a reading is held under is
   `scope.test.mjs` beside this; which reading answers, once, is `marks.test.mjs` (ISS-2106). */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

import { releaseMark, runsMark } from "../../../src/stats/eval/eval.mjs";
import { CLAIMS, CONSULTS, RELEASES, RUNS, WRITTEN, marksOf, marksPath, scopeOf, writeMark }
  from "../../../src/stats/marks/marks.mjs";
import { evalObject } from "../../../src/codex/codex-stats.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { FORGE, PROJECT, askStats, at, corpusOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-prune-home-");

/* The store each case builds is its own, so a home is entered and left rather than shared. */
const inHome = (home, fn) => {
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    return fn();
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
};

/* Criterion 1, AC-19-8-129. The projection began at the two writers standing in front of the run that
   added it, and the third — the consult crossing's — went on spreading its reading raw, so the store
   gained a dead window at every hundredth answered consult while the rule read as kept. It is the
   store's own write that drops them now, which is what makes it a rule no writer has to remember
   (ISS-2106). */
test("every writer of a reading leaves the two fields nothing reads back out of the store", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const home = tempRoom("stats-scope-writers-home-");
  process.env.XDG_CONFIG_HOME = home;
  try {
    mkdirSync(join(home, "forge"), { recursive: true });
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    assert.match(await releaseMark(PROJECT, { version: "3.35.900", head: "fee1234" }), /held as 3\.35\.900/u);
    /* The consult side's, handed both fields on the way in. */
    assert.equal(writeMark({ kind: CONSULTS, mark: 100, at: at(3), device: "fixture-device",
      now: { consults: 100, from: at(0), to: at(2) },
      before: { consults: 100 }, classes: { rows: [["forge guide", 9]] } }), WRITTEN);

    const store = readFileSync(marksPath(), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(store.map((one) => one.kind), [RUNS, RELEASES, CONSULTS], "one record per writer");
    for (const one of store) {
      assert.equal(one.before, undefined, `a ${one.kind} record holds no earlier window of its own`);
      assert.equal(one.classes, undefined, `a ${one.kind} record holds no class table`);
      assert.ok(one.now, `while the window a reader of a stored ${one.kind} reading does take is on it`);
    }
    /* Grown past one window, so the live object has a before window of its own to have kept: what
       the store drops is a projection of the reading and not a field the reading stopped computing. */
    corpusOf(100, room);
    const screen = askStats(room, ["eval", "--checkout", PROJECT, "--json"], home);
    assert.equal(screen.status, 0, screen.stderr);
    const held = JSON.parse(screen.stdout);
    assert.ok(held.before?.profile, "the live object the screen and the JSON read still carries its own before window");
    assert.ok(held.classes, "and its class table, neither of which is what gets written down");
  } finally {
    Object.assign(process.env, was);
  }
});

/* Criteria 2, 3, 4, 6, 7 and 10, AC-19-8-132. The store this met held 318 records in 127,636,229
   bytes, 316 of them carrying an earlier window nothing has ever read back and 10 a class table:
   54,335,490 bytes, 42.57% of the file (ISS-2106). */
test("the two fields nothing reads back are dropped from the readings already held, once, with the store kept beside them", () => {
  const home = tempRoom("stats-scope-prune-home-");
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    /* The shape a store is in on a machine that has taken the re-keying pass: the scope is on the
       records and that pass's marker is down, so the pruning pass is the one that runs. */
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    const fat = (mark, extra) => ({
      kind: RUNS, mark, at: at(mark), scope: scopeOf(PROJECT), root: `/tmp/scratch-${mark}`,
      project: PROJECT, device: "fixture-device", contract: null,
      now: { runs: 50, profile: { from: mark, to: mark + 1, rungs: [{ rung: "feature", runs: 3 }] } },
      before: { runs: 50, profile: { from: 0, to: 1 } }, ...extra,
    });
    const unscoped = { kind: RUNS, mark: 150, at: at(150), root: "/tmp/gone",
      now: { runs: 50, profile: {} }, before: { runs: 50, profile: {} } };
    for (const one of [fat(50, { classes: { rows: [["forge guide", 9]] } }),
      fat(100, { somethingNothingReads: "kept" }), unscoped]) {
      appendFileSync(marksPath(), `${JSON.stringify(one)}\n`);
    }
    const before = readFileSync(marksPath(), "utf8");

    const read = marksOf(RUNS, scopeOf(PROJECT));
    assert.deepEqual(read.map((one) => one.mark), [50, 100], "criterion 2: the readings are still held");
    for (const one of read) {
      assert.equal(one.before, undefined, "criterion 2: with no earlier window of their own");
      assert.equal(one.classes, undefined, "criterion 2: and no class table");
    }
    assert.deepEqual(read.map((one) => one.now.profile.from), [50, 100], "criterion 3: every figure they held");
    assert.deepEqual(read.map((one) => one.now.profile.rungs),
      [[{ rung: "feature", runs: 3 }], [{ rung: "feature", runs: 3 }]], "criterion 3: nested values included");
    assert.deepEqual(read.map((one) => [one.root, one.project, one.device, one.contract]),
      [["/tmp/scratch-50", PROJECT, "fixture-device", null], ["/tmp/scratch-100", PROJECT, "fixture-device", null]],
      "criterion 3: and where it was read, whose it is, which device took it and under what");
    assert.equal(read[1].somethingNothingReads, "kept",
      "criterion 3: a field this code does not name is kept, this pass knowing only the two it drops");

    const store = readFileSync(marksPath(), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(store.length, 3, "criterion 2: no record is dropped, only the two fields");
    assert.equal(store[2].scope, undefined,
      "criterion 10: a record carrying no scope is left carrying none — keying one is not this pass's act");
    assert.equal(store[2].before, undefined, "while the two dead fields go from it as from any other");

    assert.equal(readFileSync(`${marksPath()}.before-ISS-2106`, "utf8"), before,
      "criterion 4: the store as it stood is beside it, byte for byte");
    const report = JSON.parse(readFileSync(`${marksPath()}.pruned`, "utf8"));
    assert.deepEqual([report.records, report.pruned], [3, 3], "and the pass says how many it rewrote");
    assert.equal(report.kept, `${marksPath()}.before-ISS-2106`, "naming the way back it left");

    const after = readFileSync(marksPath(), "utf8");
    assert.equal(marksOf(RUNS, scopeOf(PROJECT)).length, 2, "criterion 7: a second read runs the pass again over nothing");
    assert.equal(readFileSync(marksPath(), "utf8"), after, "criterion 7: rewriting not a byte of the store");
    assert.equal(readFileSync(`${marksPath()}.before-ISS-2106`, "utf8"), before, "criterion 7: nor the way back");
    assert.ok(after.length < before.length, `and the store is smaller for it — ${after.length} against ${before.length}`);

    /* Criterion 6: the way back is one copy, and what it restores is every record as the pass found
       it rather than every record it could parse back. */
    copyFileSync(`${marksPath()}.before-ISS-2106`, marksPath());
    assert.equal(readFileSync(marksPath(), "utf8"), before, "criterion 6: byte for byte");
    assert.deepEqual(readFileSync(marksPath(), "utf8").trim().split("\n")
      .map((line) => JSON.parse(line).before?.profile?.from), [0, 0, undefined],
      "criterion 6: the earlier windows among them included");
  });
});

/* Criterion 5. The copy aside is the whole of the way back, so a pass that could not finish making
   one has nothing to be reversed by and must not have touched the store either. */
test("a copy aside that did not complete leaves the store unreplaced", () => {
  const home = tempRoom("stats-scope-nocopy-home-");
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    appendFileSync(marksPath(), `${JSON.stringify({ kind: RUNS, mark: 50, at: at(0), scope: "ours",
      now: { runs: 50, profile: {} }, before: { runs: 50, profile: {} } })}\n`);
    const before = readFileSync(marksPath(), "utf8");
    /* What the copy writes to, standing there as a directory: the copy throws rather than the pass
       deciding for itself that it can do without one. */
    mkdirSync(`${marksPath()}.before-ISS-2106.part`);

    assert.deepEqual(marksOf(RUNS, "ours").map((one) => one.mark), [50],
      "the reading is still read, the pass having refused rather than thrown at the reader");
    assert.equal(readFileSync(marksPath(), "utf8"), before, "criterion 5: and not a byte of the store was replaced");
    assert.equal(existsSync(`${marksPath()}.before-ISS-2106`), false, "no way back was published");
    assert.equal(existsSync(`${marksPath()}.pruned`), false, "and no marker claims the pass has run");

    /* The other half, without which the assertions above are true of a pass that does not exist: the
       block removed, the same store in the same home is replaced and its way back published. */
    rmSync(`${marksPath()}.before-ISS-2106.part`, { recursive: true });
    assert.deepEqual(marksOf(RUNS, "ours").map((one) => one.mark), [50], "the reading is read either way");
    assert.equal(readFileSync(`${marksPath()}.before-ISS-2106`, "utf8"), before,
      "and now the way back is the store the block had left standing");
    assert.notEqual(readFileSync(marksPath(), "utf8"), before, "the store replaced only once a copy of it existed");
  });
});

/* Criterion 8. One mechanism serves both passes, so the rule the re-keying pass answers to about
   never publishing a backup twice is a rule this one cannot answer differently (ISS-2106). */
test("a pruning pass run again does not copy the pruned store over the way back", () => {
  const home = tempRoom("stats-scope-prune-backup-home-");
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    appendFileSync(marksPath(), `${JSON.stringify({ kind: RUNS, mark: 50, at: at(0), scope: "ours",
      now: { runs: 50, profile: { from: 1, to: 2 } }, before: { runs: 50, profile: { from: 0, to: 1 } } })}\n`);
    const original = readFileSync(marksPath(), "utf8");

    assert.equal(marksOf(RUNS, "ours").length, 1);
    assert.equal(readFileSync(`${marksPath()}.before-ISS-2106`, "utf8"), original);

    /* What an interruption between the store's replacement and the marker leaves. */
    rmSync(`${marksPath()}.pruned`);
    assert.equal(marksOf(RUNS, "ours").length, 1, "the records survive the second attempt");
    assert.equal(readFileSync(`${marksPath()}.before-ISS-2106`, "utf8"), original,
      "criterion 8: and the way back is still the store as it first stood, not the pruned one");
  });
});

/* Criterion 9. The pass rewrites every record the store holds and another process can be appending
   one while it does, so the two go through the store's own lock rather than one of them finding its
   record gone or the other's rewrite landing on top of it. */
test("a reading written while the pruning pass runs is still held once the pass has finished", async () => {
  const home = tempRoom("stats-scope-prune-race-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  const marks = join(home, "forge", "eval-marks.jsonl");
  /* A store with enough in it that the pass is not over before the other process has begun, and the
     re-keying pass already taken, so the pruning one is the pass that races. */
  writeFileSync(`${marks}.migrated`, "{}\n");
  const filler = "x".repeat(2000);
  writeFileSync(marks, `${Array.from({ length: 4000 }, (one, n) => JSON.stringify({
    kind: RUNS, mark: n, at: at(n), scope: "somebody-else", now: { runs: 50, profile: {} },
    before: { runs: 50, filler },
  })).join("\n")}\n`);

  const room = tempRoom("stats-scope-prune-race-");
  const go = join(room, "go");
  const marksModule = new URL("../../../src/stats/marks/marks.mjs", import.meta.url).pathname;
  const both = (name, body) => {
    const script = join(room, `${name}.mjs`);
    writeFileSync(script, [
      'import { existsSync } from "node:fs";',
      `import { RUNS, marksOf, writeMark } from "${marksModule}";`,
      `while (!existsSync(${JSON.stringify(go)})) { /* the barrier both processes wait on */ }`,
      body,
    ].join("\n"));
    return new Promise((done) => {
      const child = spawn(process.execPath, [script], { env: { ...process.env, XDG_CONFIG_HOME: home } });
      let out = "";
      child.stdout.on("data", (chunk) => { out += chunk; });
      child.on("exit", () => done(out));
    });
  };
  const passing = both("pass", 'process.stdout.write(String(marksOf(RUNS, "somebody-else").length));');
  const writing = both("write", "process.stdout.write(String(writeMark({ kind: RUNS, mark: 99_999,"
    + ' at: new Date().toISOString(), scope: "arrived", now: { runs: 50, profile: {} } })));');
  writeFileSync(go, "");
  const [read, wrote] = await Promise.all([passing, writing]);

  assert.equal(wrote, WRITTEN, "the reading the other process wrote was held");
  assert.equal(Number(read) >= 4000, true, `and the pass read every record that was there — ${read}`);
  const store = readFileSync(marks, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(store.length, 4001, "criterion 9: every record the pass rewrote, and the one that arrived while it did");
  assert.deepEqual(store.filter((one) => one.scope === "arrived").map((one) => one.mark), [99_999],
    "criterion 9: the arrival among them by name");
  assert.deepEqual(store.filter((one) => one.before !== undefined), [],
    "and not one of them carrying the field the pass and the write both drop");
  assert.equal(JSON.parse(readFileSync(`${marks}.pruned`, "utf8")).records >= 4000, true,
    "the pass reporting what it rewrote, whichever of the two took the lock first");
});

/* Criterion 11, and the load-bearing assumption of the whole change (consult 8492 F1): that the
   trace of stored-reading consumers is exhaustive, so that dropping these two fields loses nothing
   any code path can ask for. One store carrying them and one without, identical otherwise, put
   through every consumer this change could find. The records are the ones the writers really write
   and the fields put back on them carry figures nothing like the record's own, so a consumer that
   read either would not read the same — the data is gone from the store once the pass has run, and
   nothing but the copy aside brings it back, so this is checked rather than reasoned. */
test("every consumer of a stored reading reads the same with the two fields and without them", async () => {
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const scratch = tempRoom("stats-scope-pair-write-");
  const room = corpusOf(100);
  const release = "3.35.950";
  /* The log the consult eval compares against, and the reading held over it: planted the same in
     both homes, what is under test being the stored side of that comparison and not the live one. */
  const logged = Array.from({ length: 150 }, (one, n) => ({
    kind: "consult", ok: true, id: `p${n}`, at: new Date(Date.UTC(2026, 8, 5) + n * 60_000).toISOString(),
    root: "/planted", reply: "CODEX: 0 findings",
  }));
  let captured = null;
  process.env.XDG_CONFIG_HOME = scratch;
  process.env.TMPDIR = room;
  try {
    mkdirSync(join(scratch, "forge"), { recursive: true });
    assert.match(await runsMark(PROJECT), /held as mark 100/u);
    assert.match(await releaseMark(PROJECT, { version: release, head: "abc1234", issues: ["ISS-2106"] }),
      new RegExp(`held as ${release.replace(/\./gu, "\\.")}`, "u"));
    assert.equal(writeMark({ kind: CONSULTS, mark: 100, at: at(52), device: "fixture-device",
      ...evalObject(logged.slice(0, 100)) }), WRITTEN);
    captured = readFileSync(marksPath(), "utf8").trim().split("\n");
    assert.equal(captured.length, 3, "one record per writer, as the store holds them");
    /* Half a window past every mark on both sides, so each consumer below is a reading: a stored
       reading sharing most of the recent window is refused, which says nothing about the two fields. */
    corpusOf(125, room);
  } finally {
    Object.assign(process.env, was);
  }

  /* Figures nothing like the records' own, so that any consumer reading one of these fields reads a
     number it could not otherwise have printed. */
  const dead = {
    before: { runs: 7, consults: 7, spanned: 7, from: "1999-01-01T00:00:00.000Z", to: "1999-01-02T00:00:00.000Z", mix: {},
      profile: { from: 7, to: 7, medianMinutes: 777, rungs: [{ rung: "nonesuch", runs: 7 }], byClass: [["nonesuch", { wait: 7 }]] } },
    classes: { rows: [["nonesuch", 7]], lookups: { before: 7, now: 7 } },
  };
  /* Stripped here rather than by the code under test, so the pair is two stores differing in exactly
     these two fields whichever source this runs against — a precondition a case must hold for itself
     and not borrow from the thing it is checking. */
  const withoutBoth = (line) => {
    const one = JSON.parse(line);
    delete one.before;
    delete one.classes;
    return JSON.stringify(one);
  };
  /* A claim beside the readings, so the claims reader in the change reading has something to find:
     a claim record never carried either field, and a consumer checked over an empty table is a
     consumer nobody checked (review 8b3f (a)). */
  const claim = JSON.stringify({ kind: CLAIMS, scope: scopeOf(PROJECT), issue: "ISS-2106",
    angle: "gate", direction: "down", at: at(53), landingKnown: false });
  const lean = [...captured.map(withoutBoth), claim];
  const fat = captured.map((line) => JSON.stringify({ ...JSON.parse(withoutBoth(line)), ...dead }))
    .concat(claim);

  /* A plugin cache holding the release, since the change reading refuses a version no installed copy
     stands at and would then read nothing off the store at all. One cache for the pair, shared as the
     corpus is: what differs between the two homes has to be the store and nothing else. */
  const user = tempRoom("stats-scope-pair-user-");
  const cache = join(user, ".claude", "plugins", "cache", "forge-marketplace");
  mkdirSync(join(cache, release), { recursive: true });
  writeFileSync(join(user, ".claude", "plugins", "installed_plugins.json"),
    `${JSON.stringify({ plugins: { forge: [{ installPath: join(cache, "forge") }] } })}\n`);

  const homeWith = (lines, name) => {
    const home = tempRoom(`stats-scope-pair-${name}-`);
    mkdirSync(join(home, "forge"), { recursive: true });
    /* Both passes marked taken, so the store stands as planted: the fat home is what a machine held
       before this change and the lean one what the pass leaves, and neither is rewritten under us. */
    for (const marker of ["migrated", "pruned"]) {
      writeFileSync(join(home, "forge", `eval-marks.jsonl.${marker}`), "{}\n");
    }
    writeFileSync(join(home, "forge", "eval-marks.jsonl"), `${lines.join("\n")}\n`);
    writeFileSync(join(home, "forge", "codex-log.jsonl"),
      `${logged.map((one) => JSON.stringify(one)).join("\n")}\n`);
    /* One device across the pair: the id is minted per home on first read, and two homes differing in
       it would differ in every reading that names it for a reason this test is not about. */
    writeFileSync(join(home, "forge", "device.json"), `${JSON.stringify({ device: "fixturedevice0001" })}\n`);
    return home;
  };
  const fatHome = homeWith(fat, "fat");
  const leanHome = homeWith(lean, "lean");
  const stored = (home) => readFileSync(join(home, "forge", "eval-marks.jsonl"), "utf8");
  /* The two keys at the top of a record, which is where a stored reading carries them; `before` also
     names a field inside a profile, so the whole text is the wrong thing to ask. */
  const deadKeys = (text) => text.trim().split("\n")
    .map((line) => Object.keys(JSON.parse(line)).filter((key) => key === "before" || key === "classes"));
  assert.deepEqual(deadKeys(stored(fatHome)),
    [["before", "classes"], ["before", "classes"], ["before", "classes"], []],
    "one store of the pair carries both fields on every reading, the claim having never held either");
  assert.deepEqual(deadKeys(stored(leanHome)), [[], [], [], []], "and the other carries neither on any");
  assert.deepEqual(stored(leanHome).trim().split("\n").map(withoutBoth),
    stored(fatHome).trim().split("\n").map(withoutBoth),
    "while the two agree in every other field, which is what makes the readings below worth comparing");

  const asked = (home, argv) => spawnSync(FORGE, argv, {
    encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home, TMPDIR: room, HOME: user },
  });
  /* When the corpus was read, which is the wall clock of the call and not a figure off a reading. The
     one masked value, and the dead fields below carry a year no reading of this corpus can, so
     masking it hides nothing this case is looking for. */
  const settled = (text) => text.replace(/"readAt": "[^"]+"/gu, "\"readAt\": \"<when>\"");
  const CONSUMERS = [
    ["the runs eval against a count mark", ["stats", "eval", "--checkout", PROJECT, "--against", "100"]],
    ["the runs eval as JSON", ["stats", "eval", "--checkout", PROJECT, "--against", "100", "--json"]],
    ["the runs eval since a release, whose reach line reads the stored reading",
      ["stats", "eval", "--checkout", PROJECT, "--since-release", release]],
    ["the project's mark listing", ["stats", "marks", "--checkout", PROJECT]],
    ["the change reading, which resolves a release off the store", ["stats", "change", release, "--checkout", PROJECT]],
    ["the change reading as JSON", ["stats", "change", release, "--checkout", PROJECT, "--json"]],
    ["the change reading named by the issue the release carries", ["stats", "change", "ISS-2106", "--checkout", PROJECT]],
    ["the device's mark listing", ["codex", "marks"]],
    ["the consult eval against a mark", ["codex", "eval", "--against", "100"]],
    ["the consult eval as JSON", ["codex", "eval", "--against", "100", "--json"]],
  ];
  for (const [what, argv] of CONSUMERS) {
    const read = asked(fatHome, argv);
    const cut = asked(leanHome, argv);
    assert.equal(cut.status, read.status, `${what}: the same exit status — ${read.stderr}${cut.stderr}`);
    assert.equal(cut.status, 0, `${what}: and a reading rather than a refusal — ${cut.stderr}`);
    assert.equal(settled(cut.stdout), settled(read.stdout), `criterion 11: ${what} reads the same either way`);
    assert.equal(cut.stderr, read.stderr, `criterion 11: ${what} says the same either way`);
    assert.doesNotMatch(read.stdout, /nonesuch|777|1999/u,
      `${what}: and no figure of the dead fields reaches a reader`);
  }
  /* And the store each consumer read is still the store it was handed: a reading that wrote a mark
     would have made every comparison above one between two different populations. */
  for (const home of [fatHome, leanHome]) {
    assert.equal(readFileSync(join(home, "forge", "eval-marks.jsonl"), "utf8").trim().split("\n").length, 4,
      "no consumer above wrote a reading of its own");
  }
});

/* A field the marker leaves out reads as a question nobody asked; one reading zero answers it none.
   So a pass reports the same fields whatever the store holds, and the store holding nothing is where
   a pass reporting only what it touched is the one that differs. */
test("each pass reports the same fields on a store holding nothing as on one holding records", () => {
  const home = tempRoom("stats-prune-empty-home-");
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    assert.deepEqual(marksOf(RUNS, "nobody"), [], "a home with no store yet holds no reading");

    const report = (marker) => JSON.parse(readFileSync(`${marksPath()}.${marker}`, "utf8"));
    assert.deepEqual(report("migrated"), { ...report("migrated"), records: 0, unresolved: 0, checkouts: [], kept: null },
      "the re-keying pass says none was unresolved rather than leaving the field out");
    assert.deepEqual(report("pruned"), { ...report("pruned"), records: 0, pruned: 0, kept: null },
      "and the pruning pass says none was pruned");
    for (const marker of ["migrated", "pruned"]) {
      assert.ok(Date.parse(report(marker).at) > 0, `${marker} says when it ran`);
    }
    assert.equal(existsSync(`${marksPath()}.before-ISS-1984`), false,
      "and neither kept a way back for a store with nothing in it to go back to");
    assert.equal(existsSync(`${marksPath()}.before-ISS-2106`), false);
  });
});
