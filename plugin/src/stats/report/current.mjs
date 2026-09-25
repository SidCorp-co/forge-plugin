/* `forge stats report`: the verb, the content it prints or renders, and the writer that holds the
   page while it writes — docs/cli/stats.md. */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dayOf } from "../daily/day.mjs";
import { byRank, causesOf, daysSince, figuresOf, heldDaysFrom, PER_CAUSE_MISSING, projectedOf, realizedOf,
  recurrenceAfter, scoreOf, sectionOf } from "./causes.mjs";
import { familiesOf, MATCHED, matchesOf, trackerOf } from "./families.mjs";
import { corporaOf, dayFiguresOf, readingOf, runsOn, within } from "../daily/gather.mjs";
import { currentPageOf } from "./current-page.mjs";
import { projectsOn, registered } from "../daily/projects.mjs";
import { FORMULAS, reportSettings } from "./settings.mjs";
import { CURRENT, INDEX, againPath, clearMark, contentOf as heldContentOf, heldDays, readPage, reportsDir,
  shownDeep, takeMark, writePage, writerHolds } from "../daily/store.mjs";
import { indexLineOf } from "../daily/summary.mjs";
import { RELEASES, marksOf } from "../marks/marks.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags } from "../../resolve/flags.mjs";

const VERB = "stats report";

export const REPORT_USAGE = [
  "Usage: forge stats report [--open] [--json]",
  "The harness report as it stands now, over every day this device holds, written as index.html in",
  "the reports directory: runs, minutes, calls, refusals, consults, landings and releases each as a",
  "series whose last point is today so far; the causes behind the cost, one row per root cause, as",
  "new, recurring and fixed; the gain each fix realized and each open cause would project; and every",
  "dated snapshot `forge stats daily` holds. It states figures and judges none: `forge stats eval`",
  "and the harness-eval skill do that. A project whose `report` is `daily` rewrites it at each",
  "session start and each release reading, as its `reportOn` names; the score and its windows are",
  "the `report` table of this device's config.json.",
  "",
  "  --open  print the path of the report and nothing else, for a command that opens it",
  "  --json  print the report's content as one object and write nothing",
].join("\n");

/** How many rows each section lists past the ones a matched issue keeps on the report. */
const LISTED = { new: 15, recurring: 25, "one-off": 10 };

const FIXING = new Set(["confirmed", "approved", "in_progress", "developed", "testing", "awaiting_release"]);

/* The latest release reading holding any of a row's issues: the fix the row is read against. */
const releaseOf = (issues, marks) => {
  const keys = new Set(issues.map((one) => one.key));
  const held = marks.filter((one) => (one.issues ?? []).some((key) => keys.has(key)))
    .map((one) => ({ version: one.version ?? null, at: Date.parse(one.at) || 0, issue: one.issues.find((key) => keys.has(key)) }))
    .sort((left, right) => right.at - left.at);
  return held[0] ?? null;
};

const statusOf = (issues, release) => {
  if (release) return "released";
  if (issues.some((one) => FIXING.has(one.status))) return "being fixed";
  if (issues.some((one) => one.status === "closed")) return "closed, with no release reading on this device";
  return "open";
};

/** The row a family of causes reads as, with every figure the page and `--json` carry. */
const rowOf = (family, context) => {
  const { days, marks, settings, now, previousAt, runsADay, today } = context;
  const figures = figuresOf(family.causes, days);
  const release = releaseOf(family.issues, marks);
  const again = release ? recurrenceAfter(family.causes, release.at) : null;
  const recurred = again?.days
    ? { version: release.version, calls: again.calls, days: again.days, reopen: release.issue } : null;
  const row = { causes: family.causes.map((one) => ({ kind: one.kind, met: one.met, key: one.key })),
    issues: family.issues, unmatched: family.unmatched, status: statusOf(family.issues, release), release, recurred, figures };
  const section = sectionOf(row, { previousAt, now, followDays: settings.followDays });
  return {
    ...row,
    section,
    oneOff: section === "one-off",
    score: scoreOf(figures, settings),
    daysSince: release ? daysSince(release.at, now) : null,
    gain: release
      ? { realized: realizedOf(figures, release, { runsADay, today, earlyDays: settings.earlyDays }) }
      : { projected: projectedOf(figures, days.length) },
    missing: PER_CAUSE_MISSING,
    figures: { ...figures, firstSeen: new Date(figures.firstAt).toISOString(),
      seen: figures.series.filter((one) => one.runs > 0).map((one) => one.day),
      series: figures.series.map((one) => one.calls) },
  };
};

