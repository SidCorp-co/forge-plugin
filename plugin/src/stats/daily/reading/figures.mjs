/* What a model reading the day's page is shown: each section's figures, one `{ key, said, value }`
   apiece, where the key is the figure's path in the gathered content with a row addressed by its name
   (`runs.phases[Ship].medianMinutes`), and the issue keys the page names. A reading cites a key and
   the page renders the label and value itself, so a model can point at a figure and never restate
   one. Text a transcript carries — a refusal's line, a command typed — is no figure and never
   travels; neither does a path: docs/cli/stats-the-reading.md. */
import { shownDeep } from "../store.mjs";

const ROW_FIGURES = [["runs", "runs"], ["medianMinutes", "median minutes a run"], ["medianCalls", "median calls a run"]];

const rowKey = (path, name) => `${path}[${name}]`;

/* One figure, or none where the page holds no value for it: an absent figure is not a nought. A
   baseline is a window the page computed for the day to be read against, which a verdict of better or
   worse cites; a trend's earlier day is one day and not a window, so it is never one. */
const one = (key, said, value, baseline = false) => (value === null || value === undefined || Number.isNaN(value)
  ? [] : [{ key, said, value, ...(baseline ? { baseline: true } : {}) }]);

const WINDOWS = new Set(["before", "week"]);

const figureRow = (path, label, row) => ROW_FIGURES.flatMap(([field, said]) =>
  one(`${rowKey(path, row.name)}.${field}`, `${said}, ${label} ${row.name}, the day`, row[field]));

const headline = (path, side, label, held) => ROW_FIGURES.flatMap(([field, said]) =>
  one(`${path}.${side}.${field}`, `${said}, ${label}`, held?.[field], WINDOWS.has(side)));

const trend = (path, field, said, rows) => (rows ?? []).flatMap((row) =>
  one(`${rowKey(path, row.day)}.${field}`, `${said} on ${row.day}`, row[field]));

const movedOf = (moved, kind) => ["rose", "fell"].flatMap((way) => {
  const held = moved?.[kind]?.[way];
  if (!held) return [];
  const label = `the ${kind.slice(0, -1)} whose median ${way} most, ${held.row}`;
  return [...one(`moved.${kind}.${way}.before`, `median minutes a run, ${label}, the seven days before`, held.before, true),
    ...one(`moved.${kind}.${way}.now`, `median minutes a run, ${label}, the day`, held.now)];
});

const runsFigures = (content) => {
  const { runs, moved } = content;
  return [
    ...headline("runs.headline", "day", "the day", runs.headline.day),
    ...headline("runs.headline", "before", "the day before", runs.headline.before),
    ...headline("runs.headline", "week", "median of the seven days before", runs.headline.week),
    ...trend("runs.trend", "runs", "runs", runs.trend),
    ...trend("runs.trend", "medianMinutes", "median minutes a run", runs.trend),
    ...runs.projects.flatMap((row) => figureRow("runs.projects", "project", row)),
    ...runs.phases.flatMap((row) => figureRow("runs.phases", "phase", row)),
    ...runs.rungs.flatMap((row) => figureRow("runs.rungs", "rung", row)),
    ...runs.models.flatMap((row) => figureRow("runs.models", "model", row)),
    ...movedOf(moved, "phases"),
    ...movedOf(moved, "rungs"),
  ];
};

const LANDING_FIGURES = [["passes", "landing passes"], ["outsideRuns", "landing passes in a session no run holds"],
  ["resumed", "landing passes resumed with --from"], ["rejectedRuns", "runs with a rejected push"],
  ["gateCalls", "gate calls"], ["gateMinutes", "gate minutes"]];

const landingsFigures = ({ landings }) => [
  ...LANDING_FIGURES.flatMap(([field, said]) => one(`landings.headline.${field}`, `${said}, the day`, landings.headline?.[field])),
  ...trend("landings.trend", "passes", "landing passes", landings.trend),
];

const CONSULT_FIGURES = [["answered", "answered consults"], ["atBudget", "consults ending at their call budget"],
  ["budgeted", "consults that recorded a budget"], ["incomplete", "consults saying they could not check"],
  ["retried", "consults retried"]];

const GROUP_FIGURES = [["consults", "consults"], ["findings", "findings"], ["ruled", "findings ruled"],
  ["kept", "per cent of ruled findings kept"], ["rightAboutHow", "per cent right about how"]];

