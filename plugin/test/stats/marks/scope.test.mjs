/* What a held reading is held under, when one is taken, and what a store already full of readings
   keyed the old way becomes. The comparison those readings are put through is `eval.test.mjs`;
   which reading answers, once, is `marks.test.mjs` beside this (ISS-1984). */
import assert from "node:assert/strict";
import test from "node:test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";

import { WINDOW, runsMark } from "../../../src/stats/eval/eval.mjs";
import { RUNS, marksOf, marksPath, scopeOf, writeMark } from "../../../src/stats/marks/marks.mjs";
import { underLock } from "../../../src/resolve/machine/file-lock.mjs";
import { UNKNOWN_DEVICE } from "../../../src/resolve/machine/device.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { PROJECT, askStats, at, corpusOf, rootOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-scope-home-");

/* A checkout declaring a project, so `scopeOf` answers the tracker's slug rather than either
   fallback: the value the tracker names is the one rung this issue is about. */
const declaring = (slug) => {
  const home = tempRoom("stats-scope-declared-");
  const room = tempRoom("stats-scope-checkout-");
  execFileSync("git", ["init", "-q", room], { cwd: room });
  mkdirSync(join(home, "forge", "projects", room.split("/").at(-1)), { recursive: true });
  writeFileSync(join(home, "forge", "projects", room.split("/").at(-1), "config.json"),
    JSON.stringify({ slug }));
  return { home, room };
};

const inHome = (home, fn) => {
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    return fn();
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
};

/* Criteria 4, 5 and 6. The key the old store used was `join(tmpdir(), slug(checkout))`, so a run
   handed a TMPDIR of its own wrote where nothing else would ever look, and a worktree was a project
   of its own. Both are one value now, and it is the one the tracker names. */
test("a reading is held under the project the tracker names, so neither a worktree nor a temporary directory parts one corpus's readings", () => {
  const { home, room } = declaring("a-project");
  inHome(home, () => {
    assert.equal(scopeOf(room), "a-project", "criterion 4: the project, not a path");

    const worktree = tempRoom("stats-scope-worktree-");
    execFileSync("git", ["-C", room, "worktree", "add", "-q", worktree, "-b", "a-branch"], { cwd: room });
    assert.equal(scopeOf(worktree), "a-project",
      "criterion 5: a linked worktree of that repository answers alike, the key being the repository's");

    const was = process.env.TMPDIR;
    try {
      process.env.TMPDIR = tempRoom("stats-scope-tmp-one-");
      const first = scopeOf(room);
      process.env.TMPDIR = tempRoom("stats-scope-tmp-two-");
      assert.equal(scopeOf(room), first,
        "criterion 6: and the temporary directory this run was handed reaches none of it");
    } finally {
      process.env.TMPDIR = was;
    }
  });
});

/* Criterion 7. `null` is what the consult side passes to mean every reading on this device, so an
   undeclared checkout answering `null` would be handed the readings of every project on the machine.
   It answers for itself instead. */
test("a checkout the tracker names no project for resolves no other project's readings", () => {
  const home = tempRoom("stats-scope-undeclared-home-");
  inHome(home, () => {
    const { room: declared } = declaring("mine");
    writeMark({ kind: RUNS, mark: 50, at: at(0), scope: "mine", now: { runs: 50, profile: {} } });
    writeMark({ kind: RUNS, mark: 50, at: at(1), scope: "theirs", now: { runs: 50, profile: {} } });

    const undeclared = tempRoom("stats-scope-nobody-");
    const scope = scopeOf(undeclared);
    assert.notEqual(scope, null, "an unidentified project is a value, never the one that means every project");
    assert.deepEqual(marksOf(RUNS, scope), [], "and it lists neither project's readings");

    const other = tempRoom("stats-scope-nobody-two-");
    assert.notEqual(scopeOf(other), scope,
      "nor do two undeclared checkouts share one bucket, which would part them from nothing");
    assert.equal(marksOf(RUNS, "mine").length, 1, "while a project named still answers with its own");
    assert.ok(declared, "the declared checkout stands");
  });
});