/* A section's rows, its tail past the cap counted rather than listed; a row with an issue is never cut. */
const listed = (rows, section) => {
  const all = rows.filter((one) => one.section === section).sort(byRank);
  const kept = all.filter((one, index) => one.issues.length || index < LISTED[section]);
  return { rows: kept, unlisted: all.length - kept.length };
};

/* The matches this write holds, keyed by cause, for the next write to carry. */
const followedOf = (rows) => Object.fromEntries(rows.filter((one) => one.section !== "left" && one.issues.length)
  .flatMap((row) => row.causes.map((one) => [one.key, row.issues.map((issue) => issue.key)])));

/** The snapshot lines, newest first, each as that day's own summary keeps it. */
const snapshotsIn = (dir) => heldDays(dir).map((day) => {
  const held = heldContentOf(readPage(dir, day) ?? "");
  return { day, line: held ? indexLineOf(held) : null };
});

/** What the previous current report said of itself, or nothing where none was written. */
const previousIn = (dir) => {
  try {
    const held = heldContentOf(readFileSync(join(dir, INDEX), "utf8"));
    return held?.kind === CURRENT ? held : null;
  } catch {
    return null;
  }
};

const seriesOf = (reading, days, marks) => {
  const each = days.map((day) => dayFiguresOf(reading, day));
  const pick = (name) => each.map((one) => one[name]);
  return { days, runs: pick("runs"), medianMinutes: pick("medianMinutes"), medianCalls: pick("medianCalls"),
    refusals: pick("refusals"), consults: pick("consults"), landings: pick("landings"),
    releases: days.map((day) => marks.filter((one) => within(Date.parse(one.at) || 0, day)).length) };
};

/** The current report's content: what `--json` prints and the page renders. */
export const currentOf = async (reading, { dir, unread = [], tracker, settings, now = Date.now(), marks = marksOf(RELEASES) }) => {
  const days = heldDaysFrom(reading.first, now);
  const today = dayOf(now);
  const previous = previousIn(dir);
  const previousAt = previous ? Date.parse(previous.written) || null : null;
  const causes = causesOf(reading.all);
  const alone = causes.map((one) => ({ ...one, score: scoreOf(figuresOf([one], days), settings) }))
    .sort((left, right) => right.score.score - left.score.score);
  const matches = await matchesOf(alone, tracker, previous?.followed ?? {});
  const families = await familiesOf(causes, tracker, matches);
  const runsADay = new Map(days.map((day) => [day, runsOn(reading.all, day).length]));
  const context = { days, marks, settings, now, previousAt, runsADay, today };
  const rows = families.map((one) => rowOf(one, context));
  const sections = Object.fromEntries(["new", "recurring", "one-off", "fixed"].map((one) => [one, listed(rows, one)]));
  return {
    kind: CURRENT,
    written: new Date(now).toISOString(),
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    span: { from: days[0] ?? null, to: today },
    projects: reading.projects.map((one) => ({ name: one.name, slug: one.slug, checkout: one.checkout })),
    unread: unread.map((one) => ({ name: one.name, slug: one.slug })),
    series: seriesOf(reading, days, marks),
    settings: { ...settings, said: FORMULAS[settings.formula].said },
    causes: {
      counted: causes.length,
      rows: rows.length,
      matching: { asked: matches.asked, limit: MATCHED, followed: Object.keys(previous?.followed ?? {}).length,
        unmatched: causes.length - matches.matched.size, refused: tracker.refused ?? null },
      new: sections.new, recurring: sections.recurring, oneOff: sections["one-off"], fixed: sections.fixed,
      left: rows.filter((one) => one.section === "left").length,
    },
    followed: followedOf(rows),
    missing: PER_CAUSE_MISSING,
    snapshots: snapshotsIn(dir),
    evaluator: "forge stats eval",
  };
};

