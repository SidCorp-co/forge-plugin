/* The spine cut to one issue, off the tables other readers answer to. The shift this file turns on:
   a phase is the work owed *at* a status and an entry check guards the way *into* one, so the phase
   at a rung answers to the rung above. docs/cli/resume.md. */
import { ORDER, PHASE, stepAfter } from "../flow/earned.mjs";
import { LIGHTER, tierOf } from "../ladder.mjs";

const NUMBERED = /^(\d+)/u;

/** The phase number a status owes, or NaN where the row names none. */
export const phaseNumber = (status) => Number(NUMBERED.exec(PHASE[status]?.[0] ?? "")?.[1] ?? NaN);

/* What each entry check refuses without, held to their own refusals by a case. */
export const CITED = {
  confirmed: "confirmation",
  clarified: "decision",
  approved: "plan",
  in_progress: "baseline",
  developed: "review",
  tested: "verdict",
  released: "verification",
};

export const dischargedBy = (status) => CITED[stepAfter(status)] ?? null;

/** Three readings of one row: every phase it names, the phase a record of a kind ends, and the phase the landing ends. A record's is the rung below the one `CITED` says it earns, and null where that rung owes several phases, since `CITED` does not say which of a rung's records ends it; the landing's is the last its own rung names, that row abbreviating the note and the ship into one cell. docs/cli/the-parts.md. */
const EVERY_NUMBER = /\d+/gu;
const RELEASED = "released";
const rungBelow = (status) => ORDER[ORDER.indexOf(status) - 1] ?? null;

export const phasesOwed = (status) =>
  [...String(PHASE[status]?.[0] ?? "").matchAll(EVERY_NUMBER)].map((one) => Number(one[0]));

export const phaseForRecord = (kind) => {
  const earns = ORDER.find((status) => CITED[status] === kind);
  const owed = earns ? phasesOwed(rungBelow(earns)) : [];
  return owed.length === 1 ? owed[0] : null;
};

export const phaseAtLanding = () => phasesOwed(rungBelow(RELEASED)).at(-1) ?? null;

/** The waiver a tier grants on the way out of a status, named by what it drops and why. */
const waivedFor = (status, size) => {
  const next = stepAfter(status);
  const tier = tierOf(size);
  const row = next && LIGHTER.find((one) => one.status === next && one.tiers.includes(tier));
  return row ? { drops: row.drops, because: row.because } : null;
};

const owedFrom = (status) => {
  const at = ORDER.indexOf(status);
  return at < 0 ? [] : ORDER.slice(at);
};

const numbered = (status) => Number.isFinite(phaseNumber(status));

/* Everything a status alone decides, the waiver below being the only reading that needs a tier. A
   status off `ORDER` — a reopen, a park's side — owes its own row's phase and is not completion. */
const behind = (status) => {
  const aside = !ORDER.includes(status) && numbered(status);
  const owing = aside ? [status] : owedFrom(status).filter(numbered);
  return {
    aside: aside ? status : null,
    owing,
    passed: aside ? [] : ORDER.slice(0, ORDER.indexOf(status)).filter(numbered).map((one) => ({
      status: one,
      phase: PHASE[one][0],
      cites: dischargedBy(one),
    })),
    first: owing.length ? PHASE[owing[0]][0] : null,
  };
};

/** The phases behind this issue with what discharged each, then those owed with what a tier waives. */
export const phaseIndex = ({ status, size }) => {
  const { aside, owing, passed, first } = behind(status);
  return {
    passed,
    owed: owing.map((one) => ({
      status: one,
      phase: PHASE[one][0],
      waived: aside ? null : waivedFor(one, size),
    })),
    first,
    aside,
  };
};

export const READ_OFF_THE_RECORD =
  "Start at the phase owed. The phases before it are read off the record and not run again — each"
  + " one below names the record that discharged it.";

/** The opening on an issue somebody else opened: one line per phase behind, none where none is, and
 *  one renderer for `resume` and `claim` both (ISS-804, BR-09). docs/cli/resume.md. */
export const openingLines = (status) => {
  const { passed, first } = behind(status);
  const earned = first ? passed.filter((one) => one.cites) : [];
  return earned.length
    ? [READ_OFF_THE_RECORD, ...earned.map((one) => `  passed: ${one.phase}  —  ${one.cites}`)]
    : [];
};

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
