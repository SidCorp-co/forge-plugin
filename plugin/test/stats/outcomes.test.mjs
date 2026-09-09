/* The half of the eval no cost figure can answer for. Every case here is one an optimizer could
   otherwise pass by making runs worse: a join that credits the wrong run, a population that shrank
   printed as a rate that fell, an outcome counted over one window's weeks and another's day. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { claimedIn, pairedOneToOne, parkWritersIn, rulingsIn } from "../../src/stats/joined.mjs";
import {
  AFTER_RUN, DURING_RUN, UNAVAILABLE, budgetOf, outcomesOf, pairsOf, parkedFor, parkedOver, threadOf, unreadIn,
} from "../../src/stats/outcomes.mjs";
import { slugFor } from "../../src/stats/transcripts.mjs";
import { runsUnder } from "../../src/stats/runs.mjs";
import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const PROJECT = "/fixture/outcomes";
const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = Date.parse("2026-09-20T00:00:00.000Z");

const call = (kind, over = {}) => ({ class: kind, at: 0, endedAt: 0, body: "", shell: "", ...over });
let made = 0;
const run = (over = {}) => ({
  path: `/fixture/run-${made += 1}.jsonl`,
  startedAt: NOW - 10 * DAY, endedAt: NOW - 9 * DAY, issues: [], rulings: [], parks: [], ...over,
});
const figureOf = (held, name) => held.figures.find((one) => one.name === name);
const read = (over = {}) => ({ threads: new Map(), ruled: new Map(), horizon: DAY, now: NOW, ...over });
/* Every run the case declares is the corpus the park attribution is resolved over; the window and
   the corpus part company only where a case cuts them apart on purpose. */
const heldOf = (runs, given) =>
  outcomesOf(runs, { ...given, parks: parkedOver(runs, given.threads, given.documents) });

test("a run is joined to every issue its own claim output granted, and to none a refusal or a quoted line names", () => {
  const granted = (key, how) => `forge_issues -> project p (from the project file), prose as written
${key}  ${how}: session iss-1-abc (agent, pid 1), renewed 2026-09-08T00:00 for 30 minute(s)`;

  assert.deepEqual(claimedIn([call("forge claim", { body: granted("ISS-1", "claim") })]), ["ISS-1"]);
  assert.deepEqual(claimedIn([call("forge claim", { body: granted("ISS-2", "reclaim") })]), ["ISS-2"],
    "a recovered lease owns its issue as fully as a fresh claim");
  assert.deepEqual(claimedIn([call("forge claim", { body: granted("ISS-3", "take") })]), ["ISS-3"],
    "and so does a taken handoff");
  for (const how of ["renewed", "judged", "reconciled"]) {
    assert.deepEqual(claimedIn([call("forge claim", { body: granted("ISS-4", how) })]), ["ISS-4"], how);
  }

  assert.deepEqual(claimedIn([call("forge claim", {
    body: "ISS-5 is claimed: session other-run (agent, pid 2), renewed 2026-09-08T00:00 for 30 minute(s)",
  })]), [], "a refusal names the issue and grants nothing");

  assert.deepEqual(claimedIn([call("forge claim", {
    body: `${granted("ISS-6", "claim")}\nNext: ISS-99  claim: whatever a caller typed`,
  })]), ["ISS-6"], "a --next line prints behind `Next: `, so nothing a person writes forges a join");

  assert.deepEqual(claimedIn([call("forge claim", {
    body: `${granted("ISS-7", "claim")}\n${granted("ISS-8", "claim")}`,
  })]), ["ISS-7", "ISS-8"], "two granted claims in one call are two members");

  assert.deepEqual(claimedIn([
    call("forge claim", { body: "ISS-9 is claimed: session other-run" }),
    call("forge claim", { body: granted("ISS-9", "reclaim") }),
  ]), ["ISS-9"], "a refusal then a grant joins once");

  assert.deepEqual(claimedIn([
    call("forge claim", { body: granted("ISS-9", "claim") }),
    call("forge claim", { body: granted("ISS-9", "renewed") }),
    call("forge claim", { body: granted("ISS-9", "renewed") }),
  ]), ["ISS-9"], "three ownerships of one issue are one member");

  assert.deepEqual(claimedIn([call("read", { body: granted("ISS-1", "claim") })]), [],
    "a call of another class carrying the words is no claim");

  const runs = [run({ issues: ["ISS-1", "ISS-2"] }), run({ issues: ["ISS-2"] }), run()];
  assert.equal(pairsOf(runs).length, 3, "one issue owned by two runs is two pairs, each anchored to its run");
  assert.equal(unreadIn(runs), 1, "a run with no ownership established is unread");
});

