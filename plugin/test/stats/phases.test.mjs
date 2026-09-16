/* The two tables a run's time is divided by; what one call is read as is `runs.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PHASES, methodOf } from "../../src/guides/phases.mjs";
import { MARKERS, RUNG_UNKNOWN, markerOf, shellOf } from "../../src/stats/transcripts.mjs";
import { WHOLE_SET_CLASS, classOf } from "../../src/stats/classes.mjs";
import { slugFor } from "../../src/stats/corpus.mjs";
import { runFrom, segmented } from "../../src/stats/runs.mjs";
import { RUNGS } from "../../src/ladder.mjs";
import { tempRoom } from "../fixtures.mjs";
import { PROJECT, ask, at, corpus, result, use } from "./fixture-runs.mjs";

test("the table has a row per rung and one for the runs that named none, and they add up", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const table = run.stdout.split("\nrung ")[1]?.split("\nphase")[0] ?? "";
  assert.ok(table, `no rung table printed\n--- printed ---\n${run.stdout}`);
  const rows = new Map(table.split("\n").map((line) => line.trim().split(/\s+/u))
    .filter(([name, runs]) => name && /^\d+$/u.test(runs ?? ""))
    .map(([name, runs]) => [name, Number(runs)]));
  for (const rung of [...RUNGS, RUNG_UNKNOWN]) {
    assert.ok(rows.has(rung), `${rung} has no row, and a rung absent reads as one that costs nothing`);
  }
  assert.equal([...rows.values()].reduce((sum, one) => sum + one, 0), 1,
    "the rows count the corpus once: this fixture is one run, and it claimed no rung");
  assert.equal(rows.get(RUNG_UNKNOWN), 1, "so it is the unknown row that holds it, not the cheapest rung");
});

/* One table: a phase opens on the class the call already carries, so a mention that does not earn
   the class cannot open one either. Each line below was a phase a hand profile opened too early. */
test("a phase opens on the call that makes it, not on a line that names it", () => {
  for (const [command, expected] of [
    ["forge claim ISS-99", 1],
    ["forge record confirmation ISS-99 --where cli.mjs --is 'a' --finding holds", 2],
    ["forge record decision ISS-99 --goal fr-02", 3],
    ["forge record baseline ISS-99 --gate 'npm run check' --result green", 4],
    ["forge codex consult --send bodies plugin/src/cli.mjs", 5],
    ["cd /w && ./plugin/bin/forge record note ISS-99 --section Fixed --user 'it works'", 6],
    ["forge codex consult --diff", null],
    ["forge codex consult --recheck", null],
    ["node /w/tools/run.mjs ship", 7],
    ['until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', null],
    ['echo "next: forge record verdict ISS-99" >> /tmp/notes', null],
    ["grep -rn 'forge claim' docs/", null],
    ["grep -n 'sed -i' docs/cli/stats.md", null],
    ["cat > /tmp/c.md <<'EOF'\n1. forge record verdict is typed once\nEOF", null],
  ]) {
    assert.equal(markerOf(classOf("Bash", shellOf(command)))?.phase ?? null, expected, command);
  }
  assert.equal(markerOf("forge record verdict"), null,
    "the verdicts are the proving phase's own writes, so they open nothing: the note past them is that boundary");
});

/* One table for the method and the miner, or a brief that says "start at phase 5" and a row that
   says phase 5 cost eleven minutes are two numbers that look like one (ISS-700). */
test("the phases the miner counts are the phases the method names", () => {
  assert.equal(PHASES.length, 9, "0 through 8, indexed by the number the guide prints");
  for (const { phase } of MARKERS) {
    assert.match(PHASES[phase] ?? "", new RegExp(`^${phase} `, "u"), `phase ${phase} has a row of its own`);
  }
  assert.equal(methodOf("developed").phase, PHASES[5], "which is the phase the resume header owes");
  assert.ok(methodOf("in_progress").phase.includes(PHASES[4]), methodOf("in_progress").phase);
});

/* The closing report is generation after the final tool result: it counts in the run's wall and in
   its model share, and folded into no phase it left the phases summing short of the run by exactly
   that report, understating the phase every run ends in (ISS-308, criteria 3 and 4). The second
   fixture is the one that refuses the easy fix: measured from the LAST call's end rather than from
   the latest end, an overlapping pair whose later call returned first pushes the phases past the
   wall (consult 51ec08 F3). */
test("the phases sum to the wall, the closing report counted in the phase the run ended in", () => {
  const closing = [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
    use("s1", 10, "Bash", { command: "forge claim ISS-99" }),
    result("s1", 20, "claimed"),
    use("s2", 30, "Bash", { command: "node /w/tools/run.mjs ship" }),
    result("s2", 90, "landed"),
    JSON.stringify({ timestamp: at(150), message: { role: "assistant", content: [{ type: "text", text: "what landed" }] } }),
  ].join("\n");
  const run = runFrom("/p", "s", closing);
  assert.equal(run.seconds, 150, "the wall is the transcript's own bounds, the report included");
  assert.equal(run.phases.reduce((many, one) => many + one.seconds, 0), run.seconds,
    "so the phases add up to the run rather than to the last call");
  assert.equal(run.phases[7].seconds, 130,
    "70s of ship and the 60s of report after it, in the phase the ship was in and not the one after");

  const overlapped = [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-98" } }),
    use("o1", 0, "Bash", { command: "forge claim ISS-98" }),
    use("o2", 0, "Bash", { command: "git status --short" }),
    result("o2", 20, "clean"),
    result("o1", 40, "claimed"),
  ].join("\n");
  const held = runFrom("/p", "s", overlapped);
  assert.equal(held.seconds, 40);
  assert.equal(held.phases.reduce((many, one) => many + one.seconds, 0), 40,
    "a turn's pair whose later call returned first adds its tail once, and the phases never exceed the wall");
});

