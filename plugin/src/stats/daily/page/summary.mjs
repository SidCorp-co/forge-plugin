/* The one line the index keeps per day, which states a figure the content already holds and judges
   none of them, and the terminal's lines for the models' decisions, labelled as theirs —
   docs/cli/stats.md. */
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

/** The release a move followed, or the words for none. */
const followedLine = (followed) => (followed
  ? `${followed.kind === "release" ? "release" : "the copy installed as"} ${followed.version} at ${new Date(followed.at).toISOString().slice(0, 16).replace("T", " ")}Z`
  : "no release written or copy installed on the day or the day before");

/** The index's line for a day: the phase that moved most and the release it followed. */
export const indexLineOf = (content) => `${movedLine(content.moved)}; following ${followedLine(content.followed)}`;

const filingSaid = (one) => `Title: ${one.title}. Cause: ${one.cause}.`;

/** What a decision carries past its words and its figure, in sentences the page and the terminal
 *  both print: a raise's issue and its two priorities, a filing's title and cause, and what the
 *  reader still owes a filing. A decision held from before these fields existed carries none. */
export const decisionDetail = (one) => {
  if (one.action === "raise" && one.issue) return [`${one.issue} from ${one.from} to ${one.to}.`];
  if (one.action === "comment") return [`${one.issue} is open and matches this filing, so it goes there as a comment.`, filingSaid(one)];
  if (one.action !== "file" || !one.title) return [];
  return [filingSaid(one), ...(one.unchecked ? [`No open issue was checked for it: ${one.unchecked}.`] : []),
    `The body the command reads on stdin is yours to write, with the sections a ${one.category} asks for.`];
};

/** What the terminal prints of the models' reading: the decisions where a judge ran, else the one line
 *  saying why none did, each followed by what did not run and what was dropped. */
export const decisionsSaid = (judgement) => {
  if (!judgement) return [];
  const notes = [...stageLines(judgement), droppedLine(judgement)].filter(Boolean);
  if (!judgement.judged) return [`No decisions: ${judgement.why ?? "no judge ran"}.`, ...notes];
  const items = judgement.decisions.length
    ? judgement.decisions.map((one, at) => [`${at + 1}. ${one.action}: ${one.what} — ${one.figure.said}: ${one.figure.value}`,
      ...decisionDetail(one)].join(" ") + `${one.command ? ` — ${one.command}` : ""}`)
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