test("each outcome figure prints over its own population, and an empty population is unavailable rather than zero", () => {
  const older = run({ endedAt: NOW - 5 * DAY });
  const pairs = { issues: ["ISS-1"] };
  const finding = { kind: "finding", at: NOW - 5 * DAY + HOUR, fields: {} };

  const threads = new Map([["ISS-1", { records: [finding] }]]);
  const one = heldOf([{ ...older, ...pairs }], read({ threads }));
  assert.equal(figureOf(one, "reopened").count, 1);
  assert.equal(figureOf(one, "reopened").over, 1, "the population is the pairs it read and matured");

  const clean = heldOf([{ ...older, ...pairs }], read({ threads: new Map([["ISS-1", { records: [] }]]) }));
  assert.equal(figureOf(clean, "reopened").count, 0, "a population it read with no outcome in it is zero");
  assert.equal(figureOf(clean, "reopened").over, 1);

  const blind = heldOf([{ ...older, ...pairs }], read({
    threads: new Map([["ISS-1", { unread: "the tracker refused" }]]),
  }));
  assert.equal(figureOf(blind, "reopened").count, null, `an empty population is ${UNAVAILABLE}, never 0`);
  assert.equal(figureOf(blind, "reopened").over, 0);
  assert.deepEqual(figureOf(blind, "reopened").unread, [{ why: "the tracker refused", pairs: 1 }],
    "and it says which pairs it could not read and why");

  /* Two windows of equal incidence and different batch size read the same, which is the whole point
     of a denominator: three pairs with one outcome is the rate one pair in three is. */
  const three = [{ ...run({ endedAt: NOW - 5 * DAY }), issues: ["ISS-1", "ISS-2", "ISS-3"] }];
  const wide = heldOf(three, read({
    threads: new Map([
      ["ISS-1", { records: [finding] }], ["ISS-2", { records: [] }], ["ISS-3", { records: [] }],
    ]),
  }));
  assert.equal(figureOf(wide, "reopened").over, 3, "a window that batched three counts three");
  assert.equal(figureOf(wide, "reopened").count, 1);

  const both = heldOf([{ ...older, ...pairs }], read({ threads }));
  assert.deepEqual(both.figures.map((held) => held.when),
    [AFTER_RUN, AFTER_RUN, DURING_RUN, DURING_RUN], "and the figures carry the period each is observed over");
});

test("an outcome after the run is counted inside one interval both windows share, and a run short of it is counted in neither figure", () => {
  const ended = NOW - 5 * DAY;
  const owner = { ...run({ endedAt: ended }), issues: ["ISS-1"] };
  const withFinding = (when) => new Map([["ISS-1", { records: [{ kind: "finding", at: when, fields: {} }] }]]);

  const inside = heldOf([owner], read({ threads: withFinding(ended + HOUR) }));
  assert.equal(figureOf(inside, "reopened").count, 1, "inside the interval after the run's end");

  const before = heldOf([owner], read({ threads: withFinding(ended - HOUR) }));
  assert.equal(figureOf(before, "reopened").count, 0, "a reopen dated before that run ended is not that run's");

  const late = heldOf([owner], read({ threads: withFinding(ended + 3 * DAY) }));
  assert.equal(figureOf(late, "reopened").count, 0, "past the interval it is not inside the figure");
  assert.equal(figureOf(late, "reopened").later, 1, "it is counted and named apart");

  /* A window one hour old has had one hour to go wrong, and counting its outcomes against a window
     with weeks is what let unchanged work read as improved. */
  const fresh = { ...run({ endedAt: NOW - HOUR }), issues: ["ISS-1"] };
  const green = heldOf([fresh], read({ threads: new Map([["ISS-1", { records: [] }]]) }));
  assert.equal(figureOf(green, "reopened").over, 0, "a run short of the interval is in neither after-the-run figure");
  assert.equal(figureOf(green, "reopened").count, null);
  assert.equal(figureOf(green, "reopened").unread[0].why, "its run has not finished the horizon");
  assert.equal(figureOf(green, "parked or dropped").over, 1,
    "while the during-run figures count it, being observable the moment it ended");

  /* One issue, two owners of different age: the reopen is inside one interval and not the other. */
  const shared = [{ ...run({ endedAt: ended }), issues: ["ISS-1"] }, { ...run({ endedAt: NOW - HOUR }), issues: ["ISS-1"] }];
  const split = heldOf(shared, read({ threads: withFinding(ended + HOUR) }));
  assert.equal(figureOf(split, "reopened").count, 1, "counted for the pair whose interval it falls in, and once");
  assert.equal(figureOf(split, "reopened").over, 1);
});

