/* What the rank looks like on a terminal: one row per candidate, its batch under it, the wave it
   frees, and the issues a filter dropped with the filter that did it. */
import { servesIn, servesSaid } from "../goals.mjs";
import { COMPLEXITY_NAMES } from "../ladder.mjs";
import { UNSET } from "./weights.mjs";
import { DRAINS, drainScope } from "../resolve/settings.mjs";
import { JUDGING } from "./eligible.mjs";
import { ageOf } from "../codex/codex-state.mjs";

const KEY = 8;
const TITLE = 96;

const cut = (text, width) => {
  const one = String(text ?? "").replaceAll(/\s+/gu, " ").trim();
  return one.length > width ? `${one.slice(0, width - 1)}…` : one;
};

const costSaid = (cost) =>
  (cost.minutes === null ? "cost —" : `cost ~${cost.minutes}m`);

const marks = (candidate) =>
  [candidate.restart ? "restart" : null, candidate.warm ? "warm" : null,
    candidate.row.mergedAt ? "merged" : null].filter(Boolean).join(" ");

/* The tracker's stamp to the minute, as the row holds it. A merge mark is asserted by whichever call
   moved the issue, so the row shows it and neither drops nor scores on it: hiding claimable work on a
   caller's word is the silent shrink this verb exists without. The facts beside it are what tell a
   reopened issue's first landing from work that shipped, and a run working the issue is already left
   out by its live lease (ISS-629). */
const stampOf = (at) => String(at).replace(/:\d{2}(?:\.\d+)?Z$/u, "Z");

const mergedSaid = (row) => `merge mark set ${stampOf(row.mergedAt)}, ${ageOf(Date.parse(row.mergedAt))}`;

const mergedLine = (candidate) =>
  `  merged ${mergedSaid(candidate.row)}, while the status reads ${candidate.row.status ?? "(none)"}`
  + ` and the issue has been reopened ${candidate.row.reopenCount ?? 0} time(s)`;

const headRow = (candidate) =>
  [
    candidate.issueId.padEnd(KEY),
    String(candidate.score.total).padStart(3),
    String(candidate.row.priority ?? "none").padEnd(8),
    String(candidate.row.category ?? "").padEnd(11),
    candidate.score.complexity.padEnd(10),
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
    : `median of ${cost.over} run(s) at complexity ${cost.complexity ?? "any, none measured at this one"}`;
  const said = [
    `cost ${cost.minutes === null ? "—" : `${cost.minutes}m`} (${over})`,
    candidate.restart ? "restart: its body names a file no open session can pick up" : null,
    candidate.warm ? `warm: it names ${candidate.warm}, which the last landing touched` : null,
  ].filter(Boolean);
  return `  signal ${said.join(" · ")}`;
};

/* Only where the field is empty, and its own line rather than a widened column: a column can carry `unset` and not the write that clears it, and a line on every candidate would repeat the column for the rows that hold one. docs/cli/next.md carries the rest. */
const unsetLine = (candidate) =>
  `  unset  this lead holds no complexity, so the ladder runs it as a feature. Set one before the brief:`
  + ` forge issue ${candidate.issueId} --set complexity=<${COMPLEXITY_NAMES.join("|")}>`
  + ` --why "<what you read to judge it>"`;

/* Its own line, under both: a `Serves:` is neither a weight nor a signal, and this issue moved no weight, so a goal printed inside either line would read as a number the score used.
   Read off the body here rather than on the way in: only `--why` prints it, where the read loop pays for every body it walks past. */
const servesLine = (candidate) =>
  `  serves ${candidate.read
    ? servesSaid(servesIn(candidate.body))
    : "unknown — this candidate's body was not read at this depth"}`;

const memberLine = (member) =>
  `  + ${member.issueId.padEnd(KEY)} ${member.said.padEnd(44)} ${cut(member.row.title, TITLE)}`
  + `${member.row.mergedAt ? ` · ${mergedSaid(member.row)}` : ""}`;

/* Three reasons to sit beside a batch, and the third is not relatedness: saying nothing where the
   only shared path resolves to nothing would replace a wrong reason with no reason. */
