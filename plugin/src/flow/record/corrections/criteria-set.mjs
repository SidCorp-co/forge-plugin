/* What a field write does to the value it replaces, said before the write where it would drop held
   criteria and after it on every write. The argument for refusing rather than only reporting, and for
   comparing numbers rather than text: docs/cli/record-corrections.md. */
import { refuse } from "../../../refusal.mjs";

const NUMBERED = /^(\d+)\.\s/u;

export const REPLACE = "--replace";

/* Read tolerantly: the stored field is whatever the tracker holds, prose around the lines included,
   and a line it cannot number is no criterion to drop. */
const numbersOf = (text) => [...new Set(String(text ?? "").split("\n")
  .map((line) => NUMBERED.exec(line.trim())?.[1])
  .filter(Boolean)
  .map(Number))].sort((one, two) => one - two);

/* `1-44, 47`: a run of consecutive numbers is one span, since forty-four numbers in a row is a
   line nobody reads. */
const spans = (numbers) => {
  const out = [];
  for (const number of numbers) {
    const last = out.at(-1);
    if (last && number === last.to + 1) last.to = number;
    else out.push({ from: number, to: number });
  }
  return out.map(({ from, to }) => (from === to ? `${from}` : `${from}-${to}`)).join(", ");
};

const changeOf = (heldText, criteria) => {
  const held = numbersOf(heldText);
  const incoming = criteria.map((one) => one.number);
  return {
    held,
    incoming,
    dropped: held.filter((number) => !incoming.includes(number)),
    added: incoming.filter((number) => !held.includes(number)).sort((one, two) => one - two),
    lowest: Math.min(...incoming),
  };
};

const dropRefusal = (reference, change) => {
  const { held, incoming, dropped, lowest } = change;
  const said = [];
  if (dropped.length) {
    said.push(`record criteria: ${reference} holds ${held.length} criteria and this file holds ${incoming.length},`
      + ` and the write replaces the whole set, so it would drop ${dropped.length} of them: ${spans(dropped)}.`);
  }
  if (lowest !== 1) {
    said.push(`record criteria: this file's set opens at ${lowest}, and a set of criteria opens at 1.`);
  }
  return [
    ...said,
    "Nothing was sent. Send the file with every criterion the issue is to hold — the set it holds now:",
    `  forge issue ${reference} --fields acceptanceCriteria`,
    `or pass ${REPLACE} to write this set as it stands, dropping what it leaves out.`,
  ].join("\n");
};

/**
 * Refuses a criteria write that would drop a held number, or whose set does not open at 1, unless
 * `replace` says the caller means it; refuses `replace` where the write drops nothing, since a flag
 * read and left unused reads to its caller as the thing it asked for. Returns the line the write
 * prints once the field has taken it.
 */
export const criteriaSetChecked = (reference, heldText, criteria, replace) => {
  const change = changeOf(heldText, criteria);
  const narrows = change.dropped.length > 0 || change.lowest !== 1;
  if (narrows && !replace) refuse(dropRefusal(reference, change));
  if (!narrows && replace) {
    refuse(`${REPLACE} drops criteria the field holds, and this write drops none, so nothing was sent.`
      + ` Send it again without ${REPLACE}.`);
  }
  return criteriaChanged(change);
};

const criteriaChanged = ({ held, incoming, dropped, added }) => {
  const parts = [`criteria: the field held ${held.length} and now holds ${incoming.length}`];
  if (dropped.length) parts.push(`dropped ${spans(dropped)}`);
  if (added.length && held.length) parts.push(`added ${spans(added)}`);
  return `${parts.join("; ")}.`;
};

const linesOf = (text) => String(text ?? "").trim().split("\n").filter((line) => line.trim()).length;

/** What a plan write did to the plan it replaced: a plan has no numbered unit to compare, so the
 *  line counts are what a caller can tell a replacement from an addition by. */
export const planChanged = (heldText, plan) => {
  const held = linesOf(heldText);
  return held
    ? `plan: the field held ${held} line${held === 1 ? "" : "s"} and now holds ${linesOf(plan)}, replaced whole.`
    : `plan: the field held no plan and now holds ${linesOf(plan)} line${linesOf(plan) === 1 ? "" : "s"}.`;
};