test("a park counts for the run whose own call wrote it, by either writing route, and an unattributable one for no run", () => {
  const span = { at: NOW - 5 * DAY, endedAt: NOW - 5 * DAY + 1000 };
  const wrote = { ...run({ endedAt: NOW - 4 * DAY }), issues: ["ISS-1"], parks: [span] };
  const watched = { ...run({ endedAt: NOW - 4 * DAY }), issues: ["ISS-1"], parks: [] };
  const threads = new Map([["ISS-1", { records: [{ kind: "park", at: span.at + 100, fields: { kind: "blocked" } }] }]]);

  const held = heldOf([wrote, watched], read({ threads }));
  assert.equal(figureOf(held, "parked or dropped").count, 1,
    "only the owner whose own call the record landed inside, not both owners of a shared issue");
  assert.equal(figureOf(held, "parked or dropped").over, 2);
  assert.equal(figureOf(held, "parked or dropped").unattributed, 0);

  const neither = heldOf([watched], read({ threads }));
  assert.equal(figureOf(neither, "parked or dropped").count, 0);
  assert.equal(figureOf(neither, "parked or dropped").unattributed, 1, "a park no owner's call answers for");

  const contested = heldOf([wrote, { ...watched, parks: [span] }], read({ threads }));
  assert.equal(figureOf(contested, "parked or dropped").unattributed, 1,
    "and so is one two owners could equally claim");

  const later = new Map([["ISS-1", { records: [
    { kind: "park", at: span.at + 100, fields: {} },
    { kind: "verdict", at: span.at + 5 * HOUR, fields: { criterion: "1 — x" } },
  ] }]]);
  assert.equal(figureOf(heldOf([wrote], read({ threads: later })), "parked or dropped").count, 1,
    "a record written after the park does not un-park it: the figure is the record's claim, not a state");

  assert.deepEqual(parkWritersIn([
    call("forge record park", { at: 1, endedAt: 2 }),
    call("forge advance", { at: 3, endedAt: 4, shell: "forge advance ISS-1 --park blocked --why w" }),
    call("forge advance", { at: 5, endedAt: 6, shell: "forge advance ISS-1 --drop --why w" }),
    call("forge advance", { at: 7, endedAt: 8, shell: "forge advance ISS-1" }),
  ]), [{ at: 1, endedAt: 2 }, { at: 3, endedAt: 4 }, { at: 5, endedAt: 6 }],
  "both routes that write the record are writers, and an ordinary advance is not");

  const two = { ...run({ endedAt: NOW - 4 * DAY }), issues: ["ISS-1", "ISS-2"], parks: [span] };
  const pair = new Map([
    ["ISS-1", { records: [{ kind: "park", at: span.at + 10, fields: {} }] }],
    ["ISS-2", { records: [{ kind: "park", at: span.at + 20, fields: {} }] }],
  ]);
  assert.equal(figureOf(heldOf([two], read({ threads: pair })), "parked or dropped").count, 2,
    "one call that parked two issues is the writer of both records");
});

test("park attribution is resolved over the corpus, so no window size can make an owner of a run the corpus refused", () => {
  const span = { at: NOW - 5 * DAY, endedAt: NOW - 5 * DAY + 1000 };
  const early = { ...run({ endedAt: NOW - 5 * DAY + 2000 }), issues: ["ISS-1"], parks: [span] };
  const late = { ...run({ endedAt: NOW - 2 * DAY }), issues: ["ISS-1"], parks: [span] };
  const threads = new Map([["ISS-1", { records: [{ kind: "park", at: span.at + 100, fields: {} }] }]]);

  const both = parkedOver([early, late], threads);
  for (const window of [[early], [late]]) {
    const held = parkedFor(pairsOf(window), threads, both);
    assert.equal(held.count, 0, "the two owners fell either side of the boundary and neither is the sole writer");
    assert.equal(held.unattributed, 1, "and the window says so rather than counting the record twice over");
  }

  /* The same two runs where only one wrote: the answer is the writer's, on whichever side it sits. */
  const quiet = { ...late, parks: [] };
  const alone = parkedOver([early, quiet], threads);
  assert.equal(parkedFor(pairsOf([early]), threads, alone).count, 1);
  assert.equal(parkedFor(pairsOf([quiet]), threads, alone).count, 0);
});

