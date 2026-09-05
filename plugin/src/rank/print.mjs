/* What the rank looks like on a terminal: one row per candidate, its batch under it, the wave it
   frees, and the issues a filter dropped with the filter that did it. */
const KEY = 8;
const TITLE = 96;

const cut = (text, width) => {
  const one = String(text ?? "").replaceAll(/\s+/gu, " ").trim();
  return one.length > width ? `${one.slice(0, width - 1)}…` : one;
};

const costSaid = (cost) =>
  (cost.minutes === null ? "cost —" : `cost ~${cost.minutes}m`);

const marks = (candidate) =>
  [candidate.restart ? "restart" : null, candidate.warm ? "warm" : null].filter(Boolean).join(" ");

export const headRow = (candidate) =>
  [
    candidate.issueId.padEnd(KEY),
    String(candidate.score.total).padStart(3),
    String(candidate.row.priority ?? "none").padEnd(8),
    String(candidate.row.category ?? "").padEnd(11),
    candidate.score.band.padEnd(5),
    costSaid(candidate.cost).padEnd(9),
    marks(candidate).padEnd(13),
    cut(candidate.row.title, TITLE),
  ].join(" ");

/* A `said` that is only the points again is the number twice: `reopened 0 0` reads as a bug. */
export const whyLine = (candidate) =>
  `  why    ${candidate.score.parts
    .map(([name, said, points]) => (said === String(points) ? `${name} ${points}` : `${name} ${said} ${points}`))
    .join(" · ")}`;

export const signalLine = (candidate) => {
  const { cost } = candidate;
  const over = cost.minutes === null
    ? "no measured run under this transcript root; --project names the checkout the runs were worked in"
    : `median of ${cost.over} run(s) at band ${cost.band ?? "any, none measured at this one"}`;
  const said = [
    `cost ${cost.minutes === null ? "—" : `${cost.minutes}m`} (${over})`,
    candidate.restart ? "restart: its body names a hook or a skill" : null,
    candidate.warm ? `warm: it names ${candidate.warm}, which the last landing touched` : null,
  ].filter(Boolean);
  return `  signal ${said.join(" · ")}`;
};

export const memberLine = (member) =>
  `  + ${member.issueId.padEnd(KEY)} ${member.said.padEnd(44)} ${cut(member.row.title, TITLE)}`;

export const asideLine = (one) =>
  `  ~ ${one.issueId.padEnd(KEY)} related, not batched: ${one.capped ? "the batch is full" : `it ${one.said}, and a batch is fix-size throughout`}`;

const chainSaid = (path) => path.join(" -> ");

export const unblocksLine = (chains) =>
  `  unblocks ${chains.map(chainSaid).join(", ")} (eligible after this lands)`;

export const droppedLine = (one) =>
  `  ${one.issueId.padEnd(KEY)} ${one.reason}`;

/** Every line of one candidate, so the caller composes the answer out of whole candidates. */
export const candidateLines = (batch, { why = false } = {}) => [
  headRow(batch.head),
  ...(why ? [whyLine(batch.head), signalLine(batch.head)] : []),
  ...batch.members.map(memberLine),
  ...batch.aside.map(asideLine),
  ...(batch.chains.length ? [unblocksLine(batch.chains)] : []),
];

export const HEAD = `${"issue".padEnd(KEY)} ${"pts".padStart(3)} ${"priority".padEnd(8)} `
  + `${"kind".padEnd(11)} ${"band".padEnd(5)} ${"cost".padEnd(9)} ${"signals".padEnd(13)} title`;