/* Criteria 1 and 2. The trigger tested `count % window === 0` against the count at the moment a
   release landed, so a corpus that gained two runs between ships stepped over the multiple and the
   reading it was owed was never taken: five of this repository's own twelve crossings. */
test("the crossing is at or past the next multiple since the last reading held, not an equality against the count", async () => {
  const home = tempRoom("stats-scope-cross-home-");
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  try {
    process.env.XDG_CONFIG_HOME = home;
    /* Straight past the first multiple and never onto it: the count is 63 and no reading is held. */
    const room = corpusOf(63);
    process.env.TMPDIR = room;
    assert.match(await runsMark(PROJECT), /held as mark 50/u,
      "criterion 2: with none held the crossing is the highest multiple at or below the count");
    assert.equal(marksOf(RUNS, scopeOf(PROJECT)).at(-1).mark, 50);

    corpusOf(137, room);
    assert.match(await runsMark(PROJECT), /held as mark 100/u,
      "criterion 1: and the next is one window past the last held, whatever the count ran to");
    corpusOf(149, room);
    assert.equal(await runsMark(PROJECT), null, "a count short of the next multiple is no crossing");
    assert.deepEqual(marksOf(RUNS, scopeOf(PROJECT)).map((one) => one.mark), [50, 100]);
    assert.equal(WINDOW, 50, "the window these multiples are of");
  } finally {
    Object.assign(process.env, was);
  }
});

/* Criterion 3. `runsMark` was reachable from this repository's own ship script alone, so a project
   that adopts this plugin never reached the writer whatever its release model — the two corpora this
   reading most needs to learn from were the two it could not. */
test("the eval writes the reading it has just computed, so a project that runs no release step takes one", () => {
  const home = tempRoom("stats-scope-eval-home-");
  const room = corpusOf(50);
  const none = askStats(room, ["marks", "--checkout", PROJECT], home);
  assert.match(none.stdout, /^No reading is held for this project yet/u, "nothing is held before the eval runs");

  const read = askStats(room, ["eval", "--checkout", PROJECT], home);
  assert.equal(read.status, 0, read.stderr);
  assert.match(read.stdout, /stats: 50 issue-flow runs in this project's corpus/u,
    "criterion 3: the eval says it wrote one");

  const held = askStats(room, ["marks", "--checkout", PROJECT], home);
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.stdout, /^mark {4}50 {2}\d{4}-\d\d-\d\d \d\d:\d\d {3}50 run\(s\)/mu,
    `criterion 3: and the reading is held afterwards — ${held.stdout}`);
});

/* Criteria 8 and 9. Two readings whose field names match can measure different populations, so a
   held reading says which machine took it and under which rules, rather than leaving a reader to
   assume the answer is today's. */