test("two names for one issue are one issue: aliased owners compete for its park, and one run owning both is one pair", () => {
  const uuid = "1F2E3D4C-5B6A-7980-A1B2-C3D4E5F60718";
  const documents = new Map([["ISS-1", "doc-1"], [uuid, "doc-1"]]);
  const span = { at: NOW - 5 * DAY, endedAt: NOW - 5 * DAY + 1000 };
  const byKey = { ...run({ endedAt: NOW - 5 * DAY + 2000 }), issues: ["ISS-1"], parks: [span] };
  const byId = { ...run({ endedAt: NOW - 2 * DAY }), issues: [uuid], parks: [span] };
  const one = { records: [{ kind: "park", at: span.at + 100, fields: {} }] };
  /* One thread under both names, which is what `readThreads` hands back for one document. */
  const threads = new Map([["ISS-1", one], [uuid, one]]);

  const both = parkedOver([byKey, byId], threads, documents);
  for (const window of [[byKey], [byId]]) {
    const held = parkedFor(pairsOf(window, documents), threads, both);
    assert.equal(held.count, 0, "a key owner and an id owner are two owners of one issue, so neither is its sole writer");
    assert.equal(held.unattributed, 1, "and the record is disclosed once, under the issue and not under a name");
  }

  /* The id owner's own reference never read: it is a candidate writer all the same, because the
     group's thread came in under the other name — and a candidate missed miscredits the record. */
  const partial = new Map([["ISS-1", one]]);
  const outside = parkedOver([byKey, byId], partial, documents);
  assert.equal(parkedFor(pairsOf([byKey], documents), partial, outside).count, 0,
    "a competitor whose own name was never asked for still spoils the attribution");

  const twice = { ...run({ endedAt: NOW - 4 * DAY }), issues: ["ISS-1", uuid], parks: [span] };
  assert.equal(pairsOf([twice], documents).length, 1,
    "one run that claimed under one name and renewed under the other owned one issue, which is one observation");
  const alone = figureOf(heldOf([twice], read({ threads, documents })), "parked or dropped");
  assert.equal(alone.over, 1, "so it stands once in the denominator");
  assert.equal(alone.count, 1, "and it is the record's sole writer");

  assert.equal(pairsOf([twice]).length, 2,
    "without the tracker's own names there is nothing to canonicalise on, and the printed reference is all there is");
});

test("a criterion judged twice after a run is one count, and a verdict before it is not that run's", () => {
  const ended = NOW - 5 * DAY;
  const owner = { ...run({ endedAt: ended }), issues: ["ISS-1"] };
  const verdict = (when, criterion) => ({ kind: "verdict", at: when, fields: { criterion } });
  const twice = new Map([["ISS-1", { records: [
    verdict(ended + HOUR, "3 — the thing"), verdict(ended + 2 * HOUR, "3 — the thing"),
  ] }]]);
  assert.equal(figureOf(heldOf([owner], read({ threads: twice })), "criteria judged twice").count, 1);

  const apart = new Map([["ISS-1", { records: [
    verdict(ended + HOUR, "3 — the thing"), verdict(ended + 2 * HOUR, "4 — another"),
  ] }]]);
  assert.equal(figureOf(heldOf([owner], read({ threads: apart })), "criteria judged twice").count, 0,
    "two criteria judged once each is not a criterion judged twice");

  const early = new Map([["ISS-1", { records: [
    verdict(ended - 2 * HOUR, "3 — x"), verdict(ended - HOUR, "3 — x"),
  ] }]]);
  assert.equal(figureOf(heldOf([owner], read({ threads: early })), "criteria judged twice").count, 0,
    "the run's own two verdicts on one criterion are its work, not what became of it");

  /* Which of two judgements is the second is a question about the clock, and a thread delivered
     newest first would otherwise date the repeat to the earlier of them. */
  const pair = [verdict(ended + HOUR, "3 — x"), verdict(ended + 2 * DAY, "3 — x")];
  for (const order of [pair, [...pair].reverse()]) {
    const held = figureOf(heldOf([owner], read({ threads: new Map([["ISS-1", { records: order }]]) })),
      "criteria judged twice");
    assert.equal(held.count, 0, "the second judgement fell past the horizon, whichever order it arrived in");
    assert.equal(held.later, 1, "and it is counted apart in both");
  }
});

