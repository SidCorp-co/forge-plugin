/* The three profilers this verb replaces were run once each and thrown away, so nothing held their
   arithmetic to anything. Every row the verb prints is pinned here against a transcript small
   enough to add up by hand. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "../../src/flow/record.mjs";
import { UNTIERED, classOf, markerOf, shellOf, slugFor, tierOf } from "../../src/stats/transcripts.mjs";
import { unionSeconds } from "../../src/stats/runs.mjs";
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
  ["c6", 400, 900, "forge codex consult --diff --only blocker", "1 finding"],
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
  assert.equal(tierOf([said("forge record confirmation", wrote(trivial))], TIERS), trivial);
  assert.equal(tierOf([], TIERS), UNTIERED, "a run that confirmed nothing is filed under no tier");
  for (const klass of ["forge issue", "forge resume", "read", "forge record verdict"]) {
    assert.equal(tierOf([said(klass, wrote(trivial))], TIERS), UNTIERED,
      `\`${klass}\` printing the record is a run reading a thread, not a run that claimed a tier`);
  }
  assert.equal(tierOf([said("forge record confirmation", wrote("enormous"))], TIERS), UNTIERED,
    "a word this ladder has not got names no rung, and is not folded into the nearest one");
  assert.equal(tierOf([said("forge record confirmation", `${wrote(trivial)}\n\ntier: ${feature}`)], TIERS), trivial,
    "and a line the same call printed after the record is prose: the class covers the shell, not the write");
  assert.equal(
    tierOf([said("forge record confirmation", wrote(trivial)), said("forge record confirmation", wrote(feature))], TIERS),
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
  assert.equal(tierOf([said("forge record confirmation", written)], TIERS), trivial,
    "so the stamped key decides, and a sentence a person typed under another field does not");
  assert.equal(tierOf([said("forge record confirmation", `${wrote(trivial)}\n\n${wrote(feature)}`)], TIERS), trivial,
    "and the record the write printed is the first one: a thread read after it belongs to another issue");
  assert.equal(tierOf([said("forge record confirmation", wrote(feature))], TIERS), feature,
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

  /* The ship call is the last of its own phase; the `pgrep` line that waits for one is a poll and
     leaves the run where it was, which is what moved every real run into `6 close` before. */
  has("0 discover      1      0.2        0        1.0  read 1 0m");
  has("3 review        1     22.8       23        2.0  forge codex consult 1 15m · forge codex recheck 1 5m");
  has("5 ship          1      4.8        5        1.0  ship 1 4m");
  has("6 close         1      6.0        6        6.0  poll 1 0m · forge issue 3 0m · forge advance 1 0m · git 1 0m");

  has("forge codex consult             15.0    54%      1");
  has("gate                             2.0     7%      1");
  has("     1  Hold — ISS-nn owes a release note.");
  has("     3  forge issue ISS-99 --full");
  has("    15.0 min  forge codex consult --diff --only blocker");
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
    ["forge advance", "forge claim", "forge codex consult", "forge codex recheck", "forge issue",
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
    ["cat > /tmp/c.md <<'EOF'\n1. forge and the tracker agree\nEOF", "edit"],
    ["cat > /tmp/c.md <<'EOF'\n1. npm run check stays green\nEOF", "edit"],
    ["forge codex consult --recheck plugin/src/cli.mjs", "forge codex recheck"],
    ["forge codex consult plugin/src/cli.mjs", "forge codex consult"],
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
    ["cd /w && ./plugin/bin/forge record verdict ISS-99 --criterion 1", 4],
    ["forge codex consult --diff", 3],
    ["forge codex consult --recheck", null],
    ["node /w/tools/run.mjs ship", 5],
    ['until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', null],
    ['echo "next: forge record verdict ISS-99" >> /tmp/notes', null],
    ["grep -rn 'forge claim' docs/", null],
    ["cat > /tmp/c.md <<'EOF'\n1. forge record verdict is typed once\nEOF", null],
  ]) {
    assert.equal(markerOf(classOf("Bash", shellOf(command))), expected, command);
  }
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
