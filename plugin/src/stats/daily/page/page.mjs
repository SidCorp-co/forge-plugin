/* The day's content as a page a person reads at a glance: the goal scorecard first, the models'
   decisions below it, then drill-downs closed until opened, and what the page could not read in
   its footer. Everything is inline — style, script, charts — so the file opens with no network and
   travels as one file. Colour only ever repeats what the words beside it say: docs/cli/stats.md. */
import { contentBlock } from "../store.mjs";
import { decisionDetail, droppedLine, emptySaid, stageLines } from "./summary.mjs";
import { changeSaid, moveSaid, tileFedBy, withUnit } from "../scorecard.mjs";
import { SECTIONS } from "../reading/figures.mjs";
import { redBatchSaid } from "../../marks/red-batches.mjs";
import { RUNG_UNKNOWN } from "../../corpus/transcripts.mjs";

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


/* Where a chart is drawn inside its viewBox: the scale's labels to the left, the days along the foot. */
const CHART = { wide: 1100, high: 170, left: 56, right: 28, top: 22, foot: 26 };

const tick = (value) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10));

/** A value a day drawn across the text column with its scale labelled up the side, the days named
 *  along the foot and the axis named at its head; a day holding none is a gap. Each point's value is
 *  its hover and nowhere in the text, so the chart is not a second copy of a line beside it. */
const chartSvg = (label, axis, days, values) => {
  const { wide, high, left, right, top, foot } = CHART;
  const known = values.filter((one) => one !== null && one !== undefined);
  const most = Math.max(1, ...known);
  const across = (index) => Math.round(left + ((wide - left - right) * index) / Math.max(1, values.length - 1));
  const down = (value) => Math.round(top + (high - top - foot) * (1 - value / most));
  const scale = [0, most / 2, most].map((one) => `<line class="grid" x1="${left}" x2="${wide - right}" y1="${down(one)}" y2="${down(one)}" />`
    + `<text class="scale" x="${left - 6}" y="${down(one) + 4}" text-anchor="end">${esc(tick(one))}</text>`).join("");
  const dayLabels = days.map((day, index) => `<text class="scale" x="${across(index)}" y="${high - 6}" text-anchor="middle">${esc(day.slice(5))}</text>`).join("");
  const segments = [];
  let current = [];
  values.forEach((value, index) => {
    if (value === null || value === undefined) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push(`${across(index)},${down(value)}`);
  });
  if (current.length) segments.push(current);
  const lines = segments.filter((one) => one.length > 1).map((one) => `<polyline class="line" points="${one.join(" ")}" />`).join("");
  const points = values.map((value, index) => (value === null || value === undefined ? ""
    : `<circle cx="${across(index)}" cy="${down(value)}" r="3"><title>${esc(days[index])}: ${esc(value)}</title></circle>`)).join("");
  return `<figure class="chart"><figcaption>${esc(label)}</figcaption><svg viewBox="0 0 ${wide} ${high}" role="img" aria-label="${esc(label)}">`
    + `<text class="axis" x="${left}" y="13">${esc(axis)}</text>${scale}${dayLabels}${lines}${points}</svg></figure>`;
};

const ARROW = { up: "▲", down: "▼", level: "=" };

const arrowOf = (change) => {
  if (change > 0) return ARROW.up;
  return change < 0 ? ARROW.down : ARROW.level;
};

/** One tile: a metric no reader computes is greyed and names the issue owing its reader. */
const tileHtml = (tile) => {
  const goal = `<span class="goal">${esc(tile.goal)}, ${esc(tile.better)} is better</span>`;
  if (tile.missing) {
    return `<div class="tile greyed" id="tile-${esc(tile.metric)}"><div class="label">${esc(tile.label)}</div>`
      + `<div class="value">not computed yet</div><div class="move">${esc(tile.missing.issue)} owes its reader</div>${goal}</div>`;
  }
  const judged = tile.verdict ? ` ${tile.verdict}` : "";
  const arrow = tile.change === null ? "" : `<span class="arrow" aria-hidden="true">${arrowOf(tile.change)}</span> `;
  return `<div class="tile${judged}" id="tile-${esc(tile.metric)}"><div class="label">${esc(tile.label)}</div>`
    + `<div class="value">${esc(withUnit(tile.value, tile.unit))}</div>`
    + (tile.detail ? `<div class="note">${esc(tile.detail)}</div>` : "")
    + `<div class="baseline">seven days before: ${esc(withUnit(tile.baseline, tile.unit))}</div>`
    + `<div class="move">${arrow}${esc(moveSaid(tile))}</div>${goal}</div>`;
};

