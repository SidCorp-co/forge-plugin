/* The three profilers this verb replaces were run once each and thrown away, so nothing held their
   arithmetic to anything. Every row the verb prints is pinned here against a transcript small
   enough to add up by hand. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "../../src/flow/record.mjs";
import {
  MARKERS, UNTIERED, WHOLE_SET_CLASS, callsIn, classOf, markerOf, shellOf, slugFor, tierRun,
} from "../../src/stats/transcripts.mjs";
import { segmented, unionSeconds } from "../../src/stats/runs.mjs";
import { TIERS } from "../../src/ladder.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const PROJECT = "/fixture/project";
const BASE = Date.parse("2026-09-01T00:00:00.000Z");
const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

const use = (id, seconds, name, input) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] },
});

const result = (id, seconds, content, isError = false) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] },
});

/* Twelve calls with a marker of each kind, two waits worth naming, one refusal, one command typed
   three times and one call whose result never came. */
const CALLS = [
  ["c1", 0, 10, "cat plugin/src/cli.mjs", "the file"],
  ["c2", 30, 5, "./plugin/bin/forge claim ISS-99", "claimed"],
  ["c3", 60, 5, "forge plan ISS-99 /tmp/plan.md", "planned"],
  ["c4", 120, 120, "cd /w && npm run check 2>&1 | tail -5", "All 12 gate step(s) passed"],
  ["c5", 300, 30, "node --test plugin/test/stats/runs.test.mjs", "ok"],
  ["c6", 400, 900, "forge codex consult --send bodies plugin/src/stats/runs.mjs", "1 finding"],
  ["c7", 1400, 300, "forge codex consult --recheck", "confirmed"],
  ["c8", 1800, 5, "forge record verdict ISS-99 --criterion 1", "recorded"],
  ["c9", 1850, 5, "forge advance ISS-99", "developed -> tested"],
  ["c10", 1900, 240, "node /w/tools/run.mjs ship --note x", "released"],
  ["c11", 2200, 20, 'until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', "done"],
  ["c12", 2300, 5, "forge issue ISS-99 --full", "the body"],
  ["c13", 2320, 5, "forge issue ISS-99 --full", "the body"],
  ["c14", 2340, 5, "forge issue ISS-99 --full", "the body"],
];

const REFUSED = ["c15", 2400, 5, "forge advance ISS-99", "Hold — ISS-99 owes a release note.", true];
const UNANSWERED = ["c16", 2500, "git status --short"];

const transcript = () => [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
  ...CALLS.flatMap(([id, start, waited, command, body]) =>
    [use(id, start, "Bash", { command }), result(id, start + waited, body)]),
  use(REFUSED[0], REFUSED[1], "Bash", { command: REFUSED[3] }),
  result(REFUSED[0], REFUSED[1] + REFUSED[2], REFUSED[4], true),
  use(UNANSWERED[0], UNANSWERED[1], "Bash", { command: UNANSWERED[2] }),
].join("\n");

/* The tier a run worked at comes off the confirmation it posted, and it is the call's own class
   that says which call that was. Every line below carries the same words in a body some other verb
   printed: read from those, a run is filed at the tier of whatever issue it happened to read. */
const said = (klass, body) => ({ class: klass, body });

/* Written by `render`, the only writer of these records: a body composed by hand would not carry the
   tag and fence that say which record a stamped key belongs to, and asserting over one would
   re-derive the blind spot (F2 of the whole-set read). */
const wrote = (tier, extra = {}) =>
  render("confirmation", { where: ["src/a.mjs"], is: "a reading", finding: "holds", tier, ...extra });

