/* The spine cut to one issue, off the tables other readers answer to. The shift this file turns on:
   a phase is the work owed *at* a status and an entry check guards the way *into* one, so the phase
   at a rung answers to the rung above. docs/cli/resume.md. */
import { ORDER, PHASE } from "../flow/earned.mjs";
import { LIGHTER, tierOf } from "../ladder.mjs";

const NUMBERED = /^(\d+)/u;

/** The phase number a status owes, or NaN where the row names none. */
export const phaseNumber = (status) => Number(NUMBERED.exec(PHASE[status]?.[0] ?? "")?.[1] ?? NaN);

/* What each entry check refuses without, held to their own refusals by a case. */
const CITES = {
  confirmed: "confirmation",
  clarified: "decision",
  approved: "plan",
  in_progress: "baseline",
  developed: "review",
  tested: "verdict",
  released: "verification",
};

export const CITED = CITES;

/** The rung above, on the shift the header states. */
const above = (status) => {
  const at = ORDER.indexOf(status);
  return at < 0 || at + 1 >= ORDER.length ? null : ORDER[at + 1];
};

export const dischargedBy = (status) => CITES[above(status)] ?? null;

/** The waiver a tier grants on the way out of a status, named by what it drops and why. */
export const waivedFor = (status, size) => {
  const next = above(status);
  const tier = tierOf(size);
  const row = next && LIGHTER.find((one) => one.status === next && one.tiers.includes(tier));
  return row ? { drops: row.drops, because: row.because } : null;
};

const owedFrom = (status) => {
  const at = ORDER.indexOf(status);
  return at < 0 ? [] : ORDER.slice(at);
};

const numbered = (status) => Number.isFinite(phaseNumber(status));

/** The phases behind this issue with what discharged each, then those owed. A status off `ORDER` —
 *  a reopen, a park's side status — owes its own row's phase and is not read as completion. */
export const phaseIndex = ({ status, size }) => {
  const aside = !ORDER.includes(status) && numbered(status);
  const owing = aside ? [status] : owedFrom(status).filter(numbered);
  return {
    passed: aside ? [] : ORDER.slice(0, ORDER.indexOf(status)).filter(numbered).map((one) => ({
      status: one,
      phase: PHASE[one][0],
      cites: dischargedBy(one),
    })),
    owed: owing.map((one) => ({
      status: one,
      phase: PHASE[one][0],
      waived: aside ? null : waivedFor(one, size),
    })),
    first: owing.length ? PHASE[owing[0]][0] : null,
    aside: aside ? status : null,
  };
};

export const READ_OFF_THE_RECORD =
  "Start at the phase owed. The phases before it are read off the record and not run again — each"
  + " one below names the record that discharged it.";

export const indexLines = (slug, ref, index) => [
  `${slug} for ${ref} — ${index.first ? `phase owed: ${index.first}` : "no phase owed"}`
    + `${index.aside ? ` (${index.aside}, which is off the ladder's linear path)` : ""}`,
  READ_OFF_THE_RECORD,
  "",
  ...index.passed.filter((one) => one.cites).map((one) => `passed   ${one.phase}  —  ${one.cites}`),
  ...index.owed.map((one) => (one.waived
    ? `owed     ${one.phase}  —  without ${one.waived.drops}; ${one.waived.because}`
    : `owed     ${one.phase}`)),
  "",
  `The phase itself: \`forge guide ${slug} <phase>\`.`,
];
