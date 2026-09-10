/* The spine cut to one issue, off the tables other readers answer to. The shift this file turns on:
   a phase is the work owed *at* a status and an entry check guards the way *into* one, so the phase
   at a rung answers to the rung above. docs/cli/resume.md. */
import { ORDER, PHASE, stepAfter } from "../flow/earned.mjs";
import { CLOSES_FROM } from "../flow/machine.mjs";
import { LIGHTER, rungOf } from "../ladder.mjs";

const NUMBERED = /^(\d+)/u;

/** The phase number a status owes, or NaN where the row names none. */
export const phaseNumber = (status) => Number(NUMBERED.exec(PHASE[status]?.[0] ?? "")?.[1] ?? NaN);

/* Every payload each entry check refuses without, held to their own refusals by a case. The one that discharges the phase below the status leads the row, `dischargedBy` answering with it. */
export const CITED = {
  confirmed: ["confirmation"],
  clarified: ["decision"],
  approved: ["plan", "criteria"],
  in_progress: ["baseline"],
  developed: ["review", "merged"],
  awaiting_release: ["verdict", "verification", "note"],
};

export const dischargedBy = (status) => CITED[stepAfter(status)]?.[0] ?? null;

/** Two readings of one row: every phase it names, and the phase the landing ends — the last its own row names, that row abbreviating the note and the ship into one cell. docs/cli/the-parts.md. */
const EVERY_NUMBER = /\d+/gu;

export const phasesOwed = (status) =>
  [...String(PHASE[status]?.[0] ?? "").matchAll(EVERY_NUMBER)].map((one) => Number(one[0]));

/* Which phase each cited record ends, declared per kind rather than derived from where its rung sits in the order. A rung naming several phases holds records that end different ones and no table says which, so the derivation answered nothing for four of these ten (ISS-1064). Keyed by the kind, so merging two rungs moves no row of this. A case recomputes that derivation over every row and refuses one that disagrees wherever the two tables can still answer, which is the six that are not review, merged, verification and note. */
export const ENDS_PHASE = {
  confirmation: 1,
  decision: 2,
  plan: 3,
  criteria: 3,
  baseline: 4,
  review: 4,
  merged: 7,
  verdict: 5,
  verification: 7,
  note: 6,
};

export const phaseForRecord = (kind) => ENDS_PHASE[kind] ?? null;

export const phaseAtLanding = () => phasesOwed(CLOSES_FROM).at(-1) ?? null;

/** The waiver a rung grants on the way out of a status, named by what it drops and why. */
const waivedFor = (status, fields) => {
  const next = stepAfter(status);
  const rung = rungOf(fields);
  const row = next && LIGHTER.find((one) => one.status === next && one.rungs.includes(rung));
  return row ? { drops: row.drops, because: row.because } : null;
};

const owedFrom = (status) => {
  const at = ORDER.indexOf(status);
  return at < 0 ? [] : ORDER.slice(at);
};

const numbered = (status) => Number.isFinite(phaseNumber(status));

/* A rung below the status is passed when the record that discharges it is on the page: the status is
   a cache of the records with fewer slots than there are facts, so one set by hand claimed phases
   nothing earned (ISS-1064). Capped at the status, since the phase owed is still the status's. */
const passedIn = (status, held) => ORDER.slice(0, ORDER.indexOf(status)).filter(numbered)
  .map((one) => ({ status: one, phase: PHASE[one][0], cites: dischargedBy(one) }))
  .filter((one) => one.cites && held.includes(one.cites));

/* What is ahead is the status's alone, the waiver below being the only reading that needs a rung. A
   status off `ORDER` — a reopen, a park's side — owes its own row's phase and is not completion. */
const behind = (status, held) => {
  const aside = !ORDER.includes(status) && numbered(status);
  const owing = aside ? [status] : owedFrom(status).filter(numbered);
  return {
    aside: aside ? status : null,
    owing,
    passed: aside ? [] : passedIn(status, held),
    first: owing.length ? PHASE[owing[0]][0] : null,
  };
};

export const phaseIndex = ({ status, fields, held }) => {
  const { aside, owing, passed, first } = behind(status, held);
  return {
    passed,
    owed: owing.map((one) => ({
      status: one,
      phase: PHASE[one][0],
      waived: aside ? null : waivedFor(one, fields),
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
export const openingLines = (status, held) => {
  const { passed, first } = behind(status, held);
  const earned = first ? passed.filter((one) => one.cites) : [];
  return earned.length
    ? [READ_OFF_THE_RECORD, ...earned.map((one) => `  passed: ${one.phase}  —  ${one.cites}`)]
    : [];
};

/* The lane: every status from this one on, and the payloads each is earned by at this rung, read off the two tables and never off the record — so a status it says owes nothing is one the rung leaves no payload to write rather than one whose payload happens to be on the page, which is the distinction ISS-810 defers. A route is not a shortfall. docs/cli/the-ladder.md. */
const droppedAt = (status, rung) => LIGHTER
  .filter((one) => one.status === status && one.rungs.includes(rung))
  .map((one) => one.kind);

export const laneOf = ({ status, fields }) => {
  const at = ORDER.indexOf(status);
  if (at < 0) return { aside: status, rows: [] };
  const rung = rungOf(fields);
  return {
    aside: null,
    rung,
    rows: ORDER.slice(at).map((one) => {
      const earns = CITED[one] ?? [];
      const dropped = droppedAt(one, rung);
      return {
        status: one,
        here: one === status,
        earns,
        dropped,
        owed: earns.filter((kind) => !dropped.includes(kind)),
      };
    }),
  };
};

/* Two answers and not one: a status this rung leaves nothing to write at is one a lighter rung bought, and one no rung ever asks a payload of is earned by the status below it — a reader given a single sentence for both would read the ladder as the reason for either. */
const laneSaid = (row) => {
  if (row.here) return "← where it stands";
  if (!row.earns.length) return "nothing owed at any rung";
  const dropped = row.dropped.map((kind) => `no ${kind}`).join(", ");
  if (!row.owed.length) return "nothing owed at this rung";
  return row.dropped.length ? `${row.owed.join(", ")}; ${dropped} at this rung` : row.owed.join(", ");
};

/* The longest rung the order holds and one space past it, so a rename cannot run a status into what earns it. Measured at the print: the order reaches this file through a cycle, and read at load it is a name in its own dead zone (ISS-1022). */
const laneWidth = () => Math.max(...ORDER.map((one) => one.length)) + 1;

/** The lane as the three verbs print it, one renderer so their blocks cannot differ (ISS-810). */
export const laneLines = ({ status, fields }) => {
  const { aside, rung, rows } = laneOf({ status, fields });
  if (aside) return [`Lane: \`${aside}\` is off the ladder's linear path, so no lane is read from it.`];
  return [
    `Lane at \`${rung}\` — every status from where it stands, and what earns it:`,
    ...rows.map((one) => `  ${one.status.padEnd(laneWidth())}${laneSaid(one)}`),
    ...(rows.some((one) => !one.here && one.owed.length)
      ? ["Each name is a record kind: `forge record <kind> -h`."]
      : []),
  ];
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
