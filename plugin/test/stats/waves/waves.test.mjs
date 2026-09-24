/* A wave's cost and its mistakes are read off the records it left: its headline's wave and fold
   records, its members' lease history and its dispatcher's own session. Each case fails without its
   part of the reading (ISS-460). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("waves-");
const { PROJECT, REFUSED_BODY, at, dispatch, fold, readsOf, row, standing, took } = await import("../fixture-waves.mjs");
const { claimed } = await import("../../../src/flow/lease.mjs");
const { handBacksOf, rowOf, waveLines } = await import("../../../src/stats/waves/profile.mjs");
const { refusalIn } = await import("../../../src/stats/runs.mjs");
const { USAGE } = await import("../../../src/stats/stats.mjs");

const DISPATCHER = [
  [5, "forge next"],
  [8, "forge record wave ISS-1 --member ISS-3 --role forge:triage --session read-a"],
  [10, "forge record wave ISS-1 --member ISS-2 --member ISS-3 --role forge:runner --session run-a"],
  [15, "forge record confirmation ISS-7 --finding already-fixed --evidence x"],
  [16, "forge record confirmation ISS-8 --finding duplicate --evidence x"],
  [17, "forge record confirmation ISS-9 --finding holds --evidence x"],
  [18, "forge advance ISS-99", { body: REFUSED_BODY, error: true }],
  [20, "forge record wave ISS-1 --member ISS-2 --role forge:runner --session run-b"],
  [25, "forge record wave ISS-1 --member ISS-3 --role forge:runner --session run-a"],
  [30, "forge record fold ISS-5 --summary refused", { body: REFUSED_BODY, error: true }],
  [60, "forge record fold ISS-1 --summary first"],
  [95, "forge next"],
  [100, "forge record wave ISS-1 --member ISS-4 --member ISS-2 --role forge:runner --session run-c"],
  [110, "git status --short"],
];

const PROFILED = [
  row(1, "open"),
  row(2, "closed", { sessionContext: { lease: { holder: "run", history: [
    took(30, "head-owed"), took(40, "head-owed"), took(50, "ready"), took(105, "head-owed"),
  ] } } }),
  row(3, "dropped"),
  row(4, "open"),
  row(5, "open"),
  row(6, "open"),
];
const PAGES = {
  "uuid-1": [
    dispatch(8, ["ISS-3"], "read-a", "forge:triage"), dispatch(10, ["ISS-2", "ISS-3"], "run-a"), dispatch(20, ["ISS-2"], "run-b"), dispatch(25, ["ISS-3"], "run-a"),
    fold(60, "first"), dispatch(100, ["ISS-4", "ISS-2"], "run-c"),
  ],
  "uuid-5": [fold(30, "never read")],
  "uuid-6": [fold(40, "a subagent's")],
};

test("one row per wave off the dispatcher's own session, oldest first, with what went wrong in each", async () => {
  const { project, tracker, forge } = await standing(PROFILED, PAGES, { "dispatcher-one": DISPATCHER },
    [[40, "forge record fold ISS-6 --summary x"]]);
  try {
    const json = await forge("stats", "waves", "--checkout", PROJECT, "--json");
    assert.equal(json.status, 0, json.stderr);
    const { waves } = JSON.parse(json.stdout);
    assert.deepEqual(waves.map((one) => [one.headline, one.state]), [["ISS-1", "folded"], ["ISS-1", "open"]]);
    const [first, open] = waves;
    /* From its first `forge next` to its fold, and from the next one to its last call while open. */
    assert.equal(first.minutes, 55);
    assert.equal(open.minutes, 15);
    assert.equal(first.handBacks, 2);
    assert.equal(open.handBacks, 1);
    assert.deepEqual(first.replaced, ["ISS-2"], "ISS-3 read under one session and run under another is no replacement, nor is being named twice under one");
    assert.deepEqual(first.dispositions, { "already-fixed": 1, duplicate: 1 });
    const refused = refusalIn({ body: REFUSED_BODY, error: true });
    assert.deepEqual(first.refusals, { [refused]: 2 });
    assert.deepEqual(first.outcomes, { closed: 1, dropped: 1 });
    assert.deepEqual(open.unreadable.map((one) => one.key), ["ISS-4"]);
    /* A refused fold names a headline nobody reads, and a subagent's write is no dispatcher's. */
    assert.equal(readsOf(project, "forge_comments", "list", "uuid-5").length, 0);
    assert.equal(readsOf(project, "forge_comments", "list", "uuid-6").length, 0);
    /* One member read is however many requests a read costs: ISS-2, named by three dispatches in two
       waves, costs what ISS-4 named once does. */
    const gets = (id) => readsOf(project, "forge_issues", "get", id).length;
    assert.ok(gets("uuid-4") > 0);
    assert.equal(gets("uuid-2"), gets("uuid-4"), "each member is read once");

    const shown = await forge("stats", "waves", "--checkout", PROJECT);
    assert.equal(shown.status, 0, shown.stderr);
    const lines = shown.stdout.split("\n");
    const folded = lines.findIndex((one) => /^ISS-1 {2}folded /u.test(one));
    const opened = lines.findIndex((one) => /^ISS-1 {2}open /u.test(one));
    assert.ok(folded > 0 && opened > folded, shown.stdout);
    assert.match(shown.stdout, /55 min, 11 call\(s\)/u);
    assert.match(shown.stdout, /hand-backs 2; replaced ISS-2; disposed without a run already-fixed 1, duplicate 1/u);
    assert.match(shown.stdout, /ISS-4 unreadable: .*not this project's/u);
  } finally {
    tracker.close();
  }
});

