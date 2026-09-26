/* The closed reader over a tracker made in memory: each project's status history served newest first
   in pages behind a `before` cursor, as the activity routes serve it, its issue list and each issue's
   own history. Runs are bare objects carrying what the join and the lending read. */
import assert from "node:assert/strict";
import test from "node:test";

import { NO_ENDPOINT, SATURATED, closedOn, closesRead, walkBack } from "../../../src/stats/daily/closed.mjs";
import { projectTarget } from "../../../src/resolve/settings.mjs";

process.env.TZ = "UTC";

const DAY = "2026-09-20";
const at = (day, time) => Date.parse(`${day}T${time}Z`);
const iso = (ms) => new Date(ms).toISOString();

let ids = 0;
const moved = (issueId, when, to = "closed", from = "awaiting_release") =>
  ({ id: `e${(ids += 1)}`, issueId, action: "issue.statusChanged", from, to, reopenCount: 0, at: iso(when) });
const updated = (issueId, when) => ({ id: `e${(ids += 1)}`, issueId, action: "issue.updated", from: null, to: null, reopenCount: null, at: iso(when) });

/* The routes' paging: newest first, strictly before the cursor, `nextBefore` the oldest served while a page is full. */
const pager = (events, limit, refusedAt = null) => async (before) => {
  if (refusedAt && refusedAt(before)) return { refused: "the tracker answered 503\nand more" };
  const page = events.filter((one) => one.at < before).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  return { events: page, nextBefore: page.length === limit ? page.at(-1).at : null };
};

const rowsFor = (issues) => issues.map(([key, documentId]) => ({ issueId: key, documentId }));

const tracker = ({ events = [], issues = [], histories = {}, limit = 200, refusedAt = null, short = false, asked = [] } = {}) => ({
  limit,
  activity: pager(events, limit, refusedAt),
  history: (documentId, before) => {
    asked.push(documentId);
    return pager(histories[documentId] ?? [], limit)(before);
  },
  issues: async () => (short ? { rows: rowsFor(issues), whole: false, pages: 1 } : { rows: rowsFor(issues), whole: true, pages: 1 }),
});

const PROJECT = { name: "proj", slug: "proj" };
const run = (path, startedAt, minutes, issues) => ({ path, startedAt, endedAt: startedAt + minutes * 60_000, seconds: minutes * 60, issues });

const readOn = async (reads, { runs = [], registered = [PROJECT], day = DAY } = {}) => {
  const closed = await closesRead(registered, day, { reads, runs: [{ slug: "proj", runs }], held: () => true });
  return (on = day) => closedOn({ closed }, on);
};

test("2. the count is the distinct issues closed inside the day over every project, and nothing else", async () => {
  const other = { name: "other", slug: "other" };
  const own = {
    proj: [moved("a", at(DAY, "01:00:00")), moved("b", at(DAY, "23:59:59")), moved("c", at("2026-09-21", "00:00:00")),
      moved("d", at("2026-09-19", "23:59:59")), moved("e", at(DAY, "10:00:00"), "testing", "developed"), updated("f", at(DAY, "11:00:00"))],
    other: [moved("g", at(DAY, "02:00:00")), moved("a", at(DAY, "03:00:00"))],
  };
  /* The project a scoped call is aimed at is the one whose history answers, as on the tracker. */
  const reads = { ...tracker(), activity: (before) => pager(own[projectTarget().value], 200)(before) };
  const closed = await closesRead([PROJECT, other], DAY, { reads, held: () => true });
  assert.equal(closedOn({ closed }, DAY).closed, 3, "a, b and g; c after, d before, e not a close, f no status change, a once");
});

test("3. an issue closed on one day and again on a later day counts on each of them", async () => {
  const day = await readOn(tracker({ events: [moved("a", at("2026-09-18", "09:00:00")),
    moved("a", at("2026-09-18", "09:05:00"), "testing", "closed"), moved("a", at(DAY, "12:00:00"))] }));
  assert.equal(day("2026-09-18").closed, 1);
  assert.equal(day(DAY).closed, 1);
});

test("5. an issue closed twice inside one day counts once on it", async () => {
  const day = await readOn(tracker({ events: [moved("a", at(DAY, "03:00:00")), moved("a", at(DAY, "04:00:00"), "testing", "closed"),
    moved("a", at(DAY, "05:00:00"))] }));
  assert.equal(day().closed, 1);
});

