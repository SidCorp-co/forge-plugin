/* The current report's causes as rows: which friction entries the tracker's links make one row,
   which section each row stands in, what its fix realized and what fixing it would project, and
   what its score was made from. The tracker and the release readings are stood in for, and every
   run is the fixture run of `stats runs`'s own suite moved onto a day and given its own refusal. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { currentOf } from "../../../src/stats/daily/current.mjs";
import { currentPageOf } from "../../../src/stats/daily/current-page.mjs";
import { MATCHED, NONE_NEAR } from "../../../src/stats/daily/families.mjs";
import { DEFAULTS, FORMULAS, reportSettings } from "../../../src/stats/daily/settings.mjs";
import { runFrom } from "../../../src/stats/runs.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { runOn } from "./fixture-daily.mjs";

process.env.TZ = "UTC";

const TODAY = "2026-09-20";
const NOW = Date.parse(`${TODAY}T20:00:00.000Z`);
const ago = (back) => new Date(Date.parse(`${TODAY}T00:00:00.000Z`) - back * 86_400_000).toISOString().slice(0, 10);

/* A run on a day whose one refusal names what it owes, so each `owes` is a cause of its own. */
let made = 0;
const runOf = (day, owes) => {
  made += 1;
  return runFrom(`/fixture/agent-${made}.jsonl`, `session-${made}`, runOn(day).replaceAll("owes a release note", `owes ${owes}`));
};

const REFUSAL = (owes) => `refusal: Hold — ISS-nn owes ${owes}.`;
const KEY = (owes) => `refusal · Hold — ISS-nn owes ${owes}.`;

const readingOf = (runs) => {
  const all = [...runs].sort((left, right) => left.startedAt - right.startedAt);
  return { projects: [], all, passes: [], entries: [], hooks: [], first: all.length ? all[0].startedAt : null };
};

/* A tracker answering from tables: which issue a cause's text matches, and what each issue is. */
const trackerOf = (matches, issues) => ({
  rows: new Map(Object.entries(issues).map(([key, one]) => [key, { issueId: key, title: one.title, status: one.status }])),
  match: async (text) => matches[text] ?? null,
  issue: async (key) => ({ key, relates: [], ...issues[key] }),
});

const reportsRoom = () => {
  const dir = join(tempRoom("stats-causes-"), "reports");
  mkdirSync(dir, { recursive: true });
  return dir;
};

const settings = { ...DEFAULTS, from: "the plugin's defaults" };

const everyRow = (content) => ["new", "recurring", "oneOff", "fixed"].flatMap((one) => content.causes[one].rows);
const rowFor = (content, owes) => everyRow(content).find((row) => row.causes.some((one) => one.key === KEY(owes)));

const release = (version, issue, day) => ({ kind: "releases", version, issues: [issue], at: `${day}T12:00:00.000Z`, scope: "forge-plugin" });

const scenario = () => {
  const runs = [
    ...[6, 5, 4, 3, 2, 1].map((back) => runOf(ago(back), "a plan")),
    ...[9, 8, 7, 6].map((back) => runOf(ago(back), "a merge")),
    ...[6, 5, 1].map((back) => runOf(ago(back), "a note")),
    runOf(ago(4), "a verdict"),
    runOf(TODAY, "a fix"),
    ...[2, 1].map((back) => runOf(ago(back), "x one")), ...[2, 1].map((back) => runOf(ago(back), "x two")),
    ...[2, 1].map((back) => runOf(ago(back), "y one")), ...[2, 1].map((back) => runOf(ago(back), "y two")),
    ...[2, 1].map((back) => runOf(ago(back), "z one")), ...[2, 1].map((back) => runOf(ago(back), "z two")),
    ...[2, 1].map((back) => runOf(ago(back), "w one")), ...[2, 1].map((back) => runOf(ago(back), "w two")),
    runOf(ago(10), "a gone"),
  ];
  const matches = {
    [REFUSAL("a plan")]: "ISS-1", [REFUSAL("a merge")]: "ISS-2", [REFUSAL("a note")]: "ISS-3",
    [REFUSAL("x one")]: "ISS-4", [REFUSAL("x two")]: "ISS-5", [REFUSAL("y one")]: "ISS-6", [REFUSAL("y two")]: "ISS-7",
    [REFUSAL("z one")]: "ISS-8", [REFUSAL("z two")]: "ISS-8", [REFUSAL("w one")]: "ISS-9", [REFUSAL("w two")]: "ISS-10",
    [REFUSAL("a gone")]: "ISS-11",
  };
  const issues = {
    "ISS-1": { title: "plans", status: "open" }, "ISS-2": { title: "merges", status: "closed" },
    "ISS-3": { title: "notes", status: "closed" }, "ISS-4": { title: "x", status: "open", relates: ["ISS-5"] },
    "ISS-5": { title: "x again", status: "in_progress" },
    "ISS-6": { title: "A case passes in company [gate-recurrence 0123456789ab]", status: "open" },
    "ISS-7": { title: "Another case passes in company [gate-recurrence 0123456789ab]", status: "closed" },
    "ISS-12": { title: "A third sibling [gate-recurrence 0123456789ab]", status: "dropped" },
    "ISS-8": { title: "z", status: "open" }, "ISS-9": { title: "w one", status: "open" }, "ISS-10": { title: "w two", status: "open" },
    "ISS-11": { title: "gone", status: "closed" },
  };
  const marks = [release("3.1.0", "ISS-2", ago(6)), release("3.2.0", "ISS-3", ago(3)), release("3.0.0", "ISS-11", ago(9))];
  return { runs, tracker: trackerOf(matches, issues), marks };
};

