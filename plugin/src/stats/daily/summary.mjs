/* The few sentences a person reads first, and the one line the index keeps per day: each states a
   figure the content already holds and judges none of them. Where a judge read the page, its
   decisions are what the terminal prints instead, labelled as the models' — docs/cli/stats.md. */
const min = (value) => (value === null || value === undefined ? "no" : `${value}`);

const movedSaid = (what, one, way) =>
  `the ${what} that ${way} most was ${one.row}, ${one.before} → ${one.now} min over ${one.runsBefore} → ${one.runsNow} run(s)`;

const bothOf = (what, pair) => [pair.rose && movedSaid(what, pair.rose, "rose"), pair.fell && movedSaid(what, pair.fell, "fell")]
  .filter(Boolean);

/** The phase that rose most and the one that fell most, as `stats eval` selects them, in words. */
const movedLine = (moved) => {
  const said = bothOf("phase", moved.phases);
  return said.length
    ? `against the seven days before, ${said.join(", and ")}`
    : "no phase had runs both on the day and in the seven days before it, so none moved against them";
};

const rungLine = (moved) => {
  const said = bothOf("rung", moved.rungs);
  return said.length ? ` By rung, ${said.join("; ")}.` : "";
};

/** The release a move followed, or the words for none. */
const followedLine = (followed) => (followed
  ? `${followed.kind === "release" ? "release" : "the copy installed as"} ${followed.version} at ${new Date(followed.at).toISOString().slice(0, 16).replace("T", " ")}Z`
  : "no release written or copy installed on the day or the day before");

const runsSentence = (content) => {
  const { day, before, week } = content.runs.headline;
  if (!day.runs) {
    return `${content.day} held no issue-flow run across ${content.projects.length} project(s); the day before held ${before.runs}, `
      + `and the seven days before a median of ${min(week.runs)} a day.`;
  }
  return `${content.day} held ${day.runs} issue-flow run(s) across ${content.projects.length} project(s), a median of `
    + `${day.medianMinutes} min and ${day.medianCalls} calls a run, against ${before.runs} run(s) at ${min(before.medianMinutes)} min `
    + `the day before and a median of ${min(week.runs)} run(s) a day at ${min(week.medianMinutes)} min over the seven days before.`;
};

/* The article each kind the opportunities list names takes, keyed on that name rather than guessed
   from its spelling: a kind added there without a row here is refused, not given the wrong word. */
const ARTICLE = { refusal: "a", error: "an", repeat: "a", "guide part": "a", wait: "a" };

const articled = (kind) => {
  if (!Object.hasOwn(ARTICLE, kind)) {
    throw new Error(`the daily summary has no article for the opportunity kind "${kind}": add it to ARTICLE in plugin/src/stats/daily/summary.mjs`);
  }
  return `${ARTICLE[kind]} ${kind}`;
};

const opportunitySentence = (opportunities) => {
  const [top] = opportunities.listed;
  if (!top) return "The day holds no opportunity: no refusal, error, repeat, re-read or long wait was recorded.";
  const owner = top.match ? `open as ${top.match.key}` : top.unmatched ? `not matched against the backlog (${top.unmatched})` : "with no filing yet";
  return `The largest opportunity was ${articled(top.kind)} — ${top.met.slice(0, 140)} — which ${top.runs} run(s) paid ${top.calls} call(s) for, ${owner}.`;
};

/** Three to five sentences: the runs, what moved and what it followed, the largest opportunity, and
 *  the consults. */
export const summaryOf = (content) => {
  const moved = movedLine(content.moved);
  const consults = content.consults.headline;
  return [
    runsSentence(content),
    `${moved.charAt(0).toUpperCase()}${moved.slice(1)}, following ${followedLine(content.followed)}.${rungLine(content.moved)}`,
    opportunitySentence(content.opportunities),
    `${consults.answered} consult(s) were answered, ${consults.atBudget} of them ending at their call budget.`,
  ];
};

/** The index's line for a day: the move and the release behind it, the same two the summary names. */
export const indexLineOf = (content) => `${movedLine(content.moved)}; following ${followedLine(content.followed)}`;

/** What the terminal prints of the models' reading: the decisions where a judge ran, else the one line
 *  saying why none did, each followed by what did not run and what was dropped. */
export const decisionsSaid = (judgement) => {
  if (!judgement) return [];
  const notes = [...stageLines(judgement), droppedLine(judgement)].filter(Boolean);
  if (!judgement.judged) return [`No decisions: ${judgement.why ?? "no judge ran"}.`, ...notes];
  const items = judgement.decisions.length
    ? judgement.decisions.map((one, at) => `${at + 1}. ${one.action}: ${one.what} — ${one.figure.said}: ${one.figure.value}`
      + `${one.command ? ` — ${one.command}` : ""}`)
    : [emptySaid(judgement)];
  return ["Decisions:", ...items, ...notes];
};

const STAGE_NAMES = { explore: "explore", review: "review", judge: "judge" };

/** One line per stage that did not run as configured, and per section a stage could not finish. */
export const stageLines = (judgement) => [
  ...Object.entries(judgement.stages ?? {}).filter(([, stage]) => stage.skipped)
    .map(([role, stage]) => `The ${STAGE_NAMES[role] ?? role} stage was skipped: ${stage.skipped}.`),
  ...Object.values(judgement.sections ?? {}).flatMap((read) => read.notes.map((note) => `${read.title}: ${note}.`)),
];

/** How many readings were dropped at which stage and why, in one sentence, or null where none was. */
export const droppedLine = (judgement) => {
  const dropped = judgement.dropped ?? [];
  if (!dropped.length) return null;
  const total = dropped.reduce((sum, one) => sum + one.count, 0);
  return `${total} reading(s) dropped before this page was written: `
    + `${dropped.map((one) => `${one.count} at ${one.stage}, ${one.reason}`).join("; ")}.`;
};

/** What a judged page says in place of its decisions where it holds none: the judge's own word that
 *  there was nothing, or that none of what it proposed survived the checks, which is not the same. */
const NOTHING = "Nothing to decide.";
const NONE_KEPT = "No decision the judge proposed survived the checks.";
export const emptySaid = (judgement) => (judgement.nothing ? NOTHING : NONE_KEPT);
