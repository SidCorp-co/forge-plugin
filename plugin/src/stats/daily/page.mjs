/* The day's content as a page a person reads at a glance: a summary, one section per heading, each
   opening with its headline beside a seven-day trend, tables that sort on a header click. Everything
   is inline — style, script, charts — so the file opens with no network and travels as one file.
   Colour only ever repeats what the words beside it say: docs/cli/stats.md. */
import { contentBlock } from "./store.mjs";
import { summaryOf } from "./summary.mjs";
import { redBatchSaid } from "../marks/red-batches.mjs";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/gu, (one) => ESCAPES[one]);

export const at = (moment) => (moment === null || moment === undefined ? "—" : new Date(moment).toISOString().slice(0, 16).replace("T", " "));

/** A figure, or the words for its absence: an absent figure is never a nought. */
export const said = (value, unit = "") => (value === null || value === undefined ? "none" : `${value}${unit}`);

export const missing = (one) => `<span class="missing">missing: ${esc(one.reading)} — no reader computes it yet (${esc(one.issue)})</span>`;

const WIDE = 140;
const HIGH = 32;

/** A value a day as a line, a gap where a day holds none; the values are said in the caption beside
 *  it, so the chart adds a shape and carries no figure the text does not. `span` names the days and
 *  `nameOf` each one in the caption; `wide` is the drawing's width. */
export const trendSvg = (label, days, values, { span = "seven days", nameOf = (day) => day.slice(5), wide = WIDE } = {}) => {
  const known = values.filter((one) => one !== null && one !== undefined);
  const top = Math.max(1, ...known);
  const step = wide / Math.max(1, values.length - 1);
  const point = (value, index) => `${Math.round(index * step)},${Math.round(HIGH - 2 - ((value / top) * (HIGH - 4)))}`;
  const runs = [];
  let current = [];
  values.forEach((value, index) => {
    if (value === null || value === undefined) {
      if (current.length) runs.push(current);
      current = [];
    } else current.push(point(value, index));
  });
  if (current.length) runs.push(current);
  const lines = runs.map((one) => (one.length === 1
    ? `<circle cx="${one[0].split(",")[0]}" cy="${one[0].split(",")[1]}" r="2" />`
    : `<polyline fill="none" points="${one.join(" ")}" />`)).join("");
  const caption = days.map((day, index) => `${nameOf(day, index)} ${said(values[index])}`).join(", ");
  return `<figure class="trend"><svg viewBox="0 0 ${wide} ${HIGH}" width="${wide}" height="${HIGH}" role="img" `
    + `aria-label="${esc(label)}"><title>${esc(label)}: ${esc(caption)}</title>${lines}</svg>`
    + `<figcaption>${esc(label)}, ${esc(span)}: ${esc(caption)}</figcaption></figure>`;
};

/** A table whose every column sorts: the header row names the columns, and each cell carries the
 *  value it sorts by where the text it shows is not that value. */
export const table = (columns, rows) => `<table class="sortable"><thead><tr>${columns.map((one) =>
  `<th scope="col" title="sort by ${esc(one)}">${esc(one)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) =>
  `<tr>${row.map((cell) => (cell && typeof cell === "object"
    ? `<td data-value="${esc(cell.value)}">${cell.html}</td>`
    : `<td>${esc(cell)}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;

const figureRow = (row) => [row.name, row.runs, said(row.medianMinutes), said(row.medianCalls),
  { value: row.thin ?? "", html: row.thin ? `<span class="thin">${esc(row.thin)}</span>` : "" }];

const FIGURE_COLUMNS = ["", "runs", "median min", "median calls", "floor"];

const side = (label, figure) => `${esc(label)} ${said(figure.medianMinutes, " min")} and ${said(figure.medianCalls)} calls over `
  + `${esc(figure.runs)} run(s)`;

