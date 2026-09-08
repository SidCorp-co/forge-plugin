/* What the rank looks like on a terminal: one row per candidate, its batch under it, the wave it
   frees, and the issues a filter dropped with the filter that did it. */
import { servesIn, servesSaid } from "../goals.mjs";

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

const headRow = (candidate) =>
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
const whyLine = (candidate) =>
  `  why    ${candidate.score.parts
    .map(([name, said, points]) => (said === String(points) ? `${name} ${points}` : `${name} ${said} ${points}`))
    .join(" · ")}`;

const signalLine = (candidate) => {
  const { cost } = candidate;
  const over = cost.minutes === null
    ? "no measured run under this transcript root; --checkout names the tree the runs were worked in"
    : `median of ${cost.over} run(s) at band ${cost.band ?? "any, none measured at this one"}`;
  const said = [
    `cost ${cost.minutes === null ? "—" : `${cost.minutes}m`} (${over})`,
    candidate.restart ? "restart: its body names a file no open session can pick up" : null,
    candidate.warm ? `warm: it names ${candidate.warm}, which the last landing touched` : null,
  ].filter(Boolean);
  return `  signal ${said.join(" · ")}`;
};

/* Its own line, under both: a `Serves:` is neither a weight nor a signal, and this issue moved no weight, so a goal printed inside either line would read as a number the score used.
   Read off the body here rather than on the way in: only `--why` prints it, where the read loop pays for every body it walks past. */
const servesLine = (candidate) =>
  `  serves ${candidate.read
    ? servesSaid(servesIn(candidate.body))
    : "unknown — this candidate's body was not read at this depth"}`;

const memberLine = (member) =>
  `  + ${member.issueId.padEnd(KEY)} ${member.said.padEnd(44)} ${cut(member.row.title, TITLE)}`;

const asideLine = (one) =>
  `  ~ ${one.issueId.padEnd(KEY)} related, not batched: ${one.capped ? "the batch is full" : `it ${one.said}, and a batch is fix-size throughout`}`;

const chainSaid = (path) => path.join(" -> ");

/* Rendering only; which of the three list an issue falls in is `waveUnder`'s. */
const unblocksLine = ({ frees, waiting, behind }) => [
  "  unblocks",
  [
    frees.length ? `${frees.join(", ")} (eligible after this lands)` : null,
    ...waiting.map((one) => `${one.issueId} once ${one.on.join(" and ")} land${one.on.length > 1 ? "" : "s"} too`),
    behind.length ? `behind them ${behind.map(chainSaid).join(", ")}` : null,
  ].filter(Boolean).join("; "),
].join(" ");

const hasWave = ({ frees, waiting, behind }) => Boolean(frees.length || waiting.length || behind.length);

export const droppedLine = (one) =>
  `  ${one.issueId.padEnd(KEY)} ${one.reason}`;

/** Every line of one candidate, so the caller composes the answer out of whole candidates. */
export const candidateLines = (batch, { why = false } = {}) => [
  headRow(batch.head),
  ...(why ? [whyLine(batch.head), signalLine(batch.head), servesLine(batch.head)] : []),
  ...batch.members.map(memberLine),
  ...batch.aside.map(asideLine),
  ...(hasWave(batch.wave) ? [unblocksLine(batch.wave)] : []),
];

export const HEAD = `${"issue".padEnd(KEY)} ${"pts".padStart(3)} ${"priority".padEnd(8)} `
  + `${"kind".padEnd(11)} ${"band".padEnd(5)} ${"cost".padEnd(9)} ${"signals".padEnd(13)} title`;

const edgeRow = (edge) =>
  `  ${String(edge.from).padEnd(KEY)} -> ${String(edge.to).padEnd(KEY)} ${edge.kind}`
  + `${edge.orders ? "" : `, ordering nothing (${edge.said})`}`;

/* Two headings and not one list: an edge the tracker holds gates a dispatch and a sentence in a body
   gates nothing, so a reader who cannot tell them apart has been told the wrong thing about both. */
const claimRow = (claim) =>
  `  ${String(claim.from).padEnd(KEY)} -> ${String(claim.to).padEnd(KEY)} blocks, `
  + `${claim.by.size > 1 ? "both sides say so" : `stated by ${[...claim.by][0]} only`}`;

/* An issue's own edges are few and every one of them is worth a line; a whole backlog's are not —
   the ones that order are what a dispatch turns on, and the rest are a count. */
const edgeRows = (edges, verbose) => {
  if (!edges.length) return ["  none: no issue read here carries one"];
  if (verbose) return edges.map(edgeRow);
  const orders = edges.filter((edge) => edge.orders);
  const rest = edges.length - orders.length;
  return [
    ...(orders.length ? orders.map(edgeRow) : ["  none of them orders a dispatch"]),
    ...(rest ? [`  and ${rest} that order nothing: a relates edge, an expired one, or one whose`
      + " other end is already developed"] : []),
  ];
};

/** The edges the ranking reads, then the claims only a body makes, then what the reading covered. */
export const graphLines = ({ edges, claims, unresolved, said, verbose = false }) => [
  `edges the ranking reads — ${edges.length} on this reading`,
  ...edgeRows(edges, verbose),
  "",
  `claims found only in prose, which gate nothing — ${claims.length}`,
  ...(claims.length ? claims.map(claimRow) : ["  none"]),
  ...unresolved.map((one) => `  unresolved: ${one.from} names "${one.phrase}", matching no title`),
  "",
  said,
];
