/* The two tables a run's time is divided by; what one call is read as is `runs.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PHASES, methodOf } from "../../src/guides/phases.mjs";
import { MARKERS, RUNG_UNKNOWN, markerOf, shellOf } from "../../src/stats/corpus/transcripts.mjs";
import { WHOLE_SET_CLASS, classOf, classesFor } from "../../src/stats/corpus/classes.mjs";
import { slugFor } from "../../src/stats/corpus/corpus.mjs";
import { runFrom, segmented } from "../../src/stats/runs.mjs";
import { RUNGS } from "../../src/ladder.mjs";
import { tempRoom } from "../fixtures.mjs";
import { PROJECT, ask, at, corpus, result, use } from "./fixture-runs.mjs";

/* Through the classifier, so a case proves the whole chain: the words typed, the class, the row.
   `classes` is given where a case is about a row the release model arms, which the default table has
   not got. */
const phasesOf = (commands, classes = undefined) =>
  segmented(commands.map((command) => ({ class: classOf("Bash", shellOf(command), classes) })))
    .map((one) => one.phase);

const ARMED = classesFor(null, { key: "deploy", deploy: true });

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
    ["node /w/tools/run.mjs finish ISS-99", 8],
    ["node /w/tools/run.mjs finish-now ISS-99", null],
    ["node /w/tools/run.mjs ship-it", null],
    ["forge record gap ISS-99 --none 'the method answered'", 8],
    ["forge knowledge write module-stats /tmp/body.md --kind reference", 8],
    ["forge knowledge search 'the phase table'", null],
    ['until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', null],
    ['pgrep -f "tools/run.mjs finish"', null],
    ['echo "next: forge record verdict ISS-99" >> /tmp/notes', null],
    ["grep -rn 'forge claim' docs/", null],
    ["grep -n 'sed -i' docs/cli/stats.md", null],
    ["cat > /tmp/c.md <<'EOF'\n1. forge record verdict is typed once\nEOF", null],
  ]) {
    assert.equal(markerOf(classOf("Bash", shellOf(command)))?.phase ?? null, expected, command);
  }
  assert.equal(markerOf("forge record verdict"), null,
    "the verdicts are the proving phase's own writes, so they open nothing: the note past them is that boundary");
  assert.equal(classOf("Bash", shellOf("forge knowledge search 'the phase table'")), "forge knowledge search",
    "the store is read in phase 0 and written in the last one, so one row over both filed a run's opening read under what it learned");
  assert.equal(classOf("Bash", shellOf("forge knowledge write module-stats /tmp/body.md --kind reference")),
    "forge knowledge write");
});

/* The method's phase 7 runs from the landing to the close, and the phase after it is the cleanup and
   the learning. The ship row once closed its own phase, so the run went to 8 at its first landing
   call and nothing moved it out: the release wait, a resumed landing, a post-ship gate, the
   verification and the close were all booked to a row labelled for learning (ISS-1714). */
test("the tail after the landing is the shipping phase's, and the cleanup or a learning write opens the last one", () => {
  assert.deepEqual(phasesOf([
    "forge claim ISS-99",
    "forge record baseline ISS-99 --gate 'npm run check' --result green",
    "forge codex consult --send bodies plugin/src/stats/runs.mjs",
    "node /w/tools/run.mjs ship --note x",
    'until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done',
    "npm run check",
    "node /w/tools/run.mjs ship --from 6",
    "forge record verification ISS-99 --where prod --evidence x",
    "forge advance ISS-99",
    "node /w/tools/run.mjs finish ISS-99",
    "forge record gap ISS-99 --none 'the method answered'",
    "forge knowledge write module-stats /tmp/body.md --kind reference",
    "cat plugin/src/stats/runs.mjs",
  ]), [1, 4, 5, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8],
  "the release wait, the second landing, the post-ship gate, the verification and the close are the"
  + " shipping phase's, and the cleanup opens the phase after it");
});

/* `after` on the last row rather than a rule inside the cutter: the method types a gap where the run
   met it and reads the knowledge store at phase 0, and without the guard either would take a run
   that landed nothing to the last phase. */
