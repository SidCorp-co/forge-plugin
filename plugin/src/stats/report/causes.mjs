/* Every friction entry a run met, followed across every day held: its series, the days it was seen,
   the runs begun after a moment that met it, its score, and where it stands — new, recurring or
   fixed — with the gain its fix realized or the gain fixing it would project. Each entry is the
   day's page's own (`entriesOf` over `frictionOf`), read a run at a time so that a release's moment
   splits a day; nothing here counts a call of its own — docs/cli/stats.md. */
import { dayOf, shifted } from "../daily/day.mjs";
import { frictionOf } from "../daily/gather.mjs";
import { entriesOf } from "../daily/opportunities.mjs";
import { FORMULAS } from "./settings.mjs";
import { FLOOR, THIN } from "../model-rows.mjs";

const DAY_MS = 86_400_000;

/** What no reader keeps per friction key, named on every row in the figure's place. */
export const PER_CAUSE_MISSING = {
  reading: "minutes of calls other than long waits, gate calls, and lost output (hand-backs, reopens, "
    + "unproved or declined gates, parks, runs stopped short) per cause",
  issue: "ISS-2477",
};

/** The key a cause is followed by: the entry's kind and the cause the day's page names, which for a
 *  refusal is its gate's and holds every wording the gate named as one. */
const causeKey = (entry) => `${entry.kind} · ${entry.cause ?? entry.met}`;

/** Every day from the first one held through today, oldest first. */
export const heldDaysFrom = (first, now) => {
  const days = [];
  if (first === null) return days;
  for (let day = dayOf(first); day <= dayOf(now); day = shifted(day, 1)) days.push(day);
  return days;
};

const blank = (entry) => ({ key: causeKey(entry), kind: entry.kind, met: entry.met, gate: entry.gate ?? null,
  firstAt: Infinity, lastAt: -Infinity, byDay: new Map(), runs: [] });

/** Each cause the runs met, with what it cost each day and each run that met it. */
export const causesOf = (runs) => {
  const held = new Map();
  for (const run of runs) {
    const day = dayOf(run.endedAt);
    for (const entry of entriesOf(frictionOf([run]))) {
      const cause = held.get(causeKey(entry)) ?? blank(entry);
      const was = cause.byDay.get(day) ?? { calls: 0, runs: 0, minutes: 0 };
      cause.byDay.set(day, { calls: was.calls + entry.calls, runs: was.runs + 1,
        minutes: Math.round((was.minutes + (entry.minutes ?? 0)) * 10) / 10 });
      cause.runs.push({ startedAt: run.startedAt, endedAt: run.endedAt, calls: entry.calls, minutes: entry.minutes ?? 0 });
      cause.firstAt = Math.min(cause.firstAt, run.endedAt);
      /* The wording of the latest run to meet it, which is the one a reader meets now. */
      if (run.endedAt >= cause.lastAt) Object.assign(cause, { lastAt: run.endedAt, met: entry.met });
      held.set(cause.key, cause);
    }
  }
  return [...held.values()];
};

const sumOver = (causes, pick) => causes.reduce((sum, one) => sum + pick(one), 0);

/** A row's figures over the causes it joins: the days seen, the calls and wait minutes a day it was
 *  seen, and its series over the days held. */
export const figuresOf = (causes, days) => {
  const series = days.map((day) => {
    const calls = sumOver(causes, (one) => one.byDay.get(day)?.calls ?? 0);
    const runs = sumOver(causes, (one) => one.byDay.get(day)?.runs ?? 0);
    const minutes = Math.round(sumOver(causes, (one) => one.byDay.get(day)?.minutes ?? 0) * 10) / 10;
    return { day, calls, runs, minutes };
  });
  const seen = series.filter((one) => one.runs > 0);
  const calls = sumOver(seen, (one) => one.calls);
  const minutes = sumOver(seen, (one) => one.minutes);
  const perDay = (total) => (seen.length ? Math.round((total / seen.length) * 10) / 10 : 0);
  return { series, daysSeen: seen.length, calls, minutes: Math.round(minutes * 10) / 10,
    callsADay: perDay(calls), minutesADay: perDay(minutes), firstAt: Math.min(...causes.map((one) => one.firstAt)),
    runs: sumOver(seen, (one) => one.runs) };
};

/** The score of a row by the configured formula, rounded to a tenth, with the figures it was made from. */
export const scoreOf = (figures, settings) => {
  const made = { days: figures.daysSeen, calls: figures.callsADay, minutes: figures.minutesADay };
  return { score: Math.round(FORMULAS[settings.formula].of(made, settings) * 10) / 10, formula: settings.formula, from: made };
};