const scorecardHtml = (scorecard) => (scorecard?.length
  ? `<section id="scorecard"><h2>Scorecard</h2><div class="tiles">${scorecard.map(tileHtml).join("")}</div>`
    + `<p class="note">Each tile is the day against the median of its daily values over the seven days before.</p></section>`
  : "");

/* The models' reading as the page shows it: the Decisions block, one self-contained section; each
   section's line at its drill-down's head; what each role spent, in the footer:
   docs/cli/stats-the-reading.md. A cited figure shows by its label and value, and its key, which is
   the content's address and no reader's word, is the hover. */
const figureSaid = (figure) => `<span class="figure" title="${esc(figure.key)}">${esc(figure.said)}: ${esc(figure.value)}</span>`;

const targetLink = (target) => {
  if (target?.tile) return ` Tile: <a href="#tile-${esc(target.tile.id)}">${esc(target.tile.label)}</a>.`;
  return target?.section ? ` Section: <a href="#${esc(target.section.drill)}">${esc(target.section.title)}</a>.` : "";
};

const detailHtml = (one) => decisionDetail(one).map((said) => ` ${esc(said)}`).join("");

const decisionHtml = (one, tileFor) => `<li><strong>${esc(one.action)}</strong> — ${esc(one.what)}${detailHtml(one)}`
  + `<br><span class="note">${figureSaid(one.figure)}.${targetLink(tileFor(one.figure.key))}`
  + `${one.command ? ` Carried out by <code>${esc(one.command)}</code>.` : ""}</span></li>`;

const judgedBody = (judgement, tileFor) => {
  if (judgement.decisions.length) return `<ol class="decisions">${judgement.decisions.map((one) => decisionHtml(one, tileFor)).join("")}</ol>`;
  return `<p><strong>${esc(emptySaid(judgement))}</strong></p>`;
};

/** The Decisions block, or the one line saying why the page carries none; nothing for a page written
 *  before the reading existed. `tileFor` names the tile a cited figure feeds, else its section. */
export const decisionsHtml = (judgement, tileFor = () => null) => {
  if (!judgement) return "";
  const notes = [...stageLines(judgement), droppedLine(judgement)].filter(Boolean);
  if (judgement.why) {
    return `<section id="decisions"><p class="missing">No decisions: ${esc(judgement.why)}.</p>`
      + `${notes.map((one) => `<p class="note">${esc(one)}</p>`).join("")}</section>`;
  }
  if (!judgement.judged) {
    return `<section id="decisions"><h2>Decisions</h2><p class="missing">No decisions: no judge ran.</p>`
      + `${notes.map((one) => `<p class="note">${esc(one)}</p>`).join("")}</section>`;
  }
  return `<section id="decisions"><h2>Decisions</h2>${judgedBody(judgement, tileFor)}`
    + `${notes.map((one) => `<p class="note">${esc(one)}</p>`).join("")}`
    + `<p class="note">Judged by models over this page's own figures, at ${esc(judgement.at)}; every figure cited was checked against them.</p></section>`;
};

const findingHtml = (one) => `<li>${esc(one.reading)} <span class="note">(${figureSaid(one.figure)})</span></li>`;

/** What a section opens with: the judge's line where it gave one, else the findings the stages kept. */
export const sectionHead = (judgement, id) => {
  const read = judgement?.sections?.[id];
  if (!read) return "";
  if (read.verdict) {
    return `<p class="verdict"><strong>${esc(read.verdict)}</strong> — ${esc(read.why)}`
      + `${read.baseline ? ` <span class="note">(against ${figureSaid(read.baseline)})</span>` : ""}</p>`;
  }
  const dropped = read.verdictDropped
    ? `<p class="note">No verdict: the judge's ${esc(read.verdictDropped)} was dropped, citing no baseline figure of this section.</p>` : "";
  if (read.input === "figures" || !read.findings.length) return dropped;
  const said = read.input === "findings" ? "Reviewed findings" : "Unreviewed findings";
  const ruled = read.verdictDropped ? `${said}:` : `${said}, no judge having ruled on this section:`;
  return `${dropped}<p class="note">${ruled}</p><ul>${read.findings.map(findingHtml).join("")}</ul>`;
};

