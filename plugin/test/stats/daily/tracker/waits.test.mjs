/* The owner-wait reader over a tracker made in memory: each project's status history served newest
   first behind a `before` cursor, as the activity routes serve it, its issue list with where each
   issue stands now, and each issue's own history. */
import assert from "node:assert/strict";
import test from "node:test";

import { PERSON, spansOf, waitsOn, waitsRead } from "../../../../src/stats/daily/tracker/waits.mjs";
import { NO_ENDPOINT } from "../../../../src/stats/daily/tracker/history.mjs";
import { projectTarget } from "../../../../src/resolve/settings.mjs";

process.env.TZ = "UTC";

const DAY = "2026-09-20";
const at = (day, time) => Date.parse(`${day}T${time}Z`);
const iso = (ms) => new Date(ms).toISOString();

let ids = 0;
const moved = (issueId, when, from, to) => ({ id: `e${(ids += 1)}`, issueId, action: "issue.statusChanged", from, to, reopenCount: 0, at: iso(when) });
const created = (issueId, when) => ({ id: `e${(ids += 1)}`, issueId, action: "issue.created", from: null, to: null, reopenCount: null, at: iso(when) });

const pager = (events, limit, refusedAt = null) => async (before) => {
  if (refusedAt && refusedAt(before)) return { refused: "the tracker answered 503\nand more" };
  const page = events.filter((one) => one.at < before).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  return { events: page, nextBefore: page.length === limit ? page.at(-1).at : null };
};

/* One project's tracker. Its activity is every issue's history pooled, as the project route serves it. */
const tracker = ({ histories = {}, statuses = {}, refusedAt = null, historyRefused = [], short = false, limit = 200 } = {}) => ({
  limit,
  activity: pager(Object.values(histories).flat(), limit, refusedAt),
  history: (documentId, before) => (historyRefused.includes(documentId)
    ? { refused: "the tracker answered 502" } : pager(histories[documentId] ?? [], limit)(before)),
  issues: async () => ({ rows: Object.keys({ ...histories, ...statuses }).map((documentId) =>
    ({ documentId, issueId: `ISS-${documentId}`, status: statuses[documentId] ?? "closed" })), whole: !short, pages: 1 }),
});

const PROJECT = { name: "proj", slug: "proj" };

const readOn = async (reads, { registered = [PROJECT], day = DAY } = {}) => {
  const waits = await waitsRead(registered, day, { reads, held: () => true });
  return (on = day) => waitsOn({ waits }, on);
};

/* A wait from one moment to another, in and out of `needs_info`. */
const asked = (doc, from, to) => [created(doc, from - 3_600_000), moved(doc, from, "in_progress", "needs_info"), moved(doc, to, "needs_info", "in_progress")];

test("3, 7. the person's statuses are the ones the flow's park table answers by a person, and neither on_hold nor awaiting_release", () => {
  assert.deepEqual([...PERSON].sort(), ["needs_info", "waiting"]);
});

test("2. a day's value is the minutes of every wait that ended inside it, over every project", async () => {
  const own = {
    proj: tracker({ histories: { a: asked("a", at(DAY, "01:00:00"), at(DAY, "02:30:00")), b: asked("b", at(DAY, "22:00:00"), at("2026-09-21", "01:00:00")) } }),
    other: tracker({ histories: { c: asked("c", at(DAY, "10:00:00"), at(DAY, "10:20:00")) } }),
  };
  const aimed = (name) => (...args) => own[projectTarget().value][name](...args);
  const reads = { limit: 200, activity: aimed("activity"), history: aimed("history"), issues: aimed("issues") };
  const waits = await waitsRead([PROJECT, { name: "other", slug: "other" }], DAY, { reads, held: () => true });
  const day = waitsOn({ waits }, DAY);
  assert.deepEqual([day.minutes, day.ended], [110, 2], "90 on proj's a and 20 on other's c; b ended the next day");
});

test("4, 5. a wait that moves between waiting and needs_info is one, and counts whole on the day it ended though it began weeks before", async () => {
  const history = [created("a", at("2026-08-30", "08:00:00")), moved("a", at("2026-08-30", "09:00:00"), "testing", "waiting"),
    moved("a", at("2026-09-15", "09:00:00"), "waiting", "needs_info"), moved("a", at(DAY, "09:00:00"), "needs_info", "testing")];
  const day = await readOn(tracker({ histories: { a: history } }));
  assert.equal(day().minutes, 21 * 24 * 60, "from 08-30 09:00 to 09-20 09:00");
  assert.equal(day().ended, 1);
  assert.equal(day("2026-09-15").ended, 0, "the move between the two statuses ended nothing");
});

test("7. time at on_hold and at awaiting_release is no wait on a person", async () => {
  const history = [created("a", at(DAY, "00:10:00")), moved("a", at(DAY, "01:00:00"), "developed", "on_hold"),
    moved("a", at(DAY, "02:00:00"), "on_hold", "awaiting_release"), moved("a", at(DAY, "03:00:00"), "awaiting_release", "closed")];
  assert.deepEqual(spansOf(history.map((one) => ({ ...one, at: Date.parse(one.at) }))), { spans: [] });
  const day = await readOn(tracker({ histories: { a: history } }));
  assert.deepEqual([day().minutes, day().ended], [0, 0]);
});