const asideSaid = (one) => {
  if (one.gone) return `not related by module: it ${one.said}`;
  if (one.capped) return "related, not batched: the batch is full";
  return `related, not batched: it ${one.said}, and a batch stays below the top rung throughout`;
};

const asideLine = (one) => `  ~ ${one.issueId.padEnd(KEY)} ${asideSaid(one)}`;

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

const judgingRow = (one) => `  ${one.issueId.padEnd(KEY)} ${cut(one.row.title, TITLE)}`;

/* Which master the project said claims these, said at the queue rather than only in the report: a
   master reads here whether the set in front of it is its own. A key the pair does not take names
   nobody, so neither master takes the rows on a fallback (ISS-1590). */
const drainSaid = () => {
  const held = drainScope();
  if (held.unknown !== undefined) {
    return `drained by — \`drainedBy\` is \`${held.unknown}\`, which is no master that drains `
      + `${JUDGING.join(" or ")}: nothing here says whose these are. \`forge doctor\` names the key.`;
  }
  return `drained by — ${held.value}, ${held.declared ? "declared" : `absent the key, ${DRAINS[0]}`
    + " being what a project that has not decided gets"}. Another master leaves these standing.`;
};

/* Its own section and not a row in the ranking, one scored there taking a place in `--count` from
   the building work that count was asked for: docs/cli/next.md. */
export const judgingLines = (judging) => {
  if (!judging) return [];
  if (judging.unread) {
    return ["", "judging — this project's declaration about who judges went unread, so no issue is "
      + `offered for judging here and none was ruled out: ${judging.unread.split("\n")[0]}`, ""];
  }
  const at = JUDGING.join(" or ");
  return [
    `judging — ${judging.offered.length} issue(s) at ${at} with no live lease, this project having`,
    `declared the judgement above ${at} an independent run's. Each is a judging run's to claim, and`,
    "the run that built it holds nothing.",
    `  ${drainSaid()}`,
    ...judging.offered.map(judgingRow),
    ...(judging.left.length ? [`  left out — ${judging.left.length}:`] : []),
    ...judging.left.map(droppedLine),
    "",
  ];
};

/** Why an order is not bounded, in the words the read's own shortfall is reported in. */
export const boundShort = (cursor, takeable, edges) =>
  `warning: this order is not bounded — ${cursor} of ${takeable} takeable`
  + ` issue(s) were read whole${edges
    ? `, and ${edges} of them declared a blocking relation, which no bound over the unread ones`
      + " survives: an issue further down could be holding up work nothing here counted"
    : ", and the read stopped at readCap before the rest could be ruled out"}. Raise \`rank.readCap\``
  + " in this project's own settings, which `forge doctor` names, or narrow the ask.";

/** What the judging bound did not reach, said on the error stream so both output forms carry it. */
export const judgingShort = (judging, weights) => (judging?.unreached
  ? `warning: ${judging.unreached} further issue(s) at ${JUDGING.join(" or ")} went unread. No`
    + " listing carries a lease, so each row costs a read of its own and the reading stops at"
    + ` windowCap ${weights.windowCap}. Raise \`rank.windowCap\` in this project's own settings,`
    + " which `forge doctor` names, or the rows behind a leased one stay out of reach."
  : null);

/** Every line of one candidate, so the caller composes the answer out of whole candidates. */
export const candidateLines = (batch, { why = false } = {}) => [
  headRow(batch.head),
  ...(batch.head.row.mergedAt ? [mergedLine(batch.head)] : []),
  ...(why ? [whyLine(batch.head), signalLine(batch.head), servesLine(batch.head)] : []),
  ...(why && batch.head.score.complexity === UNSET ? [unsetLine(batch.head)] : []),
  ...batch.members.map(memberLine),
  ...batch.aside.map(asideLine),
  ...(hasWave(batch.wave) ? [unblocksLine(batch.wave)] : []),
];

export const HEAD = `${"issue".padEnd(KEY)} ${"pts".padStart(3)} ${"priority".padEnd(8)} `
  + `${"kind".padEnd(11)} ${"complexity".padEnd(10)} ${"cost".padEnd(9)} ${"signals".padEnd(13)} title`;

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
