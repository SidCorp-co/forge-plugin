/* The current report as the page a reader opens first: the span it covers, each headline figure as a
   series ending at today so far, the causes in three sections with their gain and score, and the
   dated snapshots under it. Everything is inline, as the day's page is, and every figure is said in
   words beside any drawing of it — docs/cli/stats.md. */
import { SORT_SCRIPT, STYLE, at, esc, missing, said, table, trendSvg } from "./page.mjs";
import { contentBlock } from "./store.mjs";

const TODAY = "today so far";

const SERIES = [
  ["runs", "issue-flow runs a day"],
  ["medianMinutes", "median minutes a run"],
  ["medianCalls", "median calls a run"],
  ["refusals", "refused calls a day"],
  ["consults", "answered consults a day"],
  ["landings", "landing passes a day"],
  ["releases", "releases a day"],
];

const seriesHtml = (series) => {
  const last = series.days.length - 1;
  const nameOf = (day, index) => (index === last ? TODAY : day.slice(5));
  const wide = Math.max(140, Math.min(720, series.days.length * 12));
  return `<section id="series"><h2>Every day held</h2>`
    + `<p>Each figure a day from ${esc(series.days[0] ?? "none")} to today, the last point being ${TODAY}.</p>`
    + SERIES.map(([name, label]) => trendSvg(label, series.days, series[name], { span: "every day held", nameOf, wide })).join("")
    + "</section>";
};

const issuesCell = (row) => {
  if (!row.issues.length) return { value: "~", html: `none matched: ${esc(row.unmatched ?? "not asked")}` };
  return { value: row.issues[0].key, html: row.issues.map((one) => `${esc(one.key)}${one.status ? ` (${esc(one.status)})` : ""}`
    + `${one.unread ? ` — could not be read: ${esc(one.unread)}` : ""}`).join("<br>") };
};

const causesCell = (row) => ({ value: row.causes[0].met, html: row.causes.map((one) => `${esc(one.kind)}: ${esc(one.met)}`).join("<br>") });

const seenCell = (row) => ({ value: row.figures.daysSeen, html: `${esc(row.figures.daysSeen)} day(s): ${esc(row.figures.seen.join(", "))}` });

const scoreCell = (row) => ({ value: row.score.score,
  html: `${esc(row.score.score)} by ${esc(row.score.formula)}, from ${esc(row.score.from.days)} day(s), `
    + `${esc(row.score.from.calls)} call(s) and ${esc(row.score.from.minutes)} wait minute(s) a day seen` });

const projectedCell = (row) => {
  const held = row.gain.projected;
  return held ? { value: held.callsAWeek, html: `${esc(held.callsAWeek)} call(s) and ${esc(held.minutesAWeek)} wait minute(s) a week: ${esc(held.basis)}` }
    : "";
};

const sideSaid = (label, side) => `${label} ${side.days} day(s), ${said(side.callsADay)} call(s) and ${said(side.minutesADay)} wait minute(s) a day`
  + ` over ${side.runs} run(s)${side.thin ? `, ${side.thin}` : ""}`;

const realizedCell = (row) => {
  const held = row.gain.realized;
  if (!held) return "";
  if (held.early) {
    return { value: -1, html: `too early to read: ${esc(sideSaid("before,", held.before))}; ${esc(sideSaid("after,", held.after))}; `
      + `each side needs ${esc(held.earlyDays)} day(s)` };
  }
  return { value: held.cumulative.calls, html: `${esc(sideSaid("before,", held.before))}; ${esc(sideSaid("after,", held.after))}; `
    + `${esc(held.difference.calls)} call(s) and ${esc(held.difference.minutes)} wait minute(s) a day fewer after, `
    + `${esc(held.cumulative.calls)} call(s) and ${esc(held.cumulative.minutes)} minute(s) over the ${esc(held.cumulative.days)} day(s) since` };
};

const flagOf = (row) => {
  if (row.recurred) {
    return `recurred after the fix at ${row.recurred.version}: ${row.recurred.calls} call(s) over ${row.recurred.days} day(s) since; `
      + `the issue to reopen is ${row.recurred.reopen}`;
  }
  return row.oneOff ? "one-off" : "";
};

const OPEN_COLUMNS = ["rank", "cause", "issues", "status", "seen", "calls", "score", "projected gain", "flag"];

const openRow = (row, index) => [index + 1, causesCell(row), issuesCell(row), row.status, seenCell(row),
  row.figures.calls, scoreCell(row), projectedCell(row), flagOf(row)];