/* A phase number copied into the cutter is invisible until a phase is renumbered, so this case
   renumbers one. Write `marker === REVIEW && phase < BUILD` back into `segmented` and the second
   assertion fails on the cut itself, which is what makes this a checker rather than a restatement
   of the numbers the table happens to carry. */
test("the cutter reads its phase numbers off the rows that declare them", () => {
  const calls = ["forge claim", WHOLE_SET_CLASS, "forge record plan", WHOLE_SET_CLASS]
    .map((klass) => ({ class: klass }));
  assert.deepEqual(segmented(calls).map((one) => one.phase), [1, 1, 4, 5],
    "a whole-set read before the plan is the plan's, and the one after it opens the proving");

  const review = MARKERS.find((row) => row.after !== undefined);
  const held = { ...review };
  try {
    Object.assign(review, { phase: 6, after: 5 });
    assert.deepEqual(segmented(calls).map((one) => one.phase), [1, 1, 4, 4],
      "renumbered to open after a phase this run never reached, the cut follows the row rather than a copy of the old number");
  } finally {
    Object.assign(review, held);
  }
  assert.deepEqual(segmented(calls).map((one) => one.phase), [1, 1, 4, 5], "and the table is left as it was found");
});

/* The plan's consult comes before the plan is written and is the plan's; a commit gate's belongs to
   the build; the whole-set read after the last commit is the one the review row opens on. */
test("a consult before the plan write is the plan's, and the review opens on the one after the build", () => {
  const room = tempRoom("stats-early-consult-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const early = [
    ["e1", 0, 5, "./plugin/bin/forge claim ISS-99", "claimed"],
    ["e2", 60, 600, "forge codex consult --send bodies /tmp/plan.md", "0 findings"],
    ["e3", 700, 5, "forge record plan ISS-99 /tmp/plan.md", "planned"],
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
  has("1 Triage        1     11.0       11        2.0  forge codex whole-set 1 10m · forge claim 1 0m");
  has("4 Implement     1      9.9       10        5.0  forge codex consult 1 5m · test 1 1m · git 2 0m · forge record plan 1 0m");
  has("5 Prove         1      5.8        6        2.0  forge codex whole-set 1 4m · forge record verdict 1 0m");
});

/* One call per route a run writes files through, with what each carried, and a landing that took two
   passes: the two lines the eval reads are pinned against a transcript that adds up by hand. */

/* The method posts the note after the landing under one ship mode and before the ready checkpoint
   under the other, so a marker that opened a segment measured neither order's phase 6: the late
   note fell into phase 8, and the early one swallowed every call to the end of a run that never
   invoked the ship at all (ISS-1583). */
const noteRun = (order) => {
  const upTo5 = [
    ["p1", 10, "forge claim ISS-99"],
    ["p2", 20, "forge record baseline ISS-99 --gate 'npm run check' --result green"],
    ["p3", 30, "forge codex consult --send bodies plugin/src/cli.mjs"],
  ];
  const calls = [...upTo5, ...(order === "before"
    ? [["n1", 50, "forge record note ISS-99 --section Fixed --user x"],
      ["n2", 70, "npm run check"],
      ["n3", 90, "node /w/tools/run.mjs ship"]]
    : [["n1", 50, "node /w/tools/run.mjs ship"],
      ["n2", 70, "npm run check"],
      ["n3", 90, "forge record note ISS-99 --section Fixed --user x"]])];
  const text = [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
    ...calls.flatMap(([id, start, command]) =>
      [use(id, start, "Bash", { command }), result(id, start + 5, "done")]),
  ].join("\n");
  return runFrom("/f/a.output", "s", text).phases;
};

test("the note is counted in phase 6 in either order, and opens no segment behind it", () => {
  const late = noteRun("after");
  assert.equal(late[6].calls, 1, "a note posted after the landing is phase 6 work, not phase 8's");
  assert.equal(late[8].calls, 1, "and the gate between the ship and it stays where the run was");
  assert.equal(late[5].calls, 1, "the whole-set read that opened the proving is still its own phase's");
  assert.equal(late[7].calls, 1, "the ship is the last call of its own phase");

  const early = noteRun("before");
  assert.equal(early[6].calls, 1, "a note posted before the ship is the same one call");
  assert.equal(early[5].calls, 2,
    "and the pre-ship gate is the phase the run was already in, never the note's");
  assert.equal(early[7].calls, 1);
});

test("the profile says which order each run took over the note and the ship", () => {
  const run = ask(corpus());
  assert.match(run.stdout, /^notes {11}0 posted before a ship, 0 after one, 0 in a run that never shipped$/mu,
    "the fixture run posts none, and three zeroes is the answer rather than a missing line");
  assert.equal(segmented([{ class: "forge record note" }, { class: "read" }])[1].phase, 0,
    "the note moves the phase for nothing after it, which is what the two orders need");
});