/* The drill-down each section of the reading is shown in, where it is not the section's own. */
const DRILL_OF = { opportunities: "friction" };

/* Where a decision points: the computed tile its figure feeds, else the drill-down holding the section
   the figure came from, off the reading's own table; a figure feeding a tile no reader computes yet
   points at its section, since the tile holds nothing it says. */
const tileFinder = (content) => {
  const sectionOf = new Map();
  for (const section of SECTIONS) {
    const where = { drill: DRILL_OF[section.id] ?? section.id, title: section.title };
    for (const figure of section.figures(content)) sectionOf.set(figure.key, where);
  }
  return (key) => {
    const tile = tileFedBy(key, content);
    if (tile) return { tile };
    return sectionOf.has(key) ? { section: sectionOf.get(key) } : null;
  };
};

/** Each section's kept verdict for a drill-down's summary row, coloured as the tiles are; named by
 *  its section where the drill-down holds more than one. */
export const verdictMarks = (judgement, ids) => ids.map((id) => judgement?.sections?.[id]).filter((read) => read?.verdict)
  .map((read) => `<span class="mark ${esc(read.verdict)}">${ids.length > 1 ? `${esc(read.title)}: ` : ""}${esc(read.verdict)}</span>`).join("");

/** A drill-down: closed when the page opens, its summary the title, the verdicts and one line. */
const drill = (id, title, line, body, marks = "") => `<details id="${esc(id)}"><summary><h2>${esc(title)}</h2>`
  + `${marks}<span class="note">${line}</span></summary>${body}</details>`;

const figureRow = (row) => [row.name, row.runs, said(row.medianMinutes), said(row.medianCalls)];

const FIGURE_COLUMNS = ["runs", "median min", "median calls"];

const ranRows = (label, rows) => {
  const ran = rows.filter((one) => one.runs > 0 && one.name !== RUNG_UNKNOWN);
  return ran.length ? `<h3>By ${esc(label)}</h3>${table([label, ...FIGURE_COLUMNS], ran.map(figureRow))}` : "";
};

const side = (label, figure) => `${esc(label)} ${said(figure.medianMinutes, " min")} and ${said(figure.medianCalls)} calls over `
  + `${esc(figure.runs)} run(s)`;

const pointSaid = (change) => (change === null ? "" : `, ${changeSaid(change, "%")}`);

const phasesHtml = (runs) => {
  const shown = runs.phaseShares.filter((one) => one.minutes > 0 || one.baseline);
  const bars = shown.map((one) => `<li><span class="bar-name">${esc(one.name)}</span>`
    + `<span class="bar"><span style="width:${Math.max(0, Math.min(100, one.share ?? 0))}%"></span></span>`
    + `<span class="bar-said">${esc(said(one.share, "%"))} of run minutes, against ${esc(said(one.baseline, "%"))}${esc(pointSaid(one.change))}</span></li>`).join("");
  return drill("phases", "Phases", "each phase's share of the day's run minutes, against the seven days before",
    bars ? `<ol class="bars">${bars}</ol>` : "<p>No run ended on this day.</p>");
};

const runsHtml = (runs, days, { head, marks }) => {
  const { day, before, week } = runs.headline;
  return drill("runs", "Runs", `${esc(day.runs)} issue-flow run(s), median ${esc(said(day.medianMinutes, " min"))}`, head
    + `<p>${side("The day:", day)}. ${side("The day before:", before)}. The seven days before: a median of ${esc(said(week.runs))} run(s) a day, `
    + `${esc(said(week.medianMinutes, " min"))} and ${esc(said(week.medianCalls))} calls, over the ${esc(week.days)} day(s) that held a run.</p>`
    + chartSvg("Issue-flow runs a day", "runs", days, runs.trend.map((one) => one.runs))
    + chartSvg("Median minutes a run", "minutes", days, runs.trend.map((one) => one.medianMinutes))
    + ranRows("project", runs.projects) + ranRows("model", runs.models) + ranRows("rung", runs.rungs), marks);
};

