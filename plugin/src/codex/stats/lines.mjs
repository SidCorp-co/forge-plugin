/* The one printer of the consult log's figures, off the objects `figures.mjs` returns: a window,
   a group of it, and a group on either side of the eval's two windows. docs/cli/codex-the-stats.md. */
import { WHEN } from "../../stats/windows.mjs";

export const share = (many, of) => (of ? `${Math.round((many / of) * 100)}%` : "—");

/** A window's stats half, one figure a line. */
export const statLines = (held) => {
  const per = (many) => (held.consults ? Math.round(many / held.consults) : 0);
  return [
    `consults          ${held.consults}`,
    `calls reached     ${held.calls.map(([many, rows]) => `${many}:${rows}`).join("  ")}`,
    `ended at budget   ${held.atBudget} of the ${held.budgeted} that recorded one  `
      + `${share(held.atBudget, held.budgeted)}`,
    `said it could not check  ${held.incomplete}  ${share(held.incomplete, held.consults)}`,
    `retried at the ceiling   ${held.retried}  ${share(held.retried, held.consults)}`,
    `rechecks          ${held.rechecks}, ${held.raisedNew} raised a New finding `
      + `${share(held.raisedNew, held.rechecks)}, ${held.newFindings} of them in all`,
    `tokens per consult  ${per(held.spent.input_tokens)} in, ${per(held.spent.cache_read_input_tokens)} from cache, `
      + `${per(held.spent.cache_creation_input_tokens)} written, ${per(held.spent.output_tokens)} out`,
    `read from cache   ${Math.round(held.cached * 100)}% of ${held.sent} input token(s)`,
    ...held.versions.map(([name, many]) => `prompt ${name}  ${many} consult(s)`),
  ];
};

/** The window's whole-set reads, off `readFigures`, under its own figures. */
export const readsLine = ({ reads, runs, rechecks, repeats }) => `whole-set reads   ${reads} over ${runs} run(s), `
  + `${rechecks} recheck(s) at a head not read before, ${repeats} repeat(s) of a head already read`;

export const roundKindLines = (kinds) => kinds.map(({ name, consults, sent, cached, retried, calls }) => {
  const label = `${name.padEnd(8)} ${String(consults).padStart(4)} consult(s)`;
  if (!consults) return `${label}  none in this window`;
  const read = sent ? `${Math.round(cached * 100)}% of ${sent} input token(s)` : "— no input token recorded";
  const reached = calls.length ? calls.map(([many, count]) => `${many}:${count}`).join("  ") : "—";
  return `${label}  read from cache ${read}  calls reached ${reached}  retried ${retried}`;
});

/** A group's score half on one line, the line `log --score` printed per model before ISS-349 retired it. */
export const scoreLine = (label, row) =>
  `${label.padEnd(24)} ${String(row.consults).padStart(4)} consults  ${String(row.findings).padStart(4)} findings `
  + `(${row.zero} none)  ${String(row.accepted).padStart(4)} accepted  ${String(row.rejected).padStart(3)} rejected  `
  + `${String(row.sound).padStart(3)} right about how  ${String(row.misreasoned).padStart(3)} right in conclusion only  `
  + `${String(row.median).padStart(4)}s median  ${row.input ? Math.round((row.cached / row.input) * 100) : 0}% cached`;

/** A group's stats half on the line under its score. */
const groupStatLine = (held) =>
  `${" ".repeat(24)} ${held.rechecks} recheck(s), ${held.raisedNew} raised New  ${held.incomplete} could not check  `
  + `${held.atBudget} of ${held.budgeted} ended at budget  ${held.retried} retried at the ceiling`;

/** A group as `stats --by` prints it: both halves, under its key. */
export const groupedLines = (group) => [scoreLine(group.key, group.score), groupStatLine(group.stats)];

/* An absent measurement is said, never averaged as a zero: a group whose rows predate `usage` would
   otherwise read as the cheap window, which is the one mistake the comparison exists to avoid. */
/** One side of a group in the eval's comparison, off the group object `--json` prints. */
export const groupLines = (group, when) => {
  if (!group) return [`  ${when.padEnd(WHEN)} not in this window`];
  const { score, stats: held, timed, metered } = group;
  const ruled = score.accepted + score.rejected;
  /* Over the findings ruled on how, never over every acceptance: one ruled before the third ruling existed says nothing about its mechanism, and a reading stored before the counts has none. */
  const how = (score.sound ?? 0) + (score.misreasoned ?? 0);
  const per = (many) => Math.round(many / metered);
  const short = (many) => many < group.consults;
  return [
    `  ${when.padEnd(WHEN)} ${String(group.consults).padStart(3)} consult(s)  ${String(score.findings).padStart(4)} finding(s) `
      + `(${score.zero} found none)  ${ruled ? `${share(score.accepted, ruled)} kept of ${ruled} ruled` : "none ruled on"}  `
      + `${how ? `${share(score.sound ?? 0, how)} right about how of ${how}` : "none ruled on how"}  `
      + `${held.raisedNew} of ${held.rechecks} recheck(s) raised New  `
      + `${timed ? `${score.median}s median${short(timed) ? ` of the ${timed} timed` : ""}` : "none timed"}  `
      + `${held.incomplete} could not check`,
    metered
      ? `  ${" ".repeat(WHEN)} tokens/consult${short(metered) ? ` over the ${metered} that recorded usage` : ""}  `
        + `${per(held.spent.input_tokens)} in, `
        + `${per(held.spent.cache_read_input_tokens)} from cache, ${per(held.spent.cache_creation_input_tokens)} written, `
        + `${per(held.spent.output_tokens)} out`
      : `  ${" ".repeat(WHEN)} no consult here recorded what it spent`,
  ];
};

const UNPLACED = "under no heading";

/** The angle rows `anglesOf` returns, one line each, and the rows it could not attribute. */
export const angleLines = ({ angles, unrecorded }) => [
  ...angles.map((one) => {
    const ruled = one.accepted + one.rejected;
    /* No consult asks for the unplaced row, so a count there would read as one that did. */
    const asked = one.angle === null ? "" : `${one.consults} consult(s)`;
    return `${(one.angle ?? UNPLACED).padEnd(18)} ${asked.padStart(15)}  `
      + `${String(one.findings).padStart(4)} finding(s)  `
      + `${ruled ? `${one.accepted} kept, ${one.rejected} dropped, ${share(one.accepted, ruled)} of ${ruled} ruled by id` : "none ruled by id"}`;
  }),
  ...(unrecorded ? [`${unrecorded} consult(s) recorded no angles, and are in no row above`] : []),
];