test("1. UC-02-2: a project whose walk of a day is refused leaves that day not read, named, and never a nought", async () => {
  const refusedAt = (before) => before === iso(at("2026-09-19", "00:00:00") + 86_400_000);
  const day = await readOn(tracker({ events: [moved("a", at(DAY, "01:00:00"))], refusedAt }));
  assert.deepEqual(day("2026-09-19"), { unread: "proj: the tracker answered 503" });
  assert.equal(day(DAY).closed, 1, "the days whose walk answered still count");
});

test("14. with no endpoint saved every day is not read, saying so", async () => {
  const closed = await closesRead([PROJECT], DAY, { reads: tracker(), held: () => false });
  assert.deepEqual(closedOn({ closed }, DAY), { unread: NO_ENDPOINT });
});

test("a project whose record names no tracker project is not read, named", async () => {
  const closed = await closesRead([{ name: "bare", slug: null }], DAY, { reads: tracker(), held: () => true });
  assert.deepEqual(closedOn({ closed }, DAY), { unread: "bare: its record names no tracker project" });
});

test("6, 7, 8. runs joined under any name the rows answer to lend equal shares, and the quotient is over the closed count", async () => {
  const reads = tracker({ events: [moved("doc-a", at(DAY, "12:00:00")), moved("doc-b", at(DAY, "13:00:00"))],
    issues: [["ISS-1", "doc-a"], ["ISS-2", "doc-b"]] });
  const day = await readOn(reads, { runs: [
    run("/one", at(DAY, "08:00:00"), 30, ["ISS-1"]),
    run("/two", at(DAY, "09:00:00"), 60, ["ISS-1", "DOC-B"]),
    run("/late", at(DAY, "14:00:00"), 45, ["ISS-1"]),
  ] });
  assert.deepEqual(day(), { closed: 2, minutes: 90, withoutRun: 0, minutesUnread: null },
    "ISS-1 takes 30 and half of 60, ISS-2 (claimed by its document id) the other half; the run begun after both closes lends nothing");
});

test("7. every close inside the day lends: runs before an earlier same-day close and between the two both count once", async () => {
  const reads = tracker({ events: [moved("doc-a", at(DAY, "10:00:00")), moved("doc-a", at(DAY, "11:00:00"), "testing", "closed"),
    moved("doc-a", at(DAY, "16:00:00"))], issues: [["ISS-1", "doc-a"]] });
  const day = await readOn(reads, { runs: [run("/first", at(DAY, "09:00:00"), 30, ["ISS-1"]), run("/second", at(DAY, "12:00:00"), 30, ["ISS-1"])] });
  assert.deepEqual(day(), { closed: 1, minutes: 60, withoutRun: 0, minutesUnread: null });
});

test("7. a run begun before a walked earlier close lends to that close and not to the later one", async () => {
  const reads = tracker({ events: [moved("doc-a", at("2026-09-15", "10:00:00")), moved("doc-a", at(DAY, "10:00:00"))],
    issues: [["ISS-1", "doc-a"]] });
  const day = await readOn(reads, { runs: [run("/old", at("2026-09-15", "09:00:00"), 30, ["ISS-1"]), run("/new", at("2026-09-18", "09:00:00"), 20, ["ISS-1"])] });
  assert.equal(day().minutes, 20);
  assert.equal(day("2026-09-15").minutes, 30);
});

test("7. a run begun before the walked days is judged against the issue's own history, read for it alone", async () => {
  const asked = [];
  const reads = tracker({ asked, events: [moved("doc-a", at(DAY, "10:00:00")), moved("doc-b", at(DAY, "11:00:00"))],
    issues: [["ISS-1", "doc-a"], ["ISS-2", "doc-b"]],
    histories: { "doc-a": [moved("doc-a", at("2026-09-05", "10:00:00")), moved("doc-a", at(DAY, "10:00:00"))] } });
  const day = await readOn(reads, { runs: [run("/before-that", at("2026-09-04", "09:00:00"), 30, ["ISS-1"]),
    run("/between", at("2026-09-06", "09:00:00"), 10, ["ISS-1"]), run("/b", at(DAY, "09:00:00"), 5, ["ISS-2"])] });
  assert.deepEqual(asked, ["doc-a"], "an issue whose runs all began inside the walked days needs no history of its own");
  assert.equal(day().minutes, 15, "the run before the close of 09-05 lent to that close; the one after it and ISS-2's lend here");
});