test("a ruling entry two calls could claim is attributed to neither, and the pairing does not depend on the window", () => {
  const entry = (when, over = {}) => ({ at: when, of: null, accepted: 1, rejected: 0, ...over });
  const span = (when, over = {}) => ({ at: when, endedAt: when + 100, of: null, ...over });

  const sole = pairedOneToOne([span(1000)], [entry(1050)], 5000);
  assert.equal(sole.pairs.length, 1);
  assert.equal(sole.unpaired.length, 0);

  const contested = pairedOneToOne([span(1000), span(1100)], [entry(1050)], 5000);
  assert.equal(contested.pairs.length, 0, "one entry two spans could each claim is neither's");
  assert.equal(contested.unpaired.length, 2, "and both calls are counted unpaired");

  const named = pairedOneToOne([span(1000, { of: "abc" }), span(1100)], [entry(9_000_000, { of: "abc" })], 5000);
  assert.equal(named.pairs.length, 1, "an id is identity where a span is a guess, whatever the clock says");
  assert.equal(named.pairs[0].span.of, "abc");
  assert.equal(named.unpaired.length, 1);

  assert.deepEqual(rulingsIn([
    call("forge codex verdict", { at: 1, endedAt: 2, shell: "forge codex verdict --of ab12 --accepted F1" }),
    call("forge codex verdict", { at: 3, endedAt: 4, shell: "forge codex verdict --accepted F1" }),
    call("gate", { at: 5, endedAt: 6, shell: "forge codex verdict --of zz" }),
  ]), [{ at: 1, endedAt: 2, of: "ab12" }, { at: 3, endedAt: 4, of: null }],
  "the consult a ruling names, where it names one, and only off a ruling call");
});

test("the rejected-findings figure counts findings, needs no tracker, and is unavailable where nothing was ruled", () => {
  const span = { at: 1000, endedAt: 1100, of: "abc" };
  const owner = { ...run({ endedAt: NOW - 5 * DAY }), issues: ["ISS-1"], rulings: [span] };
  const ruled = new Map([[span, { at: 1050, of: "abc", accepted: 3, rejected: 1 }]]);

  const held = heldOf([owner], read({ ruled, threads: new Map([["ISS-1", { unread: "the tracker refused" }]]) }));
  const figure = figureOf(held, "consult findings rejected");
  assert.equal(figure.count, 1, "a refused tracker read leaves this row standing: its sources are not the tracker");
  assert.equal(figure.over, 4, "over the findings ruled, not the pairs");
  assert.equal(figure.unit, "finding");
  assert.equal(figure.paired, 1);
  assert.equal(figure.unpaired, 0);
  assert.equal(figureOf(held, "reopened").count, null, "while the pair figures go unavailable");

  const nothing = heldOf([owner], read({ ruled: new Map() }));
  const none = figureOf(nothing, "consult findings rejected");
  assert.equal(none.count, null, "no ruling paired is no denominator, so unavailable and not a rate of zero");
  assert.equal(none.unpaired, 1, "and the unpaired call is counted");

  const zero = new Map([[span, { at: 1050, of: "abc", accepted: 0, rejected: 0 }]]);
  const ruledNothing = figureOf(heldOf([owner], read({ ruled: zero })), "consult findings rejected");
  assert.equal(ruledNothing.count, null, "a paired ruling that ruled on nothing has no denominator either");
  assert.equal(ruledNothing.paired, 1);
});