const runsHtml = (runs, days) => {
  const { day, before, week } = runs.headline;
  return `<section id="runs"><h2>Runs</h2>`
    + `<p class="headline"><strong>${esc(day.runs)} issue-flow run(s)</strong>, median ${esc(said(day.medianMinutes, " min"))} `
    + `and ${esc(said(day.medianCalls))} calls a run.</p>`
    + trendSvg("runs a day", days, runs.trend.map((one) => one.runs))
    + trendSvg("median minutes a run", days, runs.trend.map((one) => one.medianMinutes))
    + `<p>${side("The day before:", before)}. The seven days before: a median of ${esc(said(week.runs))} run(s) a day, `
    + `${esc(said(week.medianMinutes, " min"))} and ${esc(said(week.medianCalls))} calls, over the ${esc(week.days)} day(s) that held a run.</p>`
    + `<h3>By project</h3>${table(FIGURE_COLUMNS.map((one, index) => (index ? one : "project")), runs.projects.map(figureRow))}`
    + `<h3>By phase</h3>${table(FIGURE_COLUMNS.map((one, index) => (index ? one : "phase")), runs.phases.map(figureRow))}`
    + `<h3>By rung</h3>${table(FIGURE_COLUMNS.map((one, index) => (index ? one : "rung")), runs.rungs.map(figureRow))}`
    + `<h3>By model</h3>${table(FIGURE_COLUMNS.map((one, index) => (index ? one : "model")), runs.models.map(figureRow))}`
    + `<h3>By effort</h3><p>${missing(runs.effort)}</p></section>`;
};

const landingsHtml = (landings, days) => {
  const held = landings.headline;
  const head = held
    ? `<p class="headline"><strong>${esc(held.passes)} landing pass(es)</strong>, ${esc(held.outsideRuns)} of them in a session `
      + `no issue-flow run holds, ${esc(held.resumed)} resumed with --from, `
      + `a push rejected in ${esc(held.rejectedRuns)} run(s), ${esc(held.gateMinutes)} gate minute(s) spent over ${esc(held.gateCalls)} gate call(s).</p>`
    : `<p class="headline"><strong>No landing pass</strong> was typed and no run ended on this day, so no landing figure is read.</p>`;
  return `<section id="landings"><h2>Landings</h2>${head}`
    + (landings.redBatches ? `<p>Red batches: ${esc(redBatchSaid(landings.redBatches))}.</p>` : "")
    + trendSvg("landing passes a day", days, landings.trend.map((one) => one.passes))
    + `<ul>${landings.missing.map((one) => `<li>${missing(one)}</li>`).join("")}</ul></section>`;
};

const pct = (value) => (value === null ? "none ruled" : `${value}%`);

const consultsHtml = (consults, days) => {
  const held = consults.headline;
  return `<section id="consults"><h2>Consults</h2>`
    + `<p class="headline"><strong>${esc(held.answered)} answered consult(s)</strong>, ${esc(held.atBudget)} of the `
    + `${esc(held.budgeted)} that recorded a budget ending at it, ${esc(held.incomplete)} saying it could not check.</p>`
    + trendSvg("answered consults a day", days, consults.trend.map((one) => one.answered))
    + table(["model", "prompt", "consults", "findings", "ruled", "kept", "ruled on how", "right about how", "floor"],
      consults.groups.map((one) => [one.model, one.prompt, one.consults, one.findings, one.ruled,
        { value: one.kept ?? -1, html: esc(pct(one.kept)) }, one.how, { value: one.rightAboutHow ?? -1, html: esc(pct(one.rightAboutHow)) },
        { value: one.thin ?? "", html: one.thin ? `<span class="thin">${esc(one.thin)}</span>` : "" }]))
    + `<p>A share is over the findings ruled in its own row, one model and one prompt version, and never pooled across two.</p>`
    + `<ul>${consults.missing.map((one) => `<li>${missing(one)}</li>`).join("")}</ul></section>`;
};