/** What met the causes in runs begun after a moment: their calls and the days they fell on. */
export const recurrenceAfter = (causes, at) => {
  const after = causes.flatMap((one) => one.runs).filter((run) => run.startedAt > at);
  return { calls: sumOver(after, (one) => one.calls), days: new Set(after.map((one) => dayOf(one.endedAt))).size };
};

/** What a row's gates refused in runs begun after a moment under a key the row does not carry: the
 *  gates, how many such keys and the days they fell on; null where nothing did. A gate's other
 *  wording may be this cause reworded, so a row is never read as fixed past one. */
export const gateAfter = (causes, all, at) => {
  const gates = new Set(causes.map((one) => one.gate).filter(Boolean));
  const carried = new Set(causes.map((one) => one.key));
  const after = all.filter((one) => gates.has(one.gate) && !carried.has(one.key))
    .flatMap((one) => one.runs.filter((run) => run.startedAt > at).map((run) => ({ key: one.key, day: dayOf(run.endedAt) })));
  if (!after.length) return null;
  return { gates: [...gates], keys: new Set(after.map((one) => one.key)).size, days: new Set(after.map((one) => one.day)).size };
};

const sideOf = (series, runsADay, pick) => {
  const held = series.filter(pick);
  const days = held.length;
  const runs = sumOver(held, (one) => runsADay.get(one.day) ?? 0);
  const perDay = (total) => (days ? Math.round((total / days) * 10) / 10 : null);
  return { days, runs, thin: runs < FLOOR ? THIN : null,
    callsADay: perDay(sumOver(held, (one) => one.calls)), minutesADay: perDay(sumOver(held, (one) => one.minutes)) };
};

/** The cost a day over the held days before the release's day against the whole days after it, the
 *  difference and that difference times the days since; too early where a side holds fewer days
 *  than the configured window. `runsADay` is every run ending on each day, whatever it met. */
export const realizedOf = (figures, release, { runsADay, today, earlyDays }) => {
  const on = dayOf(release.at);
  const before = sideOf(figures.series, runsADay, (one) => one.day < on);
  const after = sideOf(figures.series, runsADay, (one) => one.day > on && one.day < today);
  const early = before.days < earlyDays || after.days < earlyDays;
  if (early) return { early: true, before, after, earlyDays };
  const calls = Math.round((before.callsADay - after.callsADay) * 10) / 10;
  const minutes = Math.round((before.minutesADay - after.minutesADay) * 10) / 10;
  return { early: false, before, after, difference: { calls, minutes },
    cumulative: { calls: Math.round(calls * after.days * 10) / 10, minutes: Math.round(minutes * after.days * 10) / 10, days: after.days } };
};

/** What fixing an open row would save a week: its cost a day it appears times the share of the days
 *  held it appeared on, times seven, with the basis it was made from. */
export const projectedOf = (figures, heldCount) => {
  const share = heldCount ? figures.daysSeen / heldCount : 0;
  return {
    callsAWeek: Math.round(figures.callsADay * share * 7 * 10) / 10,
    minutesAWeek: Math.round(figures.minutesADay * share * 7 * 10) / 10,
    basis: `${figures.callsADay} call(s) and ${figures.minutesADay} wait minute(s) a day it appears, `
      + `on ${figures.daysSeen} of the ${heldCount} day(s) held, × 7`,
  };
};

/** Whether a row is new: first met since the report was last written, or within the last day. */
const isNew = (figures, { previousAt, now }) =>
  figures.firstAt > now - DAY_MS || (previousAt !== null && figures.firstAt > previousAt);

/** The days since a release, counted whole. */
export const daysSince = (at, now) => Math.floor((now - at) / DAY_MS);

/** Where a row stands: new, fixed, left (fixed and followed for the configured days with no
 *  recurrence), recurring, or one-off. A row that recurred after its fix, or whose gate refused after
 *  it under a key the row does not carry, is recurring whatever else. */
export const sectionOf = (row, { previousAt, now, followDays }) => {
  if (row.recurred || row.unsettled) return "recurring";
  if (row.release) return daysSince(row.release.at, now) >= followDays ? "left" : "fixed";
  if (isNew(row.figures, { previousAt, now })) return "new";
  return row.figures.daysSeen > 1 ? "recurring" : "one-off";
};

/** Recurring before one-off, then by score: a cause seen on one day ranks below every one that recurred. */
export const byRank = (left, right) => Number(left.section === "one-off") - Number(right.section === "one-off")
  || right.score.score - left.score.score;
