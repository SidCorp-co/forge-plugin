/* The few sentences a person reads first, and the one line the index keeps per day: each states a
   figure the content already holds and judges none of them, "better" and "worse" being the
   evaluator's words and not this page's — docs/cli/stats.md. */
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