test("10. a closed issue no run on this device owned is counted, and said to have none", async () => {
  const day = await readOn(tracker({ events: [moved("doc-a", at(DAY, "10:00:00")), moved("doc-z", at(DAY, "11:00:00"))],
    issues: [["ISS-1", "doc-a"]] }), { runs: [run("/one", at(DAY, "09:00:00"), 12, ["ISS-1"])] });
  assert.deepEqual(day(), { closed: 2, minutes: 12, withoutRun: 1, minutesUnread: null });
});

test("11. an issue list read short leaves the minutes not read while the count stands", async () => {
  const day = await readOn(tracker({ events: [moved("doc-a", at(DAY, "10:00:00"))], issues: [["ISS-1", "doc-a"]], short: true }));
  assert.equal(day().closed, 1);
  assert.equal(day().minutes, null);
  assert.match(day().minutesUnread, /proj's issue list reached 1 issue\(s\) over 1 page\(s\) and the reading is incomplete/u);
});

test("a run begun before a walked day that could not be read leaves the minutes not read", async () => {
  const refusedAt = (before) => before === iso(at("2026-09-17", "00:00:00") + 86_400_000);
  const day = await readOn(tracker({ refusedAt, events: [moved("doc-a", at(DAY, "10:00:00"))], issues: [["ISS-1", "doc-a"]] }),
    { runs: [run("/old", at("2026-09-16", "09:00:00"), 30, ["ISS-1"])] });
  assert.equal(day().closed, 1);
  assert.match(day().minutesUnread, /could not be read/u);
});

test("a day not read after a close leaves that close's minutes standing", async () => {
  const refusedAt = (before) => before === iso(at("2026-09-19", "00:00:00") + 86_400_000);
  const day = await readOn(tracker({ refusedAt, events: [moved("doc-a", at("2026-09-15", "10:00:00"))], issues: [["ISS-1", "doc-a"]] }),
    { runs: [run("/early", at("2026-09-14", "09:00:00"), 30, ["ISS-1"])] });
  assert.deepEqual(day("2026-09-15"), { closed: 1, minutes: 30, withoutRun: 0, minutesUnread: null });
  assert.ok(day("2026-09-19").unread);
});

test("two repositories registered under one tracker project read it once, and a close is lent each run once", async () => {
  const reads = tracker({ events: [moved("doc-a", at(DAY, "10:00:00"))], issues: [["ISS-1", "doc-a"]] });
  const day = await readOn(reads, { registered: [PROJECT, { name: "proj-fork", slug: "proj" }],
    runs: [run("/one", at(DAY, "09:00:00"), 30, ["ISS-1"])] });
  assert.deepEqual(day(), { closed: 1, minutes: 30, withoutRun: 0, minutesUnread: null });
});

test("18. two events sharing a timestamp across a page boundary are both kept", async () => {
  const tie = at(DAY, "12:00:00");
  const events = [moved("a", at(DAY, "13:00:00")), moved("b", at(DAY, "12:30:00")), moved("c", tie), moved("d", tie), moved("e", at(DAY, "11:00:00"))];
  const walked = await walkBack(pager(events, 3), at(DAY, "00:00:00"), at(DAY, "23:59:59"), 3);
  assert.deepEqual(walked.events.map((one) => one.issueId).sort(), ["a", "b", "c", "d", "e"]);
});

test("21. more events at one timestamp than a page carries leave the day not read rather than a part counted", async () => {
  const tie = at(DAY, "12:00:00");
  const day = await readOn(tracker({ limit: 2, events: [moved("a", at(DAY, "13:00:00")), updated("x", tie), updated("y", tie), moved("b", tie)] }));
  assert.deepEqual(day(), { unread: `proj: ${SATURATED}` });
});

test("a page no reading was made for is not read, never a nought", () => {
  assert.deepEqual(closedOn({}, DAY), { unread: "no tracker reading was made for this page" });
});
