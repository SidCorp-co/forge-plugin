/* The spine cut to one issue, off the tables other readers answer to. The shift this file turns on:
   a phase is the work owed *at* a status and an entry check guards the way *into* one, so the phase
   at a rung answers to the rung above. docs/cli/resume.md. */
import { ORDER, PHASE, stepAfter } from "../flow/earned.mjs";
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
  tested: ["verdict"],
  released: ["verification", "note"],
};

export const dischargedBy = (status) => CITED[stepAfter(status)]?.[0] ?? null;

/** Three readings of one row: every phase it names, the phase a record of a kind ends, and the phase the landing ends. A record's is the stage below the one `CITED` says it earns, and null where that stage owes several phases, since `CITED` does not say which of a stage's records ends it; the landing's is the last its own stage names, that row abbreviating the note and the ship into one cell. docs/cli/the-parts.md. */
const EVERY_NUMBER = /\d+/gu;
const RELEASED = "released";
const stageBelow = (status) => ORDER[ORDER.indexOf(status) - 1] ?? null;

export const phasesOwed = (status) =>
  [...String(PHASE[status]?.[0] ?? "").matchAll(EVERY_NUMBER)].map((one) => Number(one[0]));

export const phaseForRecord = (kind) => {
  const earns = ORDER.find((status) => CITED[status]?.includes(kind));
  const owed = earns ? phasesOwed(stageBelow(earns)) : [];
  return owed.length === 1 ? owed[0] : null;
};

export const phaseAtLanding = () => phasesOwed(stageBelow(RELEASED)).at(-1) ?? null;

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

/* Everything a status alone decides, the waiver below being the only reading that needs a rung. A
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

/** The phases behind this issue with what discharged each, then those owed with what a rung waives. */
export const phaseIndex = ({ status, fields }) => {
  const { aside, owing, passed, first } = behind(status);
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
export const openingLines = (status) => {
  const { passed, first } = behind(status);
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

const LANE_WIDTH = 15;

/** The lane as the three verbs print it, one renderer so their blocks cannot differ (ISS-810). */
export const laneLines = ({ status, fields }) => {
  const { aside, rung, rows } = laneOf({ status, fields });
  if (aside) return [`Lane: \`${aside}\` is off the ladder's linear path, so no lane is read from it.`];
  return [
    `Lane at \`${rung}\` — every status from where it stands, and what earns it:`,
    ...rows.map((one) => `  ${one.status.padEnd(LANE_WIDTH)}${laneSaid(one)}`),
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