test("a run's tier is read off the confirmation it wrote, and off no other call that echoes one", () => {
  const [trivial, , feature] = TIERS;
  assert.equal(tierRun([said("forge record confirmation", wrote(trivial))]), trivial);
  assert.equal(tierRun([]), UNTIERED, "a run that confirmed nothing is filed under no tier");
  for (const klass of ["forge issue", "forge resume", "read", "forge record verdict"]) {
    assert.equal(tierRun([said(klass, wrote(trivial))]), UNTIERED,
      `\`${klass}\` printing the record is a run reading a thread, not a run that claimed a tier`);
  }
  assert.equal(tierRun([said("forge record confirmation", wrote("enormous"))]), UNTIERED,
    "a word this ladder has not got names no rung, and is not folded into the nearest one");
  assert.equal(tierRun([said("forge record confirmation", `${wrote(trivial)}\n\ntier: ${feature}`)]), trivial,
    "and a line the same call printed after the record is prose: the class covers the shell, not the write");
  assert.equal(
    tierRun([said("forge record confirmation", wrote(trivial)), said("forge record confirmation", wrote(feature))]),
    feature,
    "a batch is as heavy as its heaviest member, never the cheapest of them",
  );
});

/* Two ways a body carries the word without a record having stamped it, and the writer makes both:
   `blockOf` indents every continuation line of a multi-line field, and a chained read prints whole
   records of its own. A reading that took either would re-file the run that wrote it (F2, F3). */
test("prose inside a field cannot claim a rung the run did not stamp", () => {
  const [trivial, , feature] = TIERS;
  const written = wrote(trivial, { detail: `the plan said one thing\ntier: ${feature}` });
  assert.match(written, /\n {2}tier: feature/u, "the writer really does indent a continuation line");
  assert.equal(tierRun([said("forge record confirmation", written)]), trivial,
    "so the stamped key decides, and a sentence a person typed under another field does not");
  assert.equal(tierRun([said("forge record confirmation", `${wrote(trivial)}\n\n${wrote(feature)}`)]), trivial,
    "and the record the write printed is the first one: a thread read after it belongs to another issue");
  assert.equal(tierRun([said("forge record confirmation", wrote(feature))]), feature,
    "while the key the writer really wrote is read, or nothing would be");
});


/* The rows have to add up to the corpus: a run filed under no tier and dropped would leave a table
   that silently reports fewer runs than the profile above it. */
test("the table has a row per rung and one for the runs that named none, and they add up", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const table = run.stdout.split("\ntier ")[1]?.split("\nphase")[0] ?? "";
  assert.ok(table, `no tier table printed\n--- printed ---\n${run.stdout}`);
  const rows = new Map(table.split("\n").map((line) => line.trim().split(/\s+/u))
    .filter(([name, runs]) => name && /^\d+$/u.test(runs ?? ""))
    .map(([name, runs]) => [name, Number(runs)]));
  for (const tier of [...TIERS, UNTIERED]) {
    assert.ok(rows.has(tier), `${tier} has no row, and a rung absent reads as one that costs nothing`);
  }
  assert.equal([...rows.values()].reduce((sum, one) => sum + one, 0), 1,
    "the rows count the corpus once: this fixture is one run, and it claimed no tier");
  assert.equal(rows.get(UNTIERED), 1, "so it is the untiered row that holds it, not the cheapest rung");
});

/* A subagent that was not an issue-flow run: it is skipped and said to be, because a corpus that
   shrank because the marker moved reads exactly like a quiet week. */
const OTHER = [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "summarise this file" } }),
  use("x1", 0, "Bash", { command: "wc -l README.md" }),
  result("x1", 3, "12 README.md"),
].join("\n");

const corpus = () => {
  const room = tempRoom("stats-runs-");
  const write = (session, name, text) => {
    const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), session, "tasks");
    mkdirSync(tasks, { recursive: true });
    writeFileSync(join(tasks, name), `${text}\n`);
  };
  write("session-one", "a0001.output", transcript());
  write("session-one", "a0002.output", OTHER);
  return room;
};

const ask = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "runs", "--project", PROJECT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-home-"), TMPDIR: room },
  });