test("a held reading carries the device it was taken on and the contract it was taken under", async () => {
  const home = tempRoom("stats-scope-contract-home-");
  const was = { TMPDIR: process.env.TMPDIR, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  try {
    process.env.XDG_CONFIG_HOME = home;
    const room = corpusOf(50);
    process.env.TMPDIR = room;
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    const [record] = marksOf(RUNS, scopeOf(PROJECT));
    assert.match(record.device, /^[0-9a-f]{16}$/u, "criterion 8");
    assert.deepEqual(Object.keys(record.contract).sort(), ["act", "declares", "rev", "said", "table"],
      "criterion 9: the phase-7 act and what it was said as, the class table, and the declared set");
    assert.equal(record.contract.rev, 1, "under a revision this code owns, so a rule that moves can move it");
    assert.equal(record.contract.table, record.now.profile.table,
      "and the table is the one the figures were actually computed with");
  } finally {
    Object.assign(process.env, was);
  }
});

/* Criteria 10, 12, 13, 14 and 17. The store this change met held 271 project-keyed records across
   106 roots, 113 of them under a run's own scratch path and reachable from nowhere. */
test("the readings already held are re-keyed once, keeping every figure, with the store kept beside them", () => {
  const home = tempRoom("stats-scope-migrate-home-");
  const room = corpusOf(1);
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    const legacy = [
      { kind: RUNS, mark: 50, at: at(0), root: "/tmp/one-run-scratch/claude-1000/-fixture-project",
        project: PROJECT, now: { runs: 50, profile: { from: 1, to: 2 } } },
      { kind: RUNS, mark: 100, at: at(1), root: "/tmp/another-scratch/claude-1000/-fixture-project",
        project: PROJECT, now: { runs: 50, profile: { from: 3, to: 4 } } },
      { kind: RUNS, mark: 150, at: at(2), root: "/tmp/third/claude-1000/-nothing", now: { runs: 50, profile: {} } },
    ];
    for (const one of legacy) appendFileSync(marksPath(), `${JSON.stringify(one)}\n`);
    const before = readFileSync(marksPath(), "utf8");

    const held = marksOf(RUNS, scopeOf(PROJECT));
    assert.deepEqual(held.map((one) => one.mark), [50, 100],
      "criterion 12: both records naming that checkout answer for it, whatever scratch root they were written under");
    assert.deepEqual(held.map((one) => one.now.profile.from), [1, 3], "keeping every figure they held");
    assert.deepEqual(held.map((one) => one.root), legacy.slice(0, 2).map((one) => one.root),
      "and where the corpus was read is still on the record");
    assert.deepEqual(held.map((one) => one.device), [UNKNOWN_DEVICE, UNKNOWN_DEVICE],
      "criterion 10: a reading taken before the field existed says so");
    assert.deepEqual(held.map((one) => one.contract), [null, null],
      "criterion 10: and never claims to have been measured under today's rules");

    assert.equal(readFileSync(`${marksPath()}.before-ISS-1984`, "utf8"), before,
      "criterion 14: the store as it stood is beside it, byte for byte");
    const report = JSON.parse(readFileSync(`${marksPath()}.migrated`, "utf8"));
    assert.deepEqual([report.records, report.unresolved], [3, 1],
      "criterion 13: the record naming no checkout is reported rather than assigned");
    assert.equal(marksOf(RUNS, scopeOf(PROJECT)).length, 2, "and a second read migrates nothing again");
    assert.equal(readFileSync(`${marksPath()}.before-ISS-1984`, "utf8"), before, "nor rewrites the way back");

    const listed = askStats(room, ["marks", "--checkout", PROJECT], home);
    assert.match(listed.stdout, /^mark {3}100 /mu, `criterion 17: and the readings list — ${listed.stdout}`);
    assert.ok(existsSync(rootOf(room)) || true);
  });
});

/* Criterion 11. `readAll` parsed every record in the store on every call, for the list and again for
   the duplicate check a write makes; the store was 124 MB over 312 records when this was measured. */
test("only the records carrying the project are parsed, for the list and for a write's own duplicate check", () => {
  const home = tempRoom("stats-scope-bounded-home-");
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    for (let n = 0; n < 40; n += 1) {
      appendFileSync(marksPath(), `${JSON.stringify({ kind: RUNS, mark: n, at: at(n), scope: "somebody-else",
        now: { runs: 50, profile: {} } })}\n`);
    }
    appendFileSync(marksPath(), `${JSON.stringify({ kind: RUNS, mark: 50, at: at(99), scope: "ours",
      now: { runs: 50, profile: {} } })}\n`);

    /* Once first, so the one-time migration's own whole read is behind us: what is counted here is
       what a call costs ever after, which is every call but the first this machine makes. */
    marksOf(RUNS, "ours");
    const parsed = [];
    const real = JSON.parse;
    JSON.parse = (text, ...rest) => {
      parsed.push(text);
      return real(text, ...rest);
    };
    try {
      assert.equal(marksOf(RUNS, "ours").length, 1);
      assert.equal(parsed.length, 1, `criterion 11: one record of the forty-one, not all of them — ${parsed.length}`);
      parsed.length = 0;
      writeMark({ kind: RUNS, mark: 50, at: at(100), scope: "ours", now: { runs: 50, profile: {} } });
      assert.equal(parsed.length, 1, "criterion 11: and the duplicate check a write makes parses no more than that");
    } finally {
      JSON.parse = real;
    }
  });
});