const landingsHtml = (landings, days, { head, marks }) => {
  const held = landings.headline;
  const line = held ? `${esc(held.passes)} landing pass(es)` : "no landing pass";
  const top = held
    ? `<p>${esc(held.passes)} landing pass(es), ${esc(held.outsideRuns)} of them in a session no issue-flow run holds, `
      + `${esc(held.resumed)} resumed with --from, a push rejected in ${esc(held.rejectedRuns)} run(s), `
      + `${esc(held.gateMinutes)} gate minute(s) spent over ${esc(held.gateCalls)} gate call(s).</p>`
    : "<p>No landing pass was typed and no run ended on this day, so no landing figure is read.</p>";
  return drill("landings", "Landings", line, head + top
    + (landings.redBatches ? `<p>Red batches: ${esc(redBatchSaid(landings.redBatches))}.</p>` : "")
    + chartSvg("Landing passes a day", "passes", days, landings.trend.map((one) => one.passes)), marks);
};

const pct = (value) => (value === null ? "none ruled" : `${value}%`);

const consultsHtml = (consults, days, { head, marks }) => {
  const held = consults.headline;
  return drill("consults", "Consults", `${esc(held.answered)} answered consult(s)`, head
    + `<p>${esc(held.answered)} answered consult(s), ${esc(held.atBudget)} of the ${esc(held.budgeted)} that recorded a budget `
    + `ending at it, ${esc(held.incomplete)} saying it could not check.</p>`
    + chartSvg("Answered consults a day", "consults", days, consults.trend.map((one) => one.answered))
    + table(["model", "prompt", "consults", "findings", "ruled", "kept", "ruled on how", "right about how"],
      consults.groups.map((one) => [one.model, one.prompt, one.consults, one.findings, one.ruled,
        { value: one.kept ?? -1, html: esc(pct(one.kept)) }, one.how, { value: one.rightAboutHow ?? -1, html: esc(pct(one.rightAboutHow)) }]))
    + "<p>A share is over the findings ruled in its own row, one model and one prompt version, and never pooled across two.</p>", marks);
};

/** How many friction items the drill-down lists: the rest stay in `--json`. */
export const FRICTION_SHOWN = 5;

const matchCell = (one) => {
  if (one.match) return { value: one.match.key, html: `${esc(one.match.key)} — ${esc(one.match.title)}` };
  if (one.unmatched) return { value: "~", html: `not matched: ${esc(one.unmatched)}` };
  return { value: "~~", html: "matches no open issue: no filing yet" };
};

const frictionHtml = (friction, opportunities, days, { head: heads, marks }) => {
  const top = opportunities.listed.slice(0, FRICTION_SHOWN);
  const inJson = opportunities.listed.length - top.length;
  const rest = [inJson && `${inJson} more listed in <code>--json</code>`,
    opportunities.unlisted && `${opportunities.unlisted} more ranked below those and counted, never listed`].filter(Boolean);
  return drill("friction", "Friction", `${esc(friction.headline.refusals)} refused call(s) across ${esc(friction.headline.runs)} run(s)`,
    heads + chartSvg("Refused calls a day", "refusals", days, friction.trend.map((one) => one.refusals))
    + (top.length
      ? `<h3>The top ${esc(top.length)}, by calls lost</h3>${table(["rank", "kind", "what the runs met", "runs", "calls lost", "open issue"],
        top.map((one, index) => [index + 1, one.kind, one.met, one.runs, one.calls, matchCell(one)]))}`
        + (rest.length ? `<p>${rest.join("; ")}.</p>` : "")
      : "<p>No refusal, error, repeat, re-read or long wait was recorded on this day.</p>")
    + `<p>This list ranks and counts, and proposes no change. What to change is the evaluator's reading: <code>${esc(opportunities.evaluator)}</code>, or the harness-eval skill.</p>`, marks);
};

const issueSaid = (one) => (one.unread ? `${esc(one.key)} (could not be read: ${esc(one.unread)})` : `${esc(one.key)} ${esc(one.title ?? "untitled")}`);