test("phase 7 opens on the act the contract asks that project for, and the verification record is one of them", () => {
  const upTo5 = [
    "forge claim ISS-99",
    "forge record baseline ISS-99 --gate 'npm run check' --result green",
    "forge codex consult --send bodies plugin/src/stats/runs.mjs",
  ];
  /* Each of the three ways a change reaches production, and no declared command anywhere: the point
     is a project that types none, where the phase read `unrecognised` before (ISS-1975). */
  for (const [landing, what] of [
    ["forge record verification ISS-99 --where prod --evidence x", "a deploy the project does not command"],
    ["forge claim ISS-99 --pushed --ready", "a checkpoint another actor lands"],
  ]) {
    assert.deepEqual(phasesOf([...upTo5, landing, "curl -s https://host/version",
      "forge record gap ISS-99 --none 'the method answered'"]), [1, 4, 5, 7, 7, 8],
    `${what} opens the phase, and the phase behind it is reachable`);
  }
});

test("the before-merge order keeps its earlier phases", () => {
  /* The order every project whose production deploys on its own runs in: the landing mark and the
     deploy act fall inside the implement and prove phases, and the verification is the one act of
     the phase after them. Read as openers, the mark or the deploy row would take those calls
     (ISS-1975). */
  assert.deepEqual(phasesOf([
    "forge claim ISS-99",
    "forge record baseline ISS-99 --gate 'npm run check' --result green",
    "cat plugin/src/stats/runs.mjs",
    "forge record merged ISS-99 --head abc1234 --branch iss-99",
    "coolify deploy --uuid abc --yes",
    "forge codex consult --send bodies plugin/src/stats/runs.mjs",
    "until s=$(coolify deployment get --uuid abc); do sleep 20; done",
    "forge record verdict ISS-99 --criterion 1 --verdict pass --evidence x",
    "forge record note ISS-99 --section Fixed --user x",
    "forge record verification ISS-99 --where prod --evidence x",
    "forge advance ISS-99",
  ], ARMED), [1, 4, 4, 4, 4, 5, 5, 5, 6, 7, 7],
  "the mark and both deploy calls stay in the phase the run was in, and phase 7 opens at the"
  + " verification and nowhere before it");
});

test("a run that made no landing call reaches the last phase through none of its openers", () => {
  const opened = [
    "forge claim ISS-99",
    "forge record baseline ISS-99 --gate 'npm run check' --result green",
  ];
  for (const [command, what] of [
    ["forge knowledge write module-stats /tmp/body.md --kind reference", "a write to the store"],
    ["forge record gap ISS-99 --where phase-5 --lacked x --did y", "a gap typed where it was met"],
    ["node /w/tools/run.mjs finish ISS-99", "a workspace ended early"],
  ]) {
    assert.deepEqual(phasesOf([...opened, command, "cat plugin/src/cli.mjs"]), [1, 4, 4, 4],
      `${what} before any landing is the phase the run was already in, and opens nothing`);
  }
});

/* The label is held to the method's own heading rather than typed beside it: `8 Learn` named the
   second half of a phase whose first half is the cleanup, and the bucket it labelled held neither
   (ISS-1714). */