test("every row of a fixture run is what the transcript adds up to", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  const has = (line) => assert.ok(out.includes(line), `${line}\n--- printed ---\n${out}`);

  has("1 issue-flow run(s), 2026-09-01 00:00 to 2026-09-01 00:41");
  has("1 transcript(s) skipped as no issue-flow run");
  /* Sixteen calls over 2500s, 1660s of them spent waiting on a tool, so 840s is the model's. */
  has("wall            41.7 min in all, median 41.7/run, longest 41.7");
  has("where it went   27.7 min waiting on a tool (66%), 14 min model (34%)");
  has("calls           median 16/run, 16 in all, 1 never answered");
  has("to first claim  median 0.5 min");
  has("per run         1 gate, 1 test, 1 consult, 1 recheck, 1 verdict, 2 advance (1 of them after a record)");
  has("timeouts        0");
  has("edits           per run edit 0, write 0, edit heredoc 0, edit file 0, edit sed 0 · median chars/call edit 0, write 0, edit heredoc 0, edit file 0, edit sed 0");
  has("ships           1 pass(es), median 1/run, 0 resumed with --from, a push rejected in 0 run(s)");

  /* The ship call is the last of its own phase; the `pgrep` line that waits for one is a poll and
     leaves the run where it was, which is what moved every real run into `6 close` before. */
  has("0 discover      1      0.2        0        1.0  read 1 0m");
  has("3 review        1     22.8       23        2.0  forge codex whole-set 1 15m · forge codex recheck 1 5m");
  has("5 ship          1      4.8        5        1.0  ship 1 4m");
  has("6 close         1      6.0        6        6.0  poll 1 0m · forge issue 3 0m · forge advance 1 0m · git 1 0m");

  has("forge codex whole-set           15.0    54%      1");
  has("gate                             2.0     7%      1");
  has("     1  Hold — ISS-nn owes a release note.");
  has("     3  forge issue ISS-99 --full");
  has("    15.0 min  forge codex consult --send bodies plugin/src/stats/runs.mjs");
});

test("--json carries what the screen leaves out", () => {
  const run = ask(corpus(), "--json");
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.equal(held.runs, 1);
  assert.equal(held.skipped, 1);
  assert.equal(held.project, PROJECT);
  assert.match(held.root, /claude-\d+\/-fixture-project$/u);
  assert.equal(held.unanswered, 1);
  assert.deepEqual(held.perRun, {
    gate: 1, test: 1, consult: 1, recheck: 1, verdict: 1, advance: 2, advanceAfterRecord: 1,
  });
  assert.deepEqual(
    held.byClass.map(([label]) => label).sort(),
    ["forge advance", "forge claim", "forge codex recheck", "forge codex whole-set", "forge issue",
      "forge plan", "forge record verdict", "gate", "git", "poll", "read", "ship", "test"],
  );
});

test("a window is read off the run's own clock, not the file's", () => {
  const room = corpus();
  const empty = ask(room, "--since", "1d");
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /No issue-flow run under .*-fixture-project in the last 1d/u);
  assert.match(empty.stdout, /1 outside the window/u, empty.stdout);
  assert.match(empty.stdout, /name the checkout the runs were worked in with --project/u);
});

test("nothing a caller writes is opened", () => {
  const room = corpus();
  const relative = ask(room, "--project", "../elsewhere");
  assert.equal(relative.status, 1);
  assert.match(relative.stderr, /--project takes an absolute project directory, not `\.\.\/elsewhere`/u);
  assert.match(relative.stderr, /no transcript is opened by name/u);

  const window = ask(room, "--since", "last week");
  assert.equal(window.status, 1);
  assert.match(window.stderr, /--since takes a window like `3d`, `12h` or `90m`, not `last week`/u);
});

test("the subject is named, and a wrong one says which there is", () => {
  const asked = spawnSync(FORGE, ["stats", "-h"], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-home-") },
  });
  assert.equal(asked.status, 0);
  assert.match(asked.stdout, /Usage: forge stats runs/u);

  const wrong = spawnSync(FORGE, ["stats", "consults"], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-home-") },
  });
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /no subject named consults. There is: runs/u);
});

/* The classifier is the whole verb: two commands that are one call have to land in one class, and
   prose that mentions a verb has to land in none. Each of these was a wrong row in a hand profile. */