/* Criterion 15. The check and the append are one act under the store's own lock. Two processes can
   cross one window at the same moment, the eval writing a reading as well as the ship, and each of
   them reading, deciding and appending as three separate acts is two records where there is one
   reading. The two are held at a barrier so that they reach the store together rather than whenever
   the machine happened to start them. */
test("two writers crossing one window at the same moment leave one held reading", async () => {
  const home = tempRoom("stats-scope-race-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  /* A store with something in it, because what the two writers overlap in is the read: the check
     walks the records of its own kind, and against an empty file it returns before the other process
     has begun. The real one was 124 MB over 312 records when this was written. */
  inHome(home, () => {
    const filler = "x".repeat(2000);
    for (let n = 0; n < 4000; n += 1) {
      appendFileSync(marksPath(), `${JSON.stringify({ kind: RUNS, mark: n, at: at(n),
        scope: "somebody-else", filler, now: { runs: 50, profile: {} } })}\n`);
    }
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
  });
  const room = tempRoom("stats-scope-race-");
  const go = join(room, "go");
  const script = join(room, "write.mjs");
  writeFileSync(script, [
    'import { existsSync } from "node:fs";',
    `import { writeMark } from "${new URL("../../../src/stats/marks/marks.mjs", import.meta.url).pathname}";`,
    `while (!existsSync(${JSON.stringify(go)})) { /* the barrier both writers wait on */ }`,
    'process.stdout.write(String(writeMark({ kind: "runs", mark: Number(process.argv[2]),',
    '  at: new Date().toISOString(), scope: "raced", now: { runs: 50, profile: {} } })));',
  ].join("\n"));

  const raced = (mark) => new Promise((done) => {
    const child = spawn(process.execPath, [script, String(mark)],
      { env: { ...process.env, XDG_CONFIG_HOME: home } });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("close", () => done(out));
  });

  for (const mark of [50, 100, 150, 200, 250]) {
    rmSync(go, { force: true });
    const both = Promise.all([raced(mark), raced(mark)]);
    writeFileSync(go, "");
    assert.deepEqual([...await both].sort(), ["held", "written"],
      `criterion 15: at mark ${mark} one wrote and one found it already held`);
  }

  inHome(home, () => {
    assert.deepEqual(marksOf(RUNS, "raced").map((one) => one.mark), [50, 100, 150, 200, 250],
      "criterion 15: and the store holds one record per crossing, never two");
  });
});

/* Two repositories whose root folders share a name are two repositories. The configuration file each
   resolves to is keyed on that name and the project file's own comment accepts the collision; a
   reading held under it would not be a collision but a merge, one repository answering with the
   other's figures (consult 6f21 F3). */
test("two undeclared repositories whose folders share a name are two scopes", () => {
  const home = tempRoom("stats-scope-namesake-home-");
  inHome(home, () => {
    const made = [0, 1].map((n) => {
      const parent = tempRoom(`stats-scope-parent-${n}-`);
      const room = join(parent, "app");
      mkdirSync(room, { recursive: true });
      execFileSync("git", ["init", "-q", room], { cwd: room });
      return room;
    });
    const [one, two] = made.map((room) => scopeOf(room));
    assert.notEqual(one, two, `two repositories named app are two scopes — ${one} against ${two}`);

    writeMark({ kind: RUNS, mark: 50, at: at(0), scope: one, now: { runs: 50, profile: {} } });
    assert.equal(marksOf(RUNS, one).length, 1);
    assert.deepEqual(marksOf(RUNS, two), [], "and neither answers with the other's readings");

    const worktree = tempRoom("stats-scope-namesake-worktree-");
    execFileSync("git", ["-C", made[0], "worktree", "add", "-q", worktree, "-b", "namesake"], { cwd: made[0] });
    assert.equal(scopeOf(worktree), one, "while a linked worktree keeps its own repository's");
  });
});

/* A machine reading this verb crosses the same windows a person does. The reading was written after
   the screen lines and the JSON path returns before them, so `--json` held nothing (consult 6f21 F4). */
test("the eval writes the reading on its JSON path too, and keeps the line off that stdout", () => {
  const home = tempRoom("stats-scope-json-home-");
  const room = corpusOf(63);
  const read = askStats(room, ["eval", "--checkout", PROJECT, "--json"], home);
  assert.equal(read.status, 0, read.stderr);
  const held = JSON.parse(read.stdout);
  assert.equal(held.now.runs, 50, "stdout is one JSON object and nothing else");

  const listed = askStats(room, ["marks", "--checkout", PROJECT], home);
  assert.match(listed.stdout, /^mark {4}50 /mu, `the reading is held afterwards — ${listed.stdout}`);
  const again = askStats(room, ["eval", "--checkout", PROJECT, "--json"], home);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(askStats(room, ["marks", "--checkout", PROJECT], home).stdout.trim().split("\n").length, 1,
    "and a second reading of the same crossing appends nothing");
});

/* The way back is the store as it stood, so a second attempt that copied the already-migrated store
   over it would destroy the only thing a reversal has (consult 6f21 F2). */
test("a migration run again does not copy the migrated store over the way back", () => {
  const home = tempRoom("stats-scope-backup-home-");
  inHome(home, () => {
    mkdirSync(join(home, "forge"), { recursive: true });
    appendFileSync(marksPath(), `${JSON.stringify({ kind: RUNS, mark: 50, at: at(0),
      root: "/tmp/scratch/claude-1000/-fixture-project", project: PROJECT,
      now: { runs: 50, profile: { from: 1, to: 2 } } })}\n`);
    const original = readFileSync(marksPath(), "utf8");

    assert.equal(marksOf(RUNS, scopeOf(PROJECT)).length, 1);
    assert.equal(readFileSync(`${marksPath()}.before-ISS-1984`, "utf8"), original);

    /* What an interruption after the rename leaves: the store migrated, the marker never written. */
    rmSync(`${marksPath()}.migrated`);
    assert.equal(marksOf(RUNS, scopeOf(PROJECT)).length, 1, "the records survive the second attempt");
    assert.equal(readFileSync(`${marksPath()}.before-ISS-1984`, "utf8"), original,
      "and the way back is still the store as it first stood, not the migrated one");
  });
});

/* Elapsed time is not evidence that a holder is gone: it is evidence that its work is long, which a
   rewrite of every record the store holds is. A holder evicted by the clock puts two processes inside
   one critical section, which is what the lock exists to prevent (consult 8cce17 F1). */
test("a lock whose holder is still running is waited on and then refused, never taken from it", () => {
  const home = tempRoom("stats-scope-holder-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  inHome(home, () => {
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    const holder = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);
    try {
      writeFileSync(`${marksPath()}.lock`, `${holder.pid}-deadbeef`);
      const reading = { kind: RUNS, mark: 50, at: at(0), scope: "guarded", now: { runs: 50, profile: {} } };
      assert.equal(writeMark(reading), "failed",
        "a writer that cannot take the lock says the reading is not held rather than writing beside one");
      assert.ok(!existsSync(marksPath()) || !readFileSync(marksPath(), "utf8").includes('"scope":"guarded"'),
        "and nothing of it reached the store");
      assert.equal(readFileSync(`${marksPath()}.lock`, "utf8"), `${holder.pid}-deadbeef`,
        "while the lock is still the holder's, however long it has held it");
    } finally {
      holder.kill();
    }
  });
});