test("a thread is read whole or not at all: every way a page falls short leaves its records unreachable", () => {
  const one = {
    createdAt: new Date(NOW).toISOString(),
    body: "## Park\n\n```forge-record\nkind: blocked\nwhy: waiting on another issue\n```\n\n`forge-record: park · contract 1`\n",
  };

  const whole = threadOf({ comments: [one], hasMore: false });
  assert.equal(whole.unread, undefined, "called whole by the tracker, and only then, the thread is a thread");
  assert.deepEqual(whole.records.map((held) => held.kind), ["park"],
    "and its records are the ones the page's own bodies carry");

  assert.equal(threadOf({ refused: "Forge answered 429" }).records, undefined);
  assert.equal(threadOf({ refused: "Forge answered 429" }).unread, "Forge answered 429",
    "a refusal is carried as it came rather than restated");

  assert.equal(threadOf({ comments: [one], hasMore: true, stopped: "Forge answered 429" }).unread,
    "the thread's paging stopped part way", "a walk that ended early read a prefix, whatever it got");

  for (const page of [{ comments: [one] }, { comments: [one], hasMore: null }, { comments: [one], hasMore: true }]) {
    assert.equal(threadOf(page).unread, "the tracker never called this thread whole",
      "and silence about completeness is not completeness");
  }
});

/* From here the tracker is a real one on a socket, because the cases are which requests were sent. */
const state = { issues: [], comments: {} };
const tracker = await fakeTracker(state);
after(() => tracker.close());

const SLUG = "outcomes-fixture";

const runText = (n, key) => {
  const start = NOW - (200 - n) * HOUR;
  const iso = (ms) => new Date(ms).toISOString();
  return [
    JSON.stringify({ timestamp: iso(start), type: "user", message: { role: "user", content: `Skill forge:issue-flow ${key}` } }),
    JSON.stringify({ timestamp: iso(start + 30_000), message: { role: "assistant", content: [{ type: "tool_use", id: `c${n}`, name: "Bash", input: { command: `forge claim ${key}` } }] } }),
    JSON.stringify({ timestamp: iso(start + 600_000), message: { role: "user", content: [{ type: "tool_result", tool_use_id: `c${n}`, content: `${key}  claim: session iss-${n} (agent, pid 1), renewed for 30 minute(s)` }] } }),
  ].join("\n");
};

const corpusOf = (many) => {
  const room = tempRoom("outcomes-corpus-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session", "tasks");
  mkdirSync(tasks, { recursive: true });
  for (let n = 0; n < many; n += 1) {
    writeFileSync(join(tasks, `a${String(n).padStart(4, "0")}.output`), `${runText(n, `ISS-${n + 1}`)}\n`);
  }
  return room;
};

/* Awaited and never `spawnSync`: the fake tracker runs on this process's own event loop, and a
   synchronous wait for a child that is asking it a question is a deadlock its timeout ends. */
const ask = (room, ...argv) => ranAsync(FORGE, ["stats", "eval", "--checkout", PROJECT, ...argv],
  { ...tracker.env, TMPDIR: room, HOME: tempRoom("outcomes-user-"), FORGE_PROJECT: SLUG });

test("the tracker reads of one eval share a request budget, and past it the outcome figures are unavailable while the cost figures print", async () => {
  const budget = budgetOf(2);
  assert.equal(budget.bound.spend(), null, "the first request is affordable");
  assert.equal(budget.bound.spend(), null);
  assert.match(budget.bound.spend(), /request budget of 2 request\(s\) is spent/u, "the third is not");
  assert.equal(budget.spent.requests, 2, "and nothing past the budget is counted as spent");
  assert.equal(budget.bound.once, true, "an attempt is sent once, so no retry can outrun the budget");
  assert.equal(typeof budget.bound.waits, "number", "and each is bounded in time");
  assert.equal(budget.bound.soft, true, "a refusal comes back as a value, so the cost figures still print");

  const room = corpusOf(8);
  state.calls = [];
  const held = await ask(room, "--size", "4", "--requests", "1");
  assert.equal(held.status, 0, held.stderr);
  assert.match(held.stdout, /median \d+(\.\d+)? min/u, "every cost figure prints");
  assert.match(held.stdout, /run-and-issue pair\(s\) owned by this window/u);
  assert.match(held.stdout, new RegExp(`reopened .*${UNAVAILABLE}`, "u"), "and the outcome figures do not");
  assert.match(held.stdout, new RegExp(`criteria judged twice .*${UNAVAILABLE}`, "u"));
  assert.equal(state.calls.length <= 1, true, `one request at most was sent, not ${state.calls.length}`);

  const refused = await ask(room, "--size", "4", "--requests", "0");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /stats eval: --requests takes an integer of 1 or more, not `0`/u);
});