const contentOf = async (held = scenario(), dir = reportsRoom(), extra = {}) =>
  currentOf(readingOf(held.runs), { dir, tracker: held.tracker, settings, now: NOW, marks: held.marks, ...extra });

test("friction keys matched to one issue, to issues joined by relates, or to titles sharing a gate-recurrence marker are one row", async () => {
  const content = await contentOf();
  assert.equal(rowFor(content, "z one"), rowFor(content, "z two"));
  assert.equal(rowFor(content, "x one"), rowFor(content, "x two"));
  assert.equal(rowFor(content, "y one"), rowFor(content, "y two"));
  assert.deepEqual(rowFor(content, "x one").issues.map((one) => one.key).sort(), ["ISS-4", "ISS-5"]);
  /* The marker's third issue is the cause's too, read off the walk: three issues from one cause. */
  assert.deepEqual(rowFor(content, "y one").issues.map((one) => one.key).sort(), ["ISS-12", "ISS-6", "ISS-7"]);
});

test("friction keys the tracker's relations do not join are separate rows", async () => {
  const content = await contentOf();
  assert.notEqual(rowFor(content, "w one"), rowFor(content, "w two"));
  assert.notEqual(rowFor(content, "a plan"), rowFor(content, "a verdict"));
});

test("each row gives its issues, its days seen as a series and whether it is open, being fixed or released", async () => {
  const content = await contentOf();
  const plan = rowFor(content, "a plan");
  assert.deepEqual(plan.issues.map((one) => one.key), ["ISS-1"]);
  assert.deepEqual(plan.figures.seen, [6, 5, 4, 3, 2, 1].map(ago));
  assert.equal(plan.figures.series.length, content.series.days.length);
  assert.deepEqual(plan.figures.series.slice(-7), [1, 1, 1, 1, 1, 1, 0]);
  assert.equal(plan.status, "open");
  assert.equal(rowFor(content, "x one").status, "being fixed");
  assert.equal(rowFor(content, "a merge").status, "released");
});

test("a cause first seen within the last day is new, with its runs, its calls and whether an issue matches it", async () => {
  const content = await contentOf();
  const fresh = rowFor(content, "a fix");
  assert.ok(content.causes.new.rows.includes(fresh));
  assert.equal(fresh.figures.runs, 1);
  assert.equal(fresh.figures.calls, 1);
  assert.deepEqual(fresh.issues, []);
  assert.equal(fresh.unmatched, NONE_NEAR);
  assert.ok(!content.causes.new.rows.includes(rowFor(content, "a plan")));
});

test("a cause first seen since the previous write is new, and one seen before it is not", async () => {
  const held = scenario();
  const dir = reportsRoom();
  const before = await contentOf(held, dir, { now: Date.parse(`${ago(3)}T20:00:00.000Z`) });
  writeFileSync(join(dir, "index.html"), currentPageOf(before));
  const content = await contentOf(held, dir);
  /* First met on the day before yesterday, after the write three days ago, and not within the last day. */
  assert.ok(content.causes.new.rows.includes(rowFor(content, "x one")));
  assert.ok(!content.causes.new.rows.includes(rowFor(content, "a verdict")));
});