const unlistedSaid = (held) => (held.unlisted ? `<p>${esc(held.unlisted)} more ranked below these and unlisted.</p>` : "");

const newHtml = (held) => `<section id="new"><h2>New detected</h2>`
  + (held.rows.length
    ? table(["cause", "first seen", "runs", "calls", "issues"], held.rows.map((row) => [causesCell(row),
      `${at(Date.parse(row.figures.firstSeen))}Z`, row.figures.runs, row.figures.calls, issuesCell(row)]))
    : "<p>No cause was first seen since the report was last written or within the last day.</p>")
  + unlistedSaid(held) + "</section>";

const recurringHtml = (recurring, oneOff) => `<section id="recurring"><h2>Recurring</h2>`
  + (recurring.rows.length || oneOff.rows.length
    ? table(OPEN_COLUMNS, [...recurring.rows, ...oneOff.rows].map(openRow))
    : "<p>No cause was seen on more than one day, or on a single day before the last write.</p>")
  + unlistedSaid(recurring) + unlistedSaid(oneOff)
  + "<p>Causes seen on a single day are marked one-off and rank below every recurring one.</p></section>";

const fixedHtml = (fixed, left, followDays) => `<section id="fixed"><h2>Fixed</h2>`
  + (fixed.rows.length
    ? table(["cause", "issues", "release", "days since, no recurrence", "realized gain"], fixed.rows.map((row) => [causesCell(row),
      issuesCell(row), `${row.release.version} at ${at(row.release.at)}Z`, row.daysSince, realizedCell(row)]))
    : "<p>No cause whose issue a release reading carries has gone without recurring since.</p>")
  + `<p>${esc(left)} fixed cause(s) left the report after ${esc(followDays)} day(s) with no recurrence.</p></section>`;

const snapshotsHtml = (snapshots) => `<section id="snapshots"><h2>Dated snapshots</h2>`
  + (snapshots.length
    ? `<ul>${snapshots.map((one) => `<li><a href="${esc(one.day)}.html">${esc(one.day)}</a> — `
      + `${esc(one.line ?? "its page holds no summary this copy can read")}</li>`).join("")}</ul>`
    : "<p>No dated snapshot is held yet: <code>forge stats daily</code> writes one.</p>")
  + "</section>";

const matchingSaid = (causes) => {
  const held = causes.matching;
  const refused = held.refused ? ` The tracker could not be asked: ${esc(held.refused)}.` : "";
  return `<p>${esc(causes.counted)} cause(s) in ${esc(causes.rows)} row(s). This write carried ${esc(held.followed)} match(es) `
    + `an earlier write made and asked the tracker for ${esc(held.asked)} more, at most ${esc(held.limit)}; `
    + `${esc(held.unmatched)} cause(s) are unmatched.${refused}</p>`;
};

/** The whole page for the current report's content. */
export const currentPageOf = (content) => {
  const { causes, settings } = content;
  const unread = content.unread.length
    ? `<p>Registered and not read, no transcript store naming a checkout of it: ${content.unread.map((one) => esc(one.name)).join(", ")}.</p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Harness report</title>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLE}</style></head><body>`
    + `<h1>Harness report</h1>`
    + `<p>As of ${esc(at(Date.parse(content.written)))}Z, in ${esc(content.zone)}, over every day held from `
    + `${esc(content.span.from ?? "none")} to ${esc(content.span.to)} and ${esc(content.projects.length)} project(s): `
    + `${content.projects.map((one) => esc(one.name)).join(", ") || "none"}.</p>${unread}`
    + seriesHtml(content.series)
    + `<section id="causes"><h2>Causes</h2>${matchingSaid(causes)}`
    + `<p>Score: ${esc(settings.said)}, with days ${esc(settings.days)}, calls ${esc(settings.calls)} and minutes ${esc(settings.minutes)}, `
    + `read from ${esc(settings.from)}.</p><p>${missing(content.missing)}</p></section>`
    + newHtml(causes.new) + recurringHtml(causes.recurring, causes.oneOff) + fixedHtml(causes.fixed, causes.left, settings.followDays)
    + snapshotsHtml(content.snapshots)
    + `<p>This report states figures and proposes no change. What they amount to is the evaluator's reading: `
    + `<code>${esc(content.evaluator)}</code>, or the harness-eval skill.</p>`
    + `<script>${SORT_SCRIPT}</script>${contentBlock(content)}</body></html>\n`;
};