test("a rate-limited page leaves the outcome figures unavailable and every cost figure intact", async () => {
  const room = corpusOf(8);
  state.status = 429;
  state.calls = [];
  try {
    const held = await ask(room, "--size", "4");
    assert.equal(held.status, 0, held.stderr);
    assert.match(held.stdout, /median \d+(\.\d+)? min/u, "the cost comparison survives a refused tracker");
    assert.match(held.stdout, new RegExp(`reopened .*${UNAVAILABLE}`, "u"));
    assert.match(held.stdout, /pair\(s\) unread now: /u, "and the reason is printed rather than swallowed");
    assert.match(held.stdout, /pair\(s\) unread before: /u, "for the window it is about, on both sides");
  } finally {
    state.status = null;
  }
});

test("a comment page the tracker never called whole is a prefix, so its pairs go unread rather than outcome-free", async () => {
  const room = corpusOf(8);
  state.issues = Array.from({ length: 8 }, (one, n) => ({ documentId: `doc-${n + 1}`, issueId: `ISS-${n + 1}` }));
  state.answer = {
    forge_comments: () => ({
      comments: [{ documentId: "c1", body: "prose with no record in it", createdAt: new Date(NOW).toISOString() }],
      hasMore: null,
    }),
  };
  try {
    const held = await ask(room, "--size", "4");
    assert.equal(held.status, 0, held.stderr);
    assert.match(held.stdout, new RegExp(`parked or dropped .*${UNAVAILABLE}`, "u"),
      "silence about a thread's completeness is not a thread read to the end");
    assert.match(held.stdout, /never called this thread whole/u, "and the reason says what was missing");
  } finally {
    state.issues = [];
    state.answer = {};
  }
});

test("a run owning its issue by id reaches the same row, and one issue under two names is one thread walk", async () => {
  const uuid = "1f2e3d4c-5b6a-7980-a1b2-c3d4e5f60718";
  const room = tempRoom("outcomes-alias-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session", "tasks");
  mkdirSync(tasks, { recursive: true });
  for (const [n, key] of [uuid, "ISS-1", uuid, "ISS-1"].entries()) {
    writeFileSync(join(tasks, `a${String(n).padStart(4, "0")}.output`), `${runText(n, key)}\n`);
  }
  state.issues = [{ documentId: uuid, issueId: "ISS-1" }];
  state.comments = { [uuid]: [{ documentId: "c1", body: "prose with no record in it" }] };
  state.calls = [];
  try {
    const held = await ask(room, "--size", "2");
    assert.equal(held.status, 0, held.stderr);
    assert.match(held.stdout, /parked or dropped .*→ +0\/2 pair\(s\)/u,
      "the pair a claim granted by id is read like any other, not counted unread");
    assert.equal(held.stdout.includes("answers to it"), false, "so no owned reference is reported rowless");
    assert.equal(state.calls.filter((one) => one.name === "forge_comments").length, 1,
      "and the key and the id are one issue, walked once");
  } finally {
    state.issues = [];
    state.comments = {};
  }
});

test("stats runs sends the tracker no request and carries no outcome figure", async () => {
  const room = corpusOf(4);
  state.calls = [];
  const held = await ranAsync(FORGE, ["stats", "runs", "--checkout", PROJECT, "--json"],
    { ...tracker.env, TMPDIR: room, HOME: tempRoom("outcomes-user-"), FORGE_PROJECT: SLUG });
  assert.equal(held.status, 0, held.stderr);
  const read = JSON.parse(held.stdout);
  assert.equal(read.runs, 4);
  assert.equal(read.outcomes, undefined, "the profile computes no outcome");
  assert.equal(JSON.stringify(read).includes("reopened"), false);
  assert.deepEqual(state.calls, [], "and it reaches the tracker not once");
});

test("the profile's own figures do not move because a run is joined to its issues", () => {
  const room = corpusOf(6);
  const { runs } = runsUnder(join(room, `claude-${process.getuid()}`, slugFor(PROJECT)), null);
  assert.equal(runs.length, 6);
  for (const one of runs) {
    assert.equal(one.issues.length, 1, "each fixture run owns the issue it claimed");
    assert.deepEqual(one.rulings, []);
    assert.deepEqual(one.parks, []);
    /* The pair carries no cost, which is what stops an issue worked twice doubling a window. */
    assert.equal(one.seconds, 600, "and the cost is the transcript's, untouched by the join");
  }
});