test("one class per shape of work, whatever way it was typed", () => {
  for (const [command, expected] of [
    ["./plugin/bin/forge advance ISS-99", "forge advance"],
    ["cd /w && forge advance ISS-99 2>&1 | tail -2", "forge advance"],
    ["for k in A B; do forge advance $k; done", "forge advance"],
    ["timeout 100 ./plugin/bin/forge stats runs", "forge stats"],
    ["F=./plugin/bin/forge; $F record verdict ISS-99", "shell"],
    ['echo "next: forge record verdict ISS-99" >> /tmp/notes', "shell"],
    ["grep -rn 'forge claim' docs/", "read"],
    ["cat > /tmp/c.md <<'EOF'\n1. forge and the tracker agree\nEOF", "edit file"],
    ["grep -n 'sed -i' docs/cli/stats.md", "read"],
    ["grep -rn 'python3 - <<' plugin/", "read"],
    ["node /w/tools/run.mjs review --done abc1234", "shell"],
    ["cat > /tmp/c.md <<'EOF'\n1. npm run check stays green\nEOF", "edit file"],
    ["forge codex consult --recheck plugin/src/cli.mjs", "forge codex recheck"],
    ["forge codex consult plugin/src/cli.mjs", "forge codex consult"],
    ["forge codex consult --diff --only blocker", "forge codex consult"],
    ["forge codex consult --send diffs plugin/src/cli.mjs", "forge codex consult"],
    ["echo x | forge codex consult --send bodies a.md b.md", "forge codex whole-set"],
    ["forge codex consult --send=bodies a.md", "forge codex whole-set"],
    ["forge guide contract released", "forge guide"],
    ['until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', "poll"],
    ["node /w/tools/run.mjs ship --note x", "ship"],
    ["cd /w && npm run check", "gate"],
  ]) {
    assert.equal(classOf("Bash", shellOf(command)), expected, command);
  }
  assert.equal(classOf("Read", ""), "read");
  assert.equal(classOf("WebFetch", ""), "webfetch");
});

/* One table: a phase opens on the class the call already carries, so a mention that does not earn
   the class cannot open one either. Each line below was a phase a hand profile opened too early. */
test("a phase opens on the call that makes it, not on a line that names it", () => {
  for (const [command, expected] of [
    ["forge claim ISS-99", 1],
    ["forge record baseline ISS-99 --gate 'npm run check' --result green", 2],
    ["cd /w && ./plugin/bin/forge record verdict ISS-99 --criterion 1", 4],
    ["forge codex consult --send bodies plugin/src/cli.mjs", 3],
    ["forge codex consult --diff", null],
    ["forge codex consult --recheck", null],
    ["node /w/tools/run.mjs ship", 5],
    ['until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', null],
    ['echo "next: forge record verdict ISS-99" >> /tmp/notes', null],
    ["grep -rn 'forge claim' docs/", null],
    ["grep -n 'sed -i' docs/cli/stats.md", null],
    ["cat > /tmp/c.md <<'EOF'\n1. forge record verdict is typed once\nEOF", null],
  ]) {
    assert.equal(markerOf(classOf("Bash", shellOf(command)))?.phase ?? null, expected, command);
  }
});

/* A phase number copied into the cutter is invisible until a phase is renumbered, so this case
   renumbers one. Write `marker === REVIEW && phase < BUILD` back into `segmented` and the second
   assertion fails on the cut itself, which is what makes this a checker rather than a restatement
   of the numbers the table happens to carry. */
test("the cutter reads its phase numbers off the rows that declare them", () => {
  const calls = ["forge claim", WHOLE_SET_CLASS, "forge plan", WHOLE_SET_CLASS]
    .map((klass) => ({ class: klass }));
  assert.deepEqual(segmented(calls).map((one) => one.phase), [1, 1, 2, 3],
    "a whole-set read before the plan is the plan's, and the one after it opens the review");

  const review = MARKERS.find((row) => row.after !== undefined);
  const held = { ...review };
  try {
    Object.assign(review, { phase: 4, after: 3 });
    assert.deepEqual(segmented(calls).map((one) => one.phase), [1, 1, 2, 2],
      "renumbered to open after a phase this run never reached, the cut follows the row rather than a copy of the old number");
  } finally {
    Object.assign(review, held);
  }
  assert.deepEqual(segmented(calls).map((one) => one.phase), [1, 1, 2, 3], "and the table is left as it was found");
});