test("recurring causes are ranked by score, and a one-off ranks below every recurring one", async () => {
  const content = await contentOf();
  const scores = content.causes.recurring.rows.map((one) => one.score.score);
  assert.deepEqual(scores, [...scores].sort((left, right) => right - left));
  const verdict = rowFor(content, "a verdict");
  assert.equal(verdict.oneOff, true);
  assert.ok(content.causes.oneOff.rows.includes(verdict));
  assert.ok(content.causes.recurring.rows.every((one) => !one.oneOff));
  assert.ok(content.causes.recurring.rows.every((one) => one.figures.daysSeen > 1 || one.recurred));
});

test("a fixed cause is listed with its version, its realized gain and the days since with no recurrence", async () => {
  const content = await contentOf();
  const merge = rowFor(content, "a merge");
  assert.ok(content.causes.fixed.rows.includes(merge));
  assert.equal(merge.release.version, "3.1.0");
  assert.equal(merge.daysSince, 6);
  const gain = merge.gain.realized;
  assert.equal(gain.early, false);
  /* Before the release's day: 10, 9, 8 and 7 days ago, three of them seen; after it: 5 to 1 days ago, none. */
  assert.equal(gain.before.days, 4);
  assert.equal(gain.before.callsADay, 0.8);
  assert.equal(gain.after.days, 5);
  assert.equal(gain.after.callsADay, 0);
  assert.deepEqual(gain.difference, { calls: 0.8, minutes: 0 });
  assert.deepEqual(gain.cumulative, { calls: 4, minutes: 0, days: 5 });
  assert.equal(gain.before.thin, "thin");
});

test("a cause met by a run begun after its fix's release is recurring, flagged with the version, its calls since and the issue to reopen", async () => {
  const content = await contentOf();
  const note = rowFor(content, "a note");
  assert.ok(content.causes.recurring.rows.includes(note));
  assert.deepEqual(note.recurred, { version: "3.2.0", calls: 1, days: 1, reopen: "ISS-3" });
  const page = currentPageOf(content);
  assert.match(page, /recurred after the fix at 3\.2\.0: 1 call\(s\) over 1 day\(s\) since; the issue to reopen is ISS-3/u);
});

test("a fixed cause followed for followDays with no recurrence leaves the report and is counted", async () => {
  const content = await contentOf();
  assert.equal(rowFor(content, "a gone"), undefined);
  assert.equal(content.causes.left, 1);
  assert.match(currentPageOf(content), /1 fixed cause\(s\) left the report after 7 day\(s\) with no recurrence/u);
});

test("a realized gain is too early to read where either side holds fewer than earlyDays days", async () => {
  const held = { ...scenario(), marks: [release("3.1.0", "ISS-2", ago(2))] };
  const content = await contentOf(held);
  const gain = rowFor(content, "a merge").gain.realized;
  assert.equal(gain.early, true);
  assert.equal(gain.after.days, 1);
  assert.match(currentPageOf(content), /too early to read/u);
});

test("the projected gain of an open cause is a week's calls and wait minutes with the basis they were made from", async () => {
  const content = await contentOf();
  const plan = rowFor(content, "a plan");
  const days = content.series.days.length;
  assert.equal(plan.gain.projected.callsAWeek, Math.round(((6 / days) * 7) * 10) / 10);
  assert.equal(plan.gain.projected.basis, `1 call(s) and 0 wait minute(s) a day it appears, on 6 of the ${days} day(s) held, × 7`);
});

test("every row names its non-wait minutes, gate calls and lost output missing with ISS-2477", async () => {
  const content = await contentOf();
  assert.ok(everyRow(content).every((one) => one.missing.issue === "ISS-2477"));
  assert.match(currentPageOf(content), /missing: minutes of calls other than long waits, gate calls, and lost output .* \(ISS-2477\)/u);
});