test("6. an issue created at a person's status waits from its creation", async () => {
  const history = [created("a", at(DAY, "04:00:00")), moved("a", at(DAY, "05:00:00"), "needs_info", "open")];
  const day = await readOn(tracker({ histories: { a: history } }));
  assert.equal(day().minutes, 60);
  const still = await readOn(tracker({ histories: { b: [created("b", at(DAY, "20:00:00"))] }, statuses: { b: "waiting" } }));
  assert.deepEqual(still().open.waits.map((one) => [one.issueId, one.minutes]), [["ISS-b", 240]], "never moved, and stands at waiting now");
});

test("8. a day whose reads came back whole with no wait ended reads nought", async () => {
  const day = await readOn(tracker({ histories: { a: asked("a", at("2026-09-18", "01:00:00"), at("2026-09-18", "02:00:00")) } }));
  assert.deepEqual([day().minutes, day().ended, day().unread], [0, 0, undefined]);
  assert.equal(day("2026-09-18").minutes, 60);
});

test("10, 11. waits open at the day's end stand apart with their age, whether they ended later or have not", async () => {
  const reads = tracker({
    histories: {
      a: asked("a", at(DAY, "20:00:00"), at("2026-09-21", "03:00:00")),
      b: [created("b", at("2026-08-01", "00:00:00")), moved("b", at("2026-09-01", "00:00:00"), "open", "waiting")],
      c: asked("c", at(DAY, "10:00:00"), at(DAY, "11:00:00")),
    },
    statuses: { b: "waiting" },
  });
  const day = await readOn(reads);
  assert.equal(day().minutes, 60, "only c ended inside the day");
  assert.deepEqual(day().open.waits.map((one) => [one.issueId, one.minutes, one.since]).sort(),
    [["ISS-a", 240, "2026-09-20T20:00:00.000Z"], ["ISS-b", 20 * 24 * 60, "2026-09-01T00:00:00.000Z"]]);
  assert.equal(day("2026-09-19").open, null, "the open waits are the page's day's alone");
});

test("1. UC-02-2: a project whose walk of a day is refused leaves that day not read, named, and never a nought", async () => {
  const refusedAt = (before) => before === iso(at("2026-09-19", "00:00:00") + 86_400_000);
  const day = await readOn(tracker({ histories: { a: asked("a", at(DAY, "01:00:00"), at(DAY, "02:00:00")) }, refusedAt }));
  assert.deepEqual(day("2026-09-19"), { unread: "proj: the tracker answered 503" });
  assert.equal(day().minutes, 60, "the days whose walk answered still count");
});

test("1. an issue whose wait ended inside the day and whose history is refused leaves the day not read", async () => {
  const day = await readOn(tracker({ histories: { a: asked("a", at(DAY, "01:00:00"), at(DAY, "02:00:00")),
    b: asked("b", at("2026-09-15", "01:00:00"), at("2026-09-15", "02:00:00")) }, historyRefused: ["a"] }));
  assert.deepEqual(day(), { unread: "proj: ISS-a's history: the tracker answered 502" });
  assert.equal(day("2026-09-15").minutes, 60, "a day no refused history ended a wait on still reads");
});

test("12. a short issue list leaves the open waits not read while the day's minutes stand", async () => {
  const day = await readOn(tracker({ histories: { a: asked("a", at(DAY, "01:00:00"), at(DAY, "02:00:00")) }, short: true }));
  assert.equal(day().minutes, 60);
  assert.match(day().open.unread, /^proj's issue list reached 1 issue\(s\) over 1 page\(s\) and the reading is incomplete/u);
});

test("12. a refused walk from the day's end to now leaves the open waits not read, named", async () => {
  const refusedAt = (before) => Date.parse(before) > Date.now();
  const day = await readOn(tracker({ histories: { a: asked("a", at(DAY, "01:00:00"), at(DAY, "02:00:00")) }, refusedAt }));
  assert.equal(day().minutes, 60);
  assert.deepEqual(day().open, { unread: "proj: the tracker answered 503" });
});

test("16. with no endpoint saved every day and the open waits are not read, saying so", async () => {
  const waits = await waitsRead([PROJECT], DAY, { reads: tracker(), held: () => false });
  assert.deepEqual(waitsOn({ waits }, DAY), { unread: NO_ENDPOINT });
  assert.deepEqual(waits.open, { unread: NO_ENDPOINT });
});

test("a project whose record names no tracker project is not read, named", async () => {
  const day = await readOn(tracker(), { registered: [{ name: "bare", slug: null }] });
  assert.deepEqual(day(), { unread: "bare: its record names no tracker project" });
});

test("a page no reading was made for is not read, never a nought", () => {
  assert.deepEqual(waitsOn({}, DAY), { unread: "no tracker reading was made for this page" });
});