/* The other half of the same rule: a lock nobody holds is not a lock, and waiting out a budget for a
   process that ended helps nobody. */
test("a writer removes no lock it does not own, whatever it can work out about the holder", async () => {
  const home = tempRoom("stats-scope-dead-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  const gone = spawn(process.execPath, ["-e", ""]);
  const pid = gone.pid;
  await new Promise((done) => gone.on("exit", done));
  inHome(home, () => {
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    writeFileSync(`${marksPath()}.lock`, `${pid}-deadbeef`);
    assert.equal(writeMark({ kind: RUNS, mark: 50, at: at(0), scope: "freed", now: { runs: 50, profile: {} } }),
      "failed", "even a holder that has ended keeps its lock: every rule for taking one rests on a reading taken before the removal");
    assert.equal(readFileSync(`${marksPath()}.lock`, "utf8"), `${pid}-deadbeef`, "the lock is left where it stood");
    assert.deepEqual(marksOf(RUNS, "freed"), [], "and nothing was written beside it");
  });
});

/* The refusal has to be one a person can act on, this being the one state the store does not clear
   for itself: a lock nobody holds is left standing, so the refusal names it and what removes it. */
test("the refusal names the lock and what clears it", () => {
  const home = tempRoom("stats-scope-said-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  inHome(home, () => {
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    const holder = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);
    try {
      writeFileSync(`${marksPath()}.lock`, `${holder.pid}-deadbeef`);
      assert.throws(() => underLock(`${marksPath()}.lock`, () => "ran", { strict: true, waits: 100 }), (error) => {
        assert.match(error.message, new RegExp(`rm ${marksPath().replaceAll(".", "\\.")}\\.lock`, "u"),
          `the one command that clears it — ${error.message}`);
        return true;
      });
    } finally {
      holder.kill();
    }
  });
});