const consultsFigures = ({ consults }) => [
  ...CONSULT_FIGURES.flatMap(([field, said]) => one(`consults.headline.${field}`, `${said}, the day`, consults.headline[field])),
  ...trend("consults.trend", "answered", "answered consults", consults.trend),
  ...consults.groups.flatMap((row) => GROUP_FIGURES.flatMap(([field, said]) =>
    one(`${rowKey("consults.groups", `${row.model} v${row.prompt}`)}.${field}`, `${said}, model ${row.model} on prompt ${row.prompt}, the day`, row[field]))),
];

const frictionFigures = ({ friction }) => [
  ...one("friction.headline.refusals", "refused calls, the day", friction.headline.refusals),
  ...one("friction.headline.runs", "runs, the day", friction.headline.runs),
  ...trend("friction.trend", "refusals", "refused calls", friction.trend),
  ...friction.standDowns.flatMap((row) => [
    ...one(`${rowKey("friction.standDowns", row.hook)}.count`, `stand-downs of hook ${row.hook}, the day`, row.count),
    ...one(`${rowKey("friction.standDowns", row.hook)}.sessions`, `sessions hook ${row.hook} stood down in, the day`, row.sessions)]),
];

const releasesFigures = ({ releases }) => [
  ...one("releases.landed.length", "releases written, the day", releases.landed.length),
  ...one("releases.installed.length", "copies installed, the day", releases.installed.length),
  ...releases.landed.flatMap((row) => (row.early ? [] : ["before", "after"].flatMap((side) =>
    headline(rowKey("releases.landed", row.version), side, `runs ${side} release ${row.version}`, row[side])))),
];

/* A row's name is its rank: what the runs met is transcript text and the key is not allowed to carry it. */
const OPPORTUNITY_FIGURES = [["runs", "runs"], ["calls", "calls paid"], ["minutes", "minutes waited"]];

const opportunityLabel = (row, rank) => `opportunity #${rank}, ${row.kind}${row.gate ? ` from ${row.gate}` : ""}`
  + `${row.match ? `, open as ${row.match.key}` : ", matching no open issue"}`;

const opportunitiesFigures = ({ opportunities }) => [
  ...opportunities.listed.flatMap((row, at) => OPPORTUNITY_FIGURES.flatMap(([field, said]) =>
    one(`${rowKey("opportunities.listed", `#${at + 1}`)}.${field}`, `${said}, ${opportunityLabel(row, at + 1)}`, row[field]))),
  ...one("opportunities.unlisted", "opportunities ranked below the listed ones", opportunities.unlisted),
];

/** The sections a reading is taken over, each a section of the page by its id there. */
export const SECTIONS = [
  { id: "runs", title: "Runs", figures: runsFigures },
  { id: "landings", title: "Landings", figures: landingsFigures },
  { id: "consults", title: "Consults", figures: consultsFigures },
  { id: "friction", title: "Friction", figures: frictionFigures },
  { id: "releases", title: "Harness implementation", figures: releasesFigures },
  { id: "opportunities", title: "Opportunities", figures: opportunitiesFigures },
];

/** The issue keys the page names, each with its title and where on the page it sits. */
const offeredKeys = (content) => {
  const held = new Map();
  const add = (key, title, where) => {
    if (key && !held.has(key)) held.set(key, { key, title: title ?? null, where });
  };
  content.opportunities.listed.forEach((row, at) => add(row.match?.key, row.match?.title, `the open issue matching opportunity #${at + 1}`));
  for (const release of content.releases.landed) {
    for (const issue of release.issues) add(issue.key, issue.title, `landed in release ${release.version}`);
  }
  for (const missing of [content.runs.effort, ...content.landings.missing, ...content.consults.missing]) {
    add(missing?.issue, null, `owes the reader of ${missing?.reading}`);
  }
  return [...held.values()];
};

/** Every section's figures and the offered keys, with every string masked and every absolute path
 *  cut, whatever root it sits under: nothing a stage is sent names a place on this machine. */
export const readingInput = (content) => shownDeep({
  sections: SECTIONS.map((section) => ({ id: section.id, title: section.title, figures: section.figures(content) })),
  issues: offeredKeys(content),
}, []);