test("a member whose kept history no longer reaches the wave's start is a lower bound, named", () => {
  let context = claimed(null, { holder: "run", at: at(30), how: "claim", landing: { state: "head-owed" } });
  for (let minute = 31; minute < 43; minute += 1) {
    context = claimed(context, { holder: "run", at: at(minute), how: "claim", landing: { state: "ready" } });
  }
  const member = { body: { sessionContext: context } };
  assert.equal(context.lease.history.length, 12);
  assert.deepEqual(handBacksOf(member, Date.parse(at(0)), Date.parse(at(60))), { count: 0, cut: true });
  assert.deepEqual(handBacksOf(member, Date.parse(at(35)), Date.parse(at(60))), { count: 0, cut: false });
  const wave = { state: "folded", dispatches: [{ members: ["ISS-2"], session: "run-a" }], fold: { summary: "cut" } };
  const span = { from: Date.parse(at(0)), to: Date.parse(at(60)), sessions: [], calls: [] };
  const held = rowOf({ ref: "ISS-1", wave, span, members: [{ key: "ISS-2", ...member }], copies: [] });
  assert.deepEqual(held.handBacksCut, ["ISS-2"]);
  assert.match(waveLines(held).join("\n"), /hand-backs at least 0, history cut on ISS-2;/u);
});

test("the verb is listed and its help names every flag it reads", async () => {
  assert.match(USAGE, /\|waves[|>]/u);
  const { tracker, forge } = await standing(PROFILED, {}, {}, null, ["forge_issues", "forge_comments"]);
  try {
    const help = await forge("stats", "waves", "-h");
    assert.equal(help.status, 0);
    for (const flag of ["--since", "--checkout", "--json"]) assert.match(help.stdout, new RegExp(flag, "u"));
    const stranger = await forge("stats", "waves", "--size", "3");
    assert.equal(stranger.status, 1);
    assert.match(stranger.stderr, /--checkout/u, stranger.stderr);
  } finally {
    tracker.close();
  }
});

/* One dispatcher session heading two waves in turn, each on a headline of its own, and a page from
   before the empty-fold refusal: the second wave starts after the first one's fold, and a fold that
   closed nothing is no wave. */
test("a session's second wave on another headline starts after its first one's fold, and an empty fold is no wave", async () => {
  const pages = {
    "uuid-1": [dispatch(10, ["ISS-2"], "run-a"), fold(20, "the first")],
    "uuid-8": [dispatch(35, ["ISS-3"], "run-b"), fold(50, "the second")],
    "uuid-9": [fold(55, "closed nothing")],
  };
  const issues = [row(1, "open"), row(2, "closed"), row(3, "closed"), ...[4, 5, 6, 7].map((n) => row(n, "open")),
    row(8, "open"), row(9, "open")];
  const calls = [
    [5, "forge next"],
    [10, "forge record wave ISS-1 --member ISS-2 --role forge:runner --session run-a"],
    [20, "forge record fold ISS-1 --summary the-first"],
    [30, "forge next"],
    [35, "forge record wave ISS-8 --member ISS-3 --role forge:runner --session run-b"],
    [50, "forge record fold ISS-8 --summary the-second"],
    [55, "forge record fold ISS-9 --summary closed-nothing"],
  ];
  const { tracker, forge } = await standing(issues, pages, { dispatcher: calls });
  try {
    const json = await forge("stats", "waves", "--checkout", PROJECT, "--json");
    assert.equal(json.status, 0, json.stderr);
    const { waves } = JSON.parse(json.stdout);
    assert.deepEqual(waves.map((one) => [one.headline, one.minutes]), [["ISS-1", 15], ["ISS-8", 20]]);
  } finally {
    tracker.close();
  }
});