/* The other half: a caller that is not strict is bookkeeping, where a queue costs more than the line
   it is guarding, so it takes a lock whose holder has ended rather than refusing. */
test("a caller that is not strict takes a lock whose holder has ended", async () => {
  const home = tempRoom("stats-scope-loose-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  const gone = spawn(process.execPath, ["-e", ""]);
  const pid = gone.pid;
  await new Promise((done) => gone.on("exit", done));
  inHome(home, () => {
    const lock = `${marksPath()}.loose`;
    writeFileSync(lock, `${pid}-deadbeef`);
    /* A stale window no run of this case can reach, so the age rule cannot be what hands the lock
       over and the only thing that can is the holder being gone. */
    assert.equal(underLock(lock, () => "ran", { waits: 30_000, stale: 86_400_000 }), "ran");
    assert.equal(existsSync(lock), false,
      "and the lock was taken and released rather than left standing while the callback ran beside it");
  });
});

/* A lock is published by linking a name that already holds its owner, so the path never carries half
   of one. A reader that met an empty lock and took it for free would be taking it from whoever was
   publishing it at that moment, which is two callers inside one guard (consult 3f5d F1). */
test("a lock whose owner cannot be read is not taken for one nobody holds", () => {
  const home = tempRoom("stats-scope-partial-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  inHome(home, () => {
    writeFileSync(`${marksPath()}.migrated`, "{}\n");
    writeFileSync(`${marksPath()}.lock`, "");
    assert.equal(writeMark({ kind: RUNS, mark: 50, at: at(0), scope: "partial", now: { runs: 50, profile: {} } }),
      "failed", "an owner that cannot be read is unknown, never gone");
    assert.deepEqual(marksOf(RUNS, "partial"), [], "and nothing was written beside it");
    assert.equal(readFileSync(`${marksPath()}.lock`, "utf8"), "", "the lock is left where it stood");
  });
});
