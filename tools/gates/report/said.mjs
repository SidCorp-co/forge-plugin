/* `known` is the step's whole list and never the subset the record answers for, which would read `0 of 0` on the very run these lines exist to show; and what has to fail is a count and not the seconds, which shrink on a faster box while the same waste stands (ISS-1746). */
const heldSaid = ({ spent, known, seconds, unpriced }) => {
  const held = known - spent;
  if (held === 0) return "none held back";
  const priced = held - unpriced;
  const clauses = [`${held} held back`];
  if (priced > 0) clauses.push(`${Math.round(seconds)}s when they last ran`);
  if (unpriced > 0) {
    clauses.push(priced > 0 ? `${unpriced} the record prices nothing for` : "and the record prices none of them");
  }
  return clauses.join(", ");
};

/* The excess keeps the `>`, a context the record does not hold being an explanation and never a licence: those files were spent for nothing the change reaches. And `accounted for neither way` never says `wasted`, the record erring both ways — a listing claim over-counts the reach, a set recorded before the file gained a dependency under-counts it. */
const reachSaid = ({ spent, reached, blind, elsewhere, past }) => {
  const over = [...(elsewhere > 0 ? [`${elsewhere} spent under a context the record does not hold`] : []),
    ...(past > 0 ? [`${past} accounted for neither way`] : [])];
  const sum = `spent ${spent} ${over.length === 0 ? "=" : ">"} ${reached} reached + ${blind} blind`;
  return over.length === 0 ? sum : `${sum}, ${over.join(" and ")}`;
};

export const stepSaid = (label, took, spend) => {
  if (spend === null) return `--- ${label}: ${took}s`;
  const counted = spend.reach === null ? "" : `; ${reachSaid(spend.reach)}`;
  return `--- ${label}: ${spend.spent} of ${spend.known} file(s), ${took}s (${heldSaid(spend)}${counted})`;
};

/** Nothing to compare against, or compared against and missed — both printed nothing, and the first hid ISS-1739 for a day. */
export const ledgerSaid = (step) => `spend ${step.label.padEnd(22)} `
  + (step.contents === 0
    ? "the record holds no pass for this step at any content"
    : `digest ${step.digest}, and the ${step.contents} pass(es) it holds for this step are at other content`);

const spentSaid = (spend, unknown) => {
  if (unknown.length === 0) return "every one has a recorded set, at other content";
  if (unknown.length === spend.length) return "the record holds no set for any of them";
  return `${unknown.length} the record holds no set for at all, `
    + `${spend.length - unknown.length} whose recorded set is at other content`;
};

/** Printed for every test step under a read ledger: a block that appears on success alone is silent on the run that needs it. */
export const readsSaid = ({ step, kept, spend, unknown }) => {
  const byClaim = kept.filter((one) => one.set?.declared).length;
  return [
    `\n=== reads: ${step.label} — ${kept.length} of ${kept.length + spend.length} test file(s) `
      + `already answered for at this content${byClaim === 0 ? "" : `, ${byClaim} of them by a declaration`} ===`,
    ...kept.map((each) => `skip ${each.file}  digest ${each.digest}`
      + (each.set?.declared ? `  declared while blind on ${each.set.declared}` : "")),
    ...(spend.length === 0 ? [] : [`spend ${spend.length} test file(s): ${spentSaid(spend, unknown)}`]),
  ];
};

export const wroteSets = ({ files, wrote, declared }) =>
  `reads: ${wrote} of ${files} test file(s) recorded what they asked for, ${wrote - declared} by `
  + `derivation and ${declared} against a declaration; ${files - wrote} answered for nothing and `
  + `are spent again`;

/** The ceiling a file no longer needs, named with the blindness it was written against, that being what a reader has to check has really gone before deleting it. */
export const deadClaim = (one) =>
  `reads: ${one.file} derived its own set, so the declaration at ${one.where} had no effect — it `
  + `was recorded against ${one.blind}, and the audit reports no blindness now`;

export const escapedClaim = (one) =>
  `${one.file} read ${one.escapes.map((each) => `${each.one} (${each.kind})`).join(", ")}, which the `
  + `declaration at ${one.where} does not cover: ${one.claims.join(", ")}. Widen it in `
  + `tools/gates/steps.mjs, or drop it and let the file be spent.`;

export const verdictSaid = ({ files = [], unitless = 0 }) => [
  ...files.map((one) => `${one.step} ${one.spent} of ${one.known} file(s)`),
  ...(unitless > 0 ? [`${unitless} step(s) with no file unit ran whole`] : []),
];