const counted = (label, rows, first) => (rows.length
  ? `<h3>${esc(label)}</h3>${table([first, "calls", "runs"], rows.map((one) => [one.key, one.calls, one.runs]))}`
  : `<h3>${esc(label)}</h3><p>None on this day.</p>`);

const frictionHtml = (friction, days) => `<section id="friction"><h2>Friction</h2>`
  + `<p class="headline"><strong>${esc(friction.headline.refusals)} refused call(s)</strong> across `
  + `${esc(friction.headline.runs)} run(s).</p>`
  + trendSvg("refused calls a day", days, friction.trend.map((one) => one.refusals))
  + counted("Refusals, by the line naming the rule", friction.refusals, "refusal")
  + counted("Errors no rule refused, by the class, the exit and the first line printed", friction.errors, "failed")
  + counted("Exits that were the command's answer, apart from the errors", friction.answers, "answer")
  + counted("Commands typed three or more times inside one run", friction.repeats, "command")
  + (friction.waits.length
    ? `<h3>Single waits of ten minutes or more</h3>${table(["command", "waits", "minutes", "runs"],
      friction.waits.map((one) => [one.what, one.waits, one.minutes, one.runs]))}`
    : "<h3>Single waits of ten minutes or more</h3><p>None on this day.</p>")
  + (friction.standDowns.length
    ? `<h3>Hook stand-downs</h3>${table(["hook", "stood down", "sessions"], friction.standDowns.map((one) => [one.hook, one.count, one.sessions]))}`
    : "<h3>Hook stand-downs</h3><p>None on this day.</p>")
  + "</section>";

const issueLine = (one) => (one.unread
  ? `<li>${esc(one.key)} — could not be read: ${esc(one.unread)}</li>`
  : `<li>${esc(one.key)} — ${esc(one.title ?? "untitled")}${one.note ? `<br><span class="note">${esc(one.note)}</span>` : ""}</li>`);

const sidesLine = (one) => (one.early
  ? `<p>Too early to read: the day holds ${esc(one.before.runs)} run(s) ending before it and ${esc(one.after.runs)} beginning after it, and each side needs ten.</p>`
  : `<p>${side("Before it:", one.before)}; ${side("after it:", one.after)}. The reading of what its own change moved is <code>forge stats change ${esc(one.issues[0]?.key ?? "<ISS-nn>")}</code>.</p>`);

const releasesHtml = (releases, days) => `<section id="releases"><h2>Harness implementation</h2>`
  + `<p class="headline"><strong>${esc(releases.landed.length)} release(s)</strong> written and `
  + `${esc(releases.installed.length)} cop(ies) installed on this day.</p>`
  + trendSvg("releases a day", days, releases.trend)
  + releases.landed.map((one) => `<article class="release"><h3>${esc(one.version)} at ${esc(at(one.at))}Z, commit ${esc(String(one.head ?? "").slice(0, 10))}</h3>`
    + `<ul>${one.issues.map(issueLine).join("") || "<li>no issue on its reading</li>"}</ul>${sidesLine(one)}</article>`).join("")
  + (releases.installed.length
    ? `<h3>Installed</h3>${table(["copy", "installed at"], releases.installed.map((one) => [one.copy, `${at(one.at)}Z`]))}`
    : "")
  + "</section>";

const matchCell = (one) => {
  if (one.match) return { value: one.match.key, html: `${esc(one.match.key)} — ${esc(one.match.title)}` };
  if (one.unmatched) return { value: "~", html: `not matched: ${esc(one.unmatched)}` };
  return { value: "~~", html: "matches no open issue: no filing yet" };
};