/** The current report's content off a reading already made, masked. */
const contentFrom = async (dir, reading, found) => {
  const settings = reportSettings();
  if (settings.refused) fail(settings.refused);
  const tracker = await trackerOf(registered());
  return shownDeep(await currentOf(reading, { dir, unread: found.unread, tracker, settings }),
    [dir, ...found.read.map((one) => one.checkout)]);
};

/* With no bound on the landings, since the series draws a point for every day held. */
const contentNow = async (dir) => {
  const found = projectsOn();
  return contentFrom(dir, readingOf({ projects: await corporaOf(found.read, null) }), found);
};

/** What `stats daily` hands `writeCurrent`: the page written from the corpora that day already read. */
export const writerFrom = (reading, found) => async (dir) => {
  const content = await contentFrom(dir, reading, found);
  return { path: writePage(dir, INDEX, currentPageOf(content)), content };
};

const writeOnce = async (dir) => {
  const content = await contentNow(dir);
  return { path: writePage(dir, INDEX, currentPageOf(content)), content };
};

/** The report written under the writer's mark, by `first` and then afresh. A writer that finds the
 *  mark held leaves the flag and returns null; the holder reads the flag before and after it lets go
 *  of the mark and writes once more for each, reading afresh, so a release landing while it wrote is
 *  on the page it leaves. `again` is what writes each time after the first; `take` is the mark's. */
export const writeCurrent = async (dir, first = writeOnce, again = writeOnce, take = takeMark) => {
  writerHolds(dir, CURRENT);
  if (!take(dir, CURRENT)) {
    writeFileSync(againPath(dir), `${process.pid}\n`);
    /* A holder that let go between the refused take and the flag never read it: taken now, this
       writer writes for its own flag. */
    writerHolds(dir, CURRENT);
    if (!take(dir, CURRENT)) return null;
  }
  let wrote = null;
  try {
    for (let write = first; ; write = again) {
      rmSync(againPath(dir), { force: true });
      wrote = await write(dir);
      if (!existsSync(againPath(dir))) break;
    }
  } finally {
    clearMark(dir, CURRENT);
  }
  if (existsSync(againPath(dir))) return (await writeCurrent(dir, again, again, take)) ?? wrote;
  return wrote;
};

export const printReport = async (rest) => {
  const { open, json } = flags(rest, VERB, ["--open", "--json"], { usage: REPORT_USAGE });
  const reports = reportsDir();
  if (json) return console.log(JSON.stringify(await contentNow(reports.dir), null, 2));
  const wrote = await writeCurrent(reports.dir);
  if (!wrote) {
    const said = `${join(reports.dir, INDEX)}\nA writer holds the current report; it writes once more before it exits, so what this asked for lands.`;
    if (open) console.log(said.split("\n")[0]);
    else console.log(said);
    return null;
  }
  if (open) return console.log(wrote.path);
  const held = wrote.content.causes;
  console.log([`${held.rows} root cause(s) over ${wrote.content.series.days.length} day(s): ${held.new.rows.length} new, `
    + `${held.recurring.rows.length} recurring, ${held.oneOff.rows.length} one-off, ${held.fixed.rows.length} fixed, ${held.left} left after `
    + `${wrote.content.settings.followDays} day(s) with no recurrence.`, "",
  `Wrote the current report: ${wrote.path}`, `Reports directory from ${reports.from}.`].join("\n"));
  return null;
};
