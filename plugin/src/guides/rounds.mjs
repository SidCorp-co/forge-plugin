/* The rounds a rung buys, beside a served part and never in one: docs/cli/the-parts.md. */
import { FEATURE, RUNGS, SPARES, WRITE_READ_OWED } from "../ladder.mjs";

export const rungRefusal = (given) =>
  (given === undefined || given === null || RUNGS.includes(given)
    ? null
    : `\`${given}\` is no rung. This copy serves ${RUNGS.join(", ")}, and a call naming none is `
      + `served the \`${FEATURE}\` text.`);

export const rungServed = (given) => (RUNGS.includes(given) ? given : FEATURE);

const ASSUMED = `No rung was named, so this is the \`${FEATURE}\` text — the top rung, which is what`
  + " an unstated rung resolves to. `--rung <name>` serves a lighter one.";

/* The read the rounds count themselves apart from is under a heading of its own, a line among them reading as one more round bought. */
const boughtBy = (rung) => [
  `Rung \`${rung}\`, and the rounds it buys:`,
  ...SPARES[rung].map((one) => `  ${one}`),
  "And what it still owes:",
  `  ${WRITE_READ_OWED}`,
];

const topRung = (rung) =>
  [`Rung \`${rung}\`, the top one, which is what every rung below it is measured against.`];

/** Told what it buys and never what it was spared, a count of the dropped being the annotation. */
export const roundLines = (given) => {
  if (!RUNGS.includes(given)) return [ASSUMED];
  return SPARES[given]?.length ? boughtBy(given) : topRung(given);
};