const opportunitiesHtml = (opportunities) => `<section id="opportunities"><h2>Opportunities</h2>`
  + (opportunities.listed.length
    ? `<p class="headline"><strong>${esc(opportunities.listed[0].calls)} call(s)</strong> paid by the largest, `
      + `${esc(opportunities.listed[0].runs)} run(s) behind it.</p>`
      + table(["rank", "kind", "what the runs met", "runs", "calls", "minutes", "open issue"],
        opportunities.listed.map((one, index) => [index + 1, one.kind, one.met, one.runs, one.calls, said(one.minutes), matchCell(one)]))
      + `<p>${esc(opportunities.unlisted)} more entr${opportunities.unlisted === 1 ? "y" : "ies"} ranked below these and unlisted.</p>`
    : `<p class="headline"><strong>No opportunity</strong>: no refusal, error, repeat, re-read or long wait was recorded on this day.</p>`)
  + `<p>This list ranks and counts, and proposes no change. What to change is the evaluator's reading: <code>${esc(opportunities.evaluator)}</code>, or the harness-eval skill.</p></section>`;

export const STYLE = `body{font:15px/1.5 system-ui,sans-serif;max-width:72rem;margin:2rem auto;padding:0 1rem;color:#1d1d1f;background:#fff}
h1{font-size:1.5rem}h2{margin-top:2.5rem;border-bottom:1px solid #ddd}h3{font-size:1rem;margin-top:1.5rem}
.summary{background:#f5f5f7;padding:1rem 1.25rem;border-radius:6px}.headline{font-size:1.05rem}
table{border-collapse:collapse;margin:.5rem 0;font-size:.9rem}th,td{padding:.25rem .6rem;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
th{cursor:pointer;background:#fafafa}th:hover{text-decoration:underline}td{max-width:40rem;overflow-wrap:anywhere}
.trend{display:inline-block;margin:.25rem 1.5rem .25rem 0}.trend svg{stroke:#555;fill:#555;stroke-width:1.5}.trend figcaption{font-size:.8rem;color:#555}
.thin{color:#8a5a00;font-weight:600}.missing{color:#8a1c1c}.note{color:#444}code{background:#f0f0f0;padding:0 .25rem}`;

/* Numbers compare as numbers and the rest as text; a second click on one header reverses it. */
export const SORT_SCRIPT = `function forgeSort(th){var table=th.closest("table"),body=table.tBodies[0],col=th.cellIndex,dir=th.dataset.dir==="asc"?"desc":"asc";
th.dataset.dir=dir;var key=function(row){var cell=row.cells[col];return cell.dataset.value!==undefined?cell.dataset.value:cell.textContent};
var rows=Array.prototype.slice.call(body.rows);rows.sort(function(a,b){var x=key(a),y=key(b),nx=parseFloat(x),ny=parseFloat(y);
var c=!isNaN(nx)&&!isNaN(ny)?nx-ny:String(x).localeCompare(String(y));return dir==="asc"?c:-c});rows.forEach(function(row){body.appendChild(row)})}
document.querySelectorAll("table.sortable th").forEach(function(th){th.addEventListener("click",function(){forgeSort(th)})});`;


/** The whole page for a day's content. */
export const pageOf = (content) => {
  const days = content.trendDays;
  const unread = content.unread.length
    ? `<p>Registered and not read, no transcript store naming a checkout of it: ${content.unread.map((one) => esc(one.name)).join(", ")}.</p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Harness daily report ${esc(content.day)}</title>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLE}</style></head><body>`
    + `<h1>Harness daily report — ${esc(content.day)}</h1>`
    + `<p>The day in ${esc(content.zone)}, over ${esc(content.projects.length)} project(s): `
    + `${content.projects.map((one) => esc(one.name)).join(", ") || "none"}. Written ${esc(at(Date.parse(content.written)))}Z.</p>${unread}`
    + `<section class="summary"><h2>Summary</h2>${summaryOf(content).map((one) => `<p>${esc(one)}</p>`).join("")}</section>`
    + runsHtml(content.runs, days) + landingsHtml(content.landings, days) + consultsHtml(content.consults, days)
    + frictionHtml(content.friction, days) + releasesHtml(content.releases, days)
    + opportunitiesHtml(content.opportunities)
    + `<script>${SORT_SCRIPT}</script>${contentBlock(content)}</body></html>\n`;
};