test("the score is the configured formula's, printed beside its name and the figures it was made from", async () => {
  const content = await contentOf();
  const plan = rowFor(content, "a plan");
  assert.deepEqual(plan.score, { score: 6, formula: "product", from: { days: 6, calls: 1, minutes: 0 } });
  const summed = await contentOf(scenario(), reportsRoom(), { settings: { ...settings, formula: "sum", days: 2 } });
  assert.deepEqual(rowFor(summed, "a plan").score, { score: 13, formula: "sum", from: { days: 6, calls: 1, minutes: 0 } });
  assert.match(currentPageOf(content), /6 by product, from 6 day\(s\), 1 call\(s\) and 0 wait minute\(s\) a day seen/u);
});

test("under the default formula and weights, more days at the same daily cost scores higher", () => {
  const of = (days) => FORMULAS[DEFAULTS.formula].of({ days, calls: 4, minutes: 2 }, DEFAULTS);
  assert.ok(of(3) > of(2));
  assert.ok(FORMULAS.sum.of({ days: 3, calls: 4, minutes: 2 }, DEFAULTS) > FORMULAS.sum.of({ days: 2, calls: 4, minutes: 2 }, DEFAULTS));
});

test("each write asks the tracker for at most thirty causes no earlier write matched, and says how many are unmatched", async () => {
  const runs = Array.from({ length: MATCHED + 5 }, (_, index) => runOf(ago(1), `thing ${index}`));
  const asked = [];
  const tracker = { rows: new Map(), match: async (text) => { asked.push(text); return null; }, issue: async (key) => ({ key }) };
  const content = await currentOf(readingOf(runs), { dir: reportsRoom(), tracker, settings, now: NOW, marks: [] });
  assert.equal(asked.length, MATCHED);
  assert.equal(content.causes.matching.asked, MATCHED);
  /* Thirty-five refusals, the repeat and the wait every fixture run carries: none matched. */
  assert.equal(content.causes.matching.unmatched, MATCHED + 7);
  assert.match(currentPageOf(content), new RegExp(`asked the tracker for ${MATCHED} more, at most ${MATCHED}; ${MATCHED + 7} cause\\(s\\) are unmatched`, "u"));
});

test("a cause an earlier write matched keeps its issues on a later write, whatever its rank", async () => {
  const held = scenario();
  const dir = reportsRoom();
  writeFileSync(join(dir, "index.html"), currentPageOf(await contentOf(held, dir)));
  const blind = { ...held.tracker, match: async () => null };
  const later = await contentOf({ ...held, tracker: blind }, dir);
  assert.deepEqual(rowFor(later, "a plan").issues.map((one) => one.key), ["ISS-1"]);
  assert.equal(later.causes.matching.followed > 0, true);
});

test("where the tracker cannot be asked, each unmatched row says why and the content is still made", async () => {
  const content = await contentOf({ ...scenario(), tracker: { refused: "no Forge endpoint is saved on this machine" } });
  assert.ok(everyRow(content).length > 0);
  assert.ok(everyRow(content).every((one) => one.unmatched === "no Forge endpoint is saved on this machine"));
});

test("the report's text says neither better nor worse", async () => {
  assert.doesNotMatch(currentPageOf(await contentOf()), /\b(better|worse)\b/iu);
});

test("the report key is read member by member with its defaults, and a wrong member is refused by its full name", () => {
  const room = tempRoom("stats-settings-");
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = room;
  mkdirSync(join(room, "forge"), { recursive: true });
  const write = (report) => writeFileSync(join(room, "forge", "config.json"), JSON.stringify(report === undefined ? {} : { report }));
  try {
    write(undefined);
    assert.deepEqual({ ...reportSettings(), from: null }, { ...DEFAULTS, from: null });
    write({ score: { formula: "sum", calls: 2 }, followDays: 10 });
    const held = reportSettings();
    assert.deepEqual([held.formula, held.days, held.calls, held.minutes, held.followDays, held.earlyDays], ["sum", 1, 2, 1, 10, 3]);
    for (const [report, key] of [[{ score: { days: -1 } }, "report.score.days"], [{ score: { minutes: "2" } }, "report.score.minutes"],
      [{ earlyDays: Number.NaN }, "report.earlyDays"], [{ score: { formula: "max" } }, "report.score.formula"], [5, "report"],
      [{ score: [] }, "report.score"]]) {
      write(report);
      assert.match(reportSettings().refused, new RegExp(`\`${key.replaceAll(".", "\\.")}\` in .* is .*Nothing was written`, "u"));
    }
  } finally {
    if (was === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = was;
  }
});