test("the last phase is labelled for the work the method defines at that number", () => {
  const part = readFileSync(new URL("../../guides/skills/issue-flow/default/guide/12-phase-8.md",
    import.meta.url), "utf8");
  const heading = /^## Phase (\d+) — (.+)$/mu.exec(part);
  assert.equal(Number(heading[1]), PHASES.length - 1, "which is the number the last row carries");
  assert.equal(PHASES.at(-1), `${heading[1]} ${heading[2].split(",")[0]}`, heading[2]);
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
    ["e4", 800, 30, "node --test plugin/test/stats/runs/runs.test.mjs", "ok"],
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
const noteRunOf = (order) => {
  const upTo5 = [
    ["p1", 10, "forge claim ISS-99"],
    ["p2", 20, "forge record baseline ISS-99 --gate 'npm run check' --result green"],
    ["p3", 30, "forge codex consult --send bodies plugin/src/cli.mjs"],
  ];
  const note = ["forge record note ISS-99 --section Fixed --user x"];
  const ship = ["node /w/tools/run.mjs ship"];
  const tail = {
    before: [[50, ...note], [70, "npm run check"], [90, ...ship]],
    after: [[50, ...ship], [70, "npm run check"], [90, ...note]],
    shipping: [[50, ...ship], [70, ...note], [90, "cat plugin/src/cli.mjs"]],
    cleaned: [[50, ...ship], [70, "node /w/tools/run.mjs finish ISS-99"], [90, ...note],
      [110, "cat plugin/src/cli.mjs"]],
    unshipped: [[50, ...note], [70, "npm run check"], [90, "forge claim ISS-99 --pushed --ready"]],
  }[order];
  const calls = [...upTo5, ...tail.map(([start, command], n) => [`n${n}`, start, command])];
  /* The closing report, well after the last result, so the tail the fold credits is a figure a case can read. */
  const report = JSON.stringify({ timestamp: at(400), message: { role: "assistant", content: [{ type: "text", text: "done" }] } });
  const text = [
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
    ...calls.flatMap(([id, start, command]) =>
      [use(id, start, "Bash", { command }), result(id, start + 5, "done")]),
    report,
  ].join("\n");
  return runFrom("/f/a.output", "s", text);
};
const noteRun = (order) => noteRunOf(order).phases;

test("the note is counted in phase 6 in either order, and opens no segment behind it", () => {
  const late = noteRun("after");
  assert.equal(late[6].calls, 1, "a note posted after the landing is phase 6 work, not the last phase's");
  assert.equal(late[8].calls, 0, "and the gate between the ship and it stays where the run was, which is shipping");
  assert.equal(late[5].calls, 1, "the whole-set read that opened the proving is still its own phase's");
  assert.equal(late[7].calls, 2, "the ship opens its own phase and the gate after it is that phase's");

  const shipping = noteRun("shipping");
  assert.equal(shipping[6].calls, 1, "a note posted between the landing and the close is phase 6 work");
  assert.equal(shipping[7].calls, 2,
    "and the call after it is the shipping phase's, the note having moved the phase for nothing behind it");
  assert.equal(shipping[8].calls, 0, "which is the phase no call of this run opened");

  const cleaned = noteRun("cleaned");
  assert.equal(cleaned[6].calls, 1, "a note posted once the cleanup has opened the last phase is still phase 6 work");
  assert.equal(cleaned[8].calls, 2,
    "and the call after it is the last phase's, the note moving the phase for nothing behind it either side of that boundary");
  assert.equal(cleaned[7].calls, 1, "the landing alone, the cleanup having closed the phase it opened");

  const early = noteRun("before");
  assert.equal(early[6].calls, 1, "a note posted before the ship is the same one call");
  assert.equal(early[5].calls, 2,
    "and the pre-ship gate is the phase the run was already in, never the note's");
  assert.equal(early[7].calls, 1);

  const never = noteRun("unshipped");
  assert.equal(never[6].calls, 1, "a run under a ship mode that lands nothing posts its note all the same");
  assert.equal(never[5].calls, 2,
    "and the call after it is the phase the run was in, where once the note swallowed the rest of the run");
  assert.equal(never[7].calls, 1,
    "the checkpoint it leaves instead of a ship is the landing, and opens the phase the landing opens");
});

/* The note's row books its call at 6 and leaves the run where it was, so a run whose last call is
   the note is still shipping when it closes, and the report after it is the shipping phase's. */
test("the closing report is the phase the run stands in, never the phase the last call's row books", () => {
  const late = noteRun("after");
  assert.equal(late[6].seconds, 20, "the note keeps its own interval, from the gate's result to its own");
  assert.equal(late[7].seconds, 345,
    "and the 305 seconds from its result to the report land in the shipping phase with the ship and the gate");
});

/* The mode that lands a batch calls no ship and leaves the ready checkpoint, which is the landing
   the phase table already opens on, so the order is read against it as against a ship. */
test("a note posted before the ready checkpoint is posted before the landing", () => {
  assert.equal(noteRunOf("unshipped").notes, "before", "a run that left the checkpoint reached the landing");
  assert.equal(noteRunOf("unshipped").reached, true, "and says so on the one reader every verb spends");
  assert.equal(noteRunOf("before").notes, "before");
  assert.equal(noteRunOf("after").notes, "after");
});

test("the profile says which order each run took over the note and the landing", () => {
  const run = ask(corpus());
  assert.match(run.stdout, /^notes {11}0 posted before the landing, 0 after it, 0 in a run that never reached it$/mu,
    "the fixture run posts none, and three zeroes is the answer rather than a missing line");
  assert.equal(segmented([{ class: "forge record note" }, { class: "read" }])[1].phase, 0,
    "the note moves the phase for nothing after it, which is what the two orders need");
});