/* Two consults a build takes and one it does not. The plan's comes before the plan is written and
   is the plan's; a commit gate's sends what the commit stages and belongs to the build that asked
   for it; the whole-set read after the last commit is the one the review is earned by, and the row
   opens there. Read as one class, the review row started at the first commit of the build. */
test("a consult before the plan write is the plan's, and the review opens on the one after the build", () => {
  const room = tempRoom("stats-early-consult-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const early = [
    ["e1", 0, 5, "./plugin/bin/forge claim ISS-99", "claimed"],
    ["e2", 60, 600, "forge codex consult --send bodies /tmp/plan.md", "0 findings"],
    ["e3", 700, 5, "forge plan ISS-99 /tmp/plan.md", "planned"],
    ["e4", 800, 30, "node --test plugin/test/stats/runs.test.mjs", "ok"],
    ["e5", 850, 5, "git commit -m 'the first half'", "1 file changed"],
    ["e6", 900, 300, "forge codex consult --diff --only blocker", "0 findings"],
    ["e7", 1250, 5, "git commit -m 'the second half'", "1 file changed"],
    ["e8", 1300, 240, "forge codex consult --send bodies plugin/src/stats/runs.mjs", "0 findings"],
    ["e9", 1600, 5, "forge record verdict ISS-99 --criterion 1", "recorded"],
  ];
  writeFileSync(join(tasks, "a9.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
    ...early.flatMap(([id, start, waited, command, body]) =>
      [use(id, start, "Bash", { command }), result(id, start + waited, body)]),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  const has = (line) => assert.ok(run.stdout.includes(line), `${line}\n--- printed ---\n${run.stdout}`);
  has("1 plan          1     11.0       11        2.0  forge codex whole-set 1 10m · forge claim 1 0m");
  has("2 build         1      9.9       10        5.0  forge codex consult 1 5m · test 1 1m · git 2 0m · forge plan 1 0m");
  has("3 review        1      4.8        5        1.0  forge codex whole-set 1 4m");
});

/* One call per route a run writes files through, with what each carried, and a landing that took two
   passes: the two lines the eval reads are pinned against a transcript that adds up by hand. */
test("the edits line names each route with its calls and characters, and the ships line counts passes, resumes and rejected pushes", () => {
  const room = tempRoom("stats-routes-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const bash = (id, start, command, body = "ok") => [use(id, start, "Bash", { command }), result(id, start + 2, body)];
  writeFileSync(join(tasks, "a7.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
    ...bash("r1", 10, "./plugin/bin/forge claim ISS-99", "claimed"),
    use("r2", 20, "Edit", { file_path: "/w/a.mjs", old_string: "abcd", new_string: "abcdef" }), result("r2", 21, "edited"),
    use("r3", 30, "Write", { file_path: "/w/b.md", content: "x".repeat(40) }), result("r3", 31, "written"),
    ...bash("r4", 40, "python3 - <<'EOF'\nprint(1)\nEOF"),
    ...bash("r5", 50, "cat > /w/c.txt <<'EOF'\nhello\nEOF"),
    ...bash("r6", 60, "sed -i 's/a/b/' /w/a.mjs"),
    ...bash("r7", 100, "node /w/tools/run.mjs ship", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved: rebase, then ship --from 2"),
    ...bash("r8", 200, "node /w/tools/run.mjs ship --from 2", "Released."),
    ...bash("r9", 300, "grep -n Rejected tools/run.mjs", "521: `Rejected means the remote moved: rebase, then ${SELF} ship --from 2`"),
    ...bash("r10", 310, "cat plugin/test/stats/runs.test.mjs", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved"),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  const has = (line) => assert.ok(run.stdout.includes(line), `${line}\n--- printed ---\n${run.stdout}`);
  /* Edit carries old plus new (4 + 6), Write its content (40), and each shell route its own text, newlines counted. */
  has("edits           per run edit 1, write 1, edit heredoc 1, edit file 1, edit sed 1 · median chars/call edit 10, write 40, edit heredoc 30, edit file 32, edit sed 24");
  has("ships           2 pass(es), median 2/run, 1 resumed with --from, a push rejected in 1 run(s)");
  /* A second run: the ship ran in the background, and the refusal is read off its log twice. */
  writeFileSync(join(tasks, "a8.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-98" } }),
    ...bash("s1", 10, "./plugin/bin/forge claim ISS-98", "claimed"),
    ...bash("s2", 20, "node /w/tools/run.mjs ship > /tmp/iss98-ship.log 2>&1", ""),
    ...bash("s3", 400, "tail -3 /tmp/iss98-ship.log", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved: rebase"),
    ...bash("s4", 500, "tail -3 /tmp/iss98-ship.log", "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. Rejected means the remote moved: rebase"),
  ].join("\n"));
  const both = ask(room);
  assert.equal(both.status, 0, both.stderr);
  assert.ok(both.stdout.includes("ships           3 pass(es), median 1.5/run, 1 resumed with --from, a push rejected in 2 run(s)"),
    `two runs, one rejection each\n--- printed ---\n${both.stdout}`);
});

/* The host issues several calls in one turn and they run at once. Summed, their durations exceed
   the wall clock they shared, which reported more waiting than the run took. */
test("waits that overlap are counted once against the wall clock", () => {
  assert.equal(unionSeconds([]), 0);
  assert.equal(unionSeconds([{ at: 0, endedAt: 10_000 }, { at: 4000, endedAt: 8000 }]), 10);
  assert.equal(unionSeconds([{ at: 0, endedAt: 4000 }, { at: 6000, endedAt: 9000 }]), 7);
  assert.equal(unionSeconds([{ at: 6000, endedAt: 9000 }, { at: 0, endedAt: 4000 }]), 7);

  const room = tempRoom("stats-overlap-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, "a1.output"), [
    JSON.stringify({ timestamp: at(0), message: { role: "user", content: "run the issue-flow skill" } }),
    JSON.stringify({
      timestamp: at(0),
      message: { role: "assistant", content: [
        { type: "tool_use", id: "p1", name: "Bash", input: { command: "cd /w && npm run check" } },
        { type: "tool_use", id: "p2", name: "Bash", input: { command: "node --test plugin/test" } },
      ] },
    }),
    result("p1", 600, "passed"),
    result("p2", 600, "ok"),
  ].join("\n"));
  const held = JSON.parse(ask(room, "--json").stdout);
  assert.equal(held.waitMinutes, 10, "the two shared one ten-minute wall interval");
  assert.equal(held.toolMinutes, 20, "and each spent ten tool-minutes of its own");
  assert.equal(held.modelMinutes, 0);
});

/* Six of the listing's top ten rows were not refusals: the word `refused` inside an issue body, a
   `-h` read, a grep that matched nothing, a test's failure line. And a forge call prints its
   provenance banner before it refuses, so the row that did name a refusal named the banner. */
test("the refusals listing is what this plugin refused, keyed on the line that names the rule", () => {
  const room = tempRoom("stats-refusals-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const BANNER = "forge_issues -> project forge-plugin (from .forge.json), prose as written";
  const bad = (id, start, command, body) =>
    [use(id, start, "Bash", { command }), result(id, start + 1, body, true)];
  writeFileSync(join(tasks, "a6.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-97" } }),
    use("f1", 10, "Bash", { command: "./plugin/bin/forge claim ISS-97" }), result("f1", 11, "claimed"),
    /* The banner comes first and names no rule; the refusal after it does. */
    ...bad("f2", 20, "forge advance ISS-97", `${BANNER}\nHold — ISS-97 owes a release note.`),
    /* The tracker writes a tool's refusal with the rule on the NEXT line, and a transport's inline. */
    ...bad("f3", 30, "forge comment ISS-97 /tmp/c.md", `${BANNER}\nforge_comments refused:\ndata.body: Too big: expected string to have <=500 characters`),
    ...bad("f4", 40, "forge issues --status open", `Forge refused: {"code":-32001,"message":"token expired"}`),
    /* The second of the two openers, which names the rule on the line it opens. */
    ...bad("f5", 50, "git add -A", "Refused. git add -A stages everything in the tree.\n\nInstead: name the paths.\n\nHow: `forge hooks --how bash-guard`"),
    /* A chained read printed a refusal it was reading about before the command that met one. */
    ...bad("f6", 60, "cat notes.md && forge advance ISS-97", "Hold — a quoted refusal somebody wrote down.\n\n---\n" + `${BANNER}\nHold — ISS-97 is not yours to advance.`),
    /* Three non-zero exits this plugin refused nothing about. */
    ...bad("f7", 70, "grep -rn nothing docs/", ""),
    ...bad("f8", 80, "node --test plugin/test/a.test.mjs", "# fail 1\nExit code 1"),
    ...bad("f9", 90, "cd /w && npm run check", "Gate failed: lint\nExit code 1"),
    /* A gate that denies on neither opener is still a gate: the `How:` line it ends on is what says
       so, and the rule is named on the first line because the denial is the whole result. */
    ...bad("f12", 55, "git commit -m x", "Codex has not read what this commit stages.\n\nDo this: consult it.\n\nHow: `forge hooks --how codex-second`"),
    /* The same line quoted by a document that goes on printing after it is not a refusal met. */
    use("f13", 57, "Bash", { command: "cat plugin/hooks/how/codex-second.md" }),
    result("f13", 58, "How: `forge hooks --how codex-second`\n\nand the page continues past it."),
    /* A marked line beats a verb sentence wherever each sits, because a marked refusal quotes the
       lines it was refused over and those read as verb sentences. The cost is this body: the
       `guide:` refusal is the one the call met and the row is the quoted mark above it. */
    ...bad("f11", 95, "cat notes.md && forge guide nothing", "Hold — a mark quoted from a comment.\n\nguide: one slug, not `nothing`."),
    /* And a read that exited zero carrying the word, which is what filed 178 rows under `{`. */
    use("f10", 100, "Bash", { command: "forge issue ISS-97 --full" }),
    result("f10", 101, '{\n  "description": "the write is refused when the body is empty"\n}'),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  const has = (line) => assert.ok(out.includes(line), `${line}\n--- printed ---\n${out}`);
  const hasnt = (line) => assert.ok(!out.includes(line), `still listed: ${line}\n--- printed ---\n${out}`);

  has("     1  Hold — ISS-nn owes a release note.");
  has("     1  data.body: Too big: expected string to have <=500 characters");
  has('     1  {"code":-32001,"message":"token expired"}');
  has("     1  Refused. git add -A stages everything in the tree.");
  has("     1  Hold — ISS-nn is not yours to advance.");
  hasnt(BANNER);
  hasnt("  Exit code 1");
  hasnt("forge_comments refused:");
  hasnt("the write is refused when the body is empty");
  assert.ok(!/ {5}1 {2}Hold — a quoted refusal/u.test(out),
    `the quoted refusal beat the one the call met\n--- printed ---\n${out}`);
  has("     1  Hold — a mark quoted from a comment.");
  hasnt("guide: one slug, not `nothing`.");
  has("     1  Codex has not read what this commit stages.");
  hasnt("and the page continues past it.");

  /* The three that refused nothing are counted by class instead, and none of them is listed. */
  has("other errors    3 non-zero exit(s) refused by no rule of this plugin: read 1, test 1, gate 1");
});

/* The shape is the host's: a record it changes must cost this reading one transcript, said out
   loud, rather than the corpus. */
test("a record this reading cannot parse costs it that transcript and says so", () => {
  const room = corpus();
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session-one", "tasks");
  writeFileSync(join(tasks, "a0003.output"), [
    JSON.stringify({ timestamp: at(0), message: { role: "user", content: "the issue-flow skill" } }),
    JSON.stringify({
      timestamp: at(1),
      message: { role: "assistant", content: [{ type: "tool_use", id: "b1", name: 7, input: { command: null } }] },
    }),
    result("b1", 2, "answered"),
  ].join("\n"));
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /2 issue-flow run\(s\)/u, run.stdout);
  assert.match(run.stdout, /1 transcript\(s\) skipped as no issue-flow run/u, run.stdout);
});

/* A filter silently dropped is a measurement that is materially false, and the parser this verb
   reaches for keeps any valued flag it is handed. */
test("a flag this verb does not have is refused rather than ignored", () => {
  const wrong = ask(corpus(), "--sincee", "1d");
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /No stats runs flag named --sincee/u, wrong.stderr);
  assert.match(wrong.stderr, /Did you mean: --since/u, wrong.stderr);
});

const typedCall = (id, at, name, input) =>
  JSON.stringify({ timestamp: new Date(at * 1000).toISOString(), message: { content: [{ type: "tool_use", id, name, input }] } });
const gotBack = (id, at) =>
  JSON.stringify({ timestamp: new Date(at * 1000).toISOString(), message: { content: [{ type: "tool_result", tool_use_id: id, content: "x" }] } });

/* The class no one call carries: a poll spread over turns is a read repeated, and `bash-guard.mjs`
   refuses that shape off the same function — a `.err` neither file names, so both read it from one
   home. What the profiler counts and what the gate refuses cannot drift apart on one side. */
test("a read of a log typed again is a poll, and the first read of it is not", () => {
  const typed = [
    ["a", "tail -50 /tmp/ship.log"],
    ["b", "tail -50 /tmp/ship.log"],
    ["c", "grep err /tmp/ship.log"],
    ["d", "echo checking"],
    ["e", "grep err /tmp/ship.log"],
    ["f", "npm test"],
    ["g", "grep err /tmp/ship.log"],
    ["h", "cat /tmp/build.err"],
    ["i", "cat /tmp/build.err"],
  ];
  const whole = typed
    .flatMap(([id, command], at) => [typedCall(id, at * 2 + 1, "Bash", { command }), gotBack(id, at * 2 + 2)])
    .join("\n");
  assert.deepEqual(
    callsIn(whole).calls.map((one) => one.class),
    ["read", "poll", "read", "shell", "poll", "test", "read", "read", "poll"],
  );
});

/* The gate clears its memory when it refuses, so the read past a refusal is one it allows. This counts
   the same way or the recovery it offers would be counted as the waste it was offered instead of. */
test("the third of three identical reads is the recovery, and is no more a poll than the first was", () => {
  const typed = ["tail -f /tmp/gate.log", "tail -f /tmp/gate.log", "tail -f /tmp/gate.log",
    "tail -f /tmp/gate.log", "tail -f /tmp/gate.log"];
  const whole = typed
    .flatMap((command, at) => [typedCall(`p${at}`, at * 2 + 1, "Bash", { command }), gotBack(`p${at}`, at * 2 + 2)])
    .join("\n");
  const classes = callsIn(whole).calls.map((one) => one.class);
  assert.deepEqual(classes, ["read", "poll", "read", "poll", "read"]);
  assert.equal(
    classes.filter((one) => one === "poll").length,
    2,
    "five identical reads meet the gate twice, so they count twice: one class here is one refusal there",
  );
});

/* The second read of a log is where the rejection first appears, because the first one caught the
   ship mid-push. Promoting that read to `poll` says the turn was wasted, never that its body was:
   with the fixture where both reads carry the rejection, dropping the promoted one changes no count,
   which is why this run's first read carries none (F5 of the review on ISS-490). */
test("a push rejection that only the repeated read of the log carries is still counted", () => {
  const room = tempRoom("stats-late-rejection-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const bash = (id, start, command, body = "ok") => [use(id, start, "Bash", { command }), result(id, start + 2, body)];
  const rejected = "stopped at step 6 (push to origin/master): git push origin HEAD:master exited 1. "
    + "Rejected means the remote moved: rebase, then ship --from 2";
  writeFileSync(join(tasks, "a9.output"), [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-98" } }),
    ...bash("t1", 10, "./plugin/bin/forge claim ISS-98", "claimed"),
    ...bash("t2", 20, "node /w/tools/run.mjs ship > /tmp/iss98-ship.log 2>&1", ""),
    ...bash("t3", 300, "tail -3 /tmp/iss98-ship.log", "step 5 (gate): npm run check ..."),
    ...bash("t4", 400, "tail -3 /tmp/iss98-ship.log", rejected),
  ].join("\n"));
  const said = ask(room);
  assert.equal(said.status, 0, said.stderr);
  assert.match(said.stdout, /a push rejected in 1 run\(s\)/u, said.stdout);
});