const releasesHtml = (releases, { head, marks }) => drill("releases", "Harness implementation",
  `${esc(releases.landed.length)} release(s) written and ${esc(releases.installed.length)} cop(ies) installed`, head
  + (releases.landed.length
    ? `<ul class="releases">${releases.landed.map((one) => `<li>${esc(one.version)} at ${esc(at(one.at))}Z: `
      + `${one.issues.map(issueSaid).join("; ") || "no issue on its reading"}</li>`).join("")}</ul>`
    : "<p>No release was written on this day.</p>")
  + (releases.installed.length
    ? `<p>Installed: ${releases.installed.map((one) => `${esc(one.copy)} at ${esc(at(one.at))}Z`).join(", ")}.</p>`
    : ""), marks);

/** Every reading no reader computes yet, once each, whether a tile or a section wanted it. */
const unbuilt = (content) => {
  const held = new Map();
  for (const one of [...(content.scorecard ?? []).map((tile) => tile.missing), content.runs.effort,
    ...content.landings.missing, ...content.consults.missing]) {
    if (one) held.set(`${one.issue}\0${one.reading}`, one);
  }
  return [...held.values()];
};

/** Per role: the model, its calls and the tokens they spent. */
const costLines = (judgement) => Object.entries(judgement?.cost ?? {}).map(([role, one]) =>
  `${role}: ${one.model}, ${one.calls} call(s)${one.failed ? ` of which ${one.failed} failed` : ""}, `
  + `${one.input} input and ${one.output} output token(s)`);

/** What the page could not read: runs on no known rung, projects with no runs, readers not built. */
const gapsFooter = (content) => {
  const unknown = content.runs.rungs.find((one) => one.name === RUNG_UNKNOWN)?.runs ?? 0;
  const idle = content.runs.projects.filter((one) => one.runs === 0).map((one) => one.name);
  const lines = [
    unknown ? `${unknown} of the day's ${content.runs.headline.day.runs} run(s) claimed no rung this reading could establish.` : null,
    idle.length ? `No run on this day in: ${idle.join(", ")}.` : null,
    content.unread.length ? `Registered and not read, no transcript store naming a checkout of it: ${content.unread.map((one) => one.name).join(", ")}.` : null,
    ...unbuilt(content).map((one) => `Not computed yet: ${one.reading}, owed by ${one.issue}.`),
  ].filter(Boolean);
  const cost = costLines(content.judgement);
  return `<footer><h2>Data gaps</h2>${lines.length ? `<ul>${lines.map((one) => `<li>${esc(one)}</li>`).join("")}</ul>` : "<p>None.</p>"}`
    + (cost.length ? `<p class="note">What reading this page cost: ${cost.map(esc).join("; ")}.</p>` : "") + "</footer>";
};

export const STYLE = `body{font:15px/1.5 system-ui,sans-serif;max-width:72rem;margin:2rem auto;padding:0 1rem;color:#1d1d1f;background:#fff}
h1{font-size:1.5rem}h2{margin-top:2.5rem;border-bottom:1px solid #ddd}h3{font-size:1rem;margin-top:1.5rem}
.summary{background:#f5f5f7;padding:1rem 1.25rem;border-radius:6px}.headline{font-size:1.05rem}
table{border-collapse:collapse;margin:.5rem 0;font-size:.9rem}th,td{padding:.25rem .6rem;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
th{cursor:pointer;background:#fafafa}th:hover{text-decoration:underline}td{max-width:40rem;overflow-wrap:anywhere}
.trend{display:inline-block;margin:.25rem 1.5rem .25rem 0}.trend svg{stroke:#555;fill:#555;stroke-width:1.5}.trend figcaption{font-size:.8rem;color:#555}
.thin{color:#8a5a00;font-weight:600}.verdict{font-size:1.05rem}.missing{color:#8a1c1c}.note{color:#444}code{background:#f0f0f0;padding:0 .25rem}`;

/* Numbers compare as numbers and the rest as text; a second click on one header reverses it. */
export const SORT_SCRIPT = `function forgeSort(th){var table=th.closest("table"),body=table.tBodies[0],col=th.cellIndex,dir=th.dataset.dir==="asc"?"desc":"asc";
th.dataset.dir=dir;var key=function(row){var cell=row.cells[col];return cell.dataset.value!==undefined?cell.dataset.value:cell.textContent};
var rows=Array.prototype.slice.call(body.rows);rows.sort(function(a,b){var x=key(a),y=key(b),nx=parseFloat(x),ny=parseFloat(y);
var c=!isNaN(nx)&&!isNaN(ny)?nx-ny:String(x).localeCompare(String(y));return dir==="asc"?c:-c});rows.forEach(function(row){body.appendChild(row)})}
document.querySelectorAll("table.sortable th").forEach(function(th){th.addEventListener("click",function(){forgeSort(th)})});`;


/* The daily page's own rules beside the ones the current report shares: the tiles, the drill-downs,
   the bars and the charts. A tile's colour repeats the word it stands beside, and a greyed one is a
   metric no reader computes yet. */
const DAILY_STYLE = `.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr));gap:.75rem}
.tile{border:1px solid #ddd;border-left:6px solid #999;border-radius:6px;padding:.6rem .8rem}.tile .label{font-weight:600}
.tile .value{font-size:1.6rem;font-weight:600}.tile .goal,.tile .baseline{font-size:.8rem;color:#555;display:block}
.tile.better{border-left-color:#1a7f37}.tile.better .move{color:#1a7f37}.tile.worse{border-left-color:#b42318}.tile.worse .move{color:#b42318}
.tile.greyed{background:#f3f3f3;color:#777;border-left-color:#ccc}.tile.greyed .value{font-size:1.1rem}
.mark{font-weight:600;border-left:6px solid #999;padding:0 .4rem;margin-right:.6rem}.mark.better{border-left-color:#1a7f37;color:#1a7f37}.mark.worse{border-left-color:#b42318;color:#b42318}
details{margin-top:1.25rem;border-top:1px solid #ddd}summary{cursor:pointer;padding:.4rem 0}summary h2{display:inline;border:0;font-size:1.15rem;margin:0 .6rem 0 0}
.chart{margin:.75rem 0;width:100%}.chart svg{width:100%;height:auto;display:block}.chart figcaption{font-size:.85rem;color:#444}
.chart .line{fill:none;stroke:#555;stroke-width:1.5}.chart circle{fill:#555}.chart .grid{stroke:#e5e5e5}.chart .scale,.chart .axis{font-size:13px;fill:#555}
.bars{list-style:none;padding:0}.bars li{display:grid;grid-template-columns:10rem 1fr 22rem;gap:.6rem;align-items:center;margin:.2rem 0}
.bar{background:#f0f0f0;height:.8rem;display:block}.bar span{background:#555;height:100%;display:block}.bar-said{font-size:.85rem}
footer{margin-top:2.5rem;font-size:.9rem;color:#444}`;

/** The whole page for a day's content: the scorecard, the decisions, the drill-downs, the gaps. */
export const pageOf = (content) => {
  const days = content.trendDays;
  const head = (...ids) => ({ head: ids.map((id) => sectionHead(content.judgement, id)).join(""), marks: verdictMarks(content.judgement, ids) });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Harness daily report ${esc(content.day)}</title>`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${STYLE}\n${DAILY_STYLE}</style></head><body>`
    + `<h1>Harness daily report — ${esc(content.day)}</h1>`
    + `<p>The day in ${esc(content.zone)}, over ${esc(content.projects.length)} project(s): `
    + `${content.projects.map((one) => esc(one.name)).join(", ") || "none"}. Written ${esc(at(Date.parse(content.written)))}Z.</p>`
    + scorecardHtml(content.scorecard)
    + decisionsHtml(content.judgement, tileFinder(content))
    + phasesHtml(content.runs) + runsHtml(content.runs, days, head("runs")) + landingsHtml(content.landings, days, head("landings"))
    + consultsHtml(content.consults, days, head("consults"))
    + frictionHtml(content.friction, content.opportunities, days, head("friction", "opportunities"))
    + releasesHtml(content.releases, head("releases"))
    + gapsFooter(content)
    + `<script>${SORT_SCRIPT}</script>${contentBlock(content)}</body></html>\n`;
};
