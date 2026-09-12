/* The spine cut to one issue, off the tables other readers answer to. The shift this file turns on:
   a phase is the work owed *at* a status and an entry check guards the way *into* one, so the phase
   at a rung answers to the rung above. docs/cli/resume.md. */
import { ORDER, stepAfter } from "../flow/earned.mjs";
import { CLOSES_FROM, atMinute } from "../flow/machine.mjs";
import { POINTER } from "../flow/worklog.mjs";
import { shortSha } from "../tracker/evidence.mjs";
import { lighterRows, rungOf } from "../ladder.mjs";

/* The method's phases, numbered as the guide numbers them and indexed by that number. The one table: the flow table below builds its phrases from it and the transcript miner counts a run's calls against it, so phase 5 is one phase rather than two that shared a number and meant "prove" in one reading and "ship" in the other (ISS-700, BR-09). */
export const PHASES = [
  "0 Project", "1 Triage", "2 Clarify", "3 Plan", "4 Implement", "5 Prove", "6 Note", "7 Ship", "8 Learn",
];

/* The flow table's last column: which phase a status owes, and where its method lives — the reference the phase cites, or null where the body itself carries the phase. Here rather than beside `ORDER`, the sequence being what a record earns and this what the method owes at each rung. A cell names as many phases as are worked while the status is held, so a rung the ladder folded two into names both and holds the records that earn the status above it across the pair. ISS-18 owns typing it; a pointer beats a number nobody can look up. */
export const PHASE = {
  open: [PHASES[1], null],
  confirmed: [`${PHASES[2]}; ${PHASES[3]}`, null],
  approved: [`${PHASES[4]}, to the branch`, "verification"],
  in_progress: [`${PHASES[4]}, to the review; ${PHASES[5]}; then 7's landing`, "verification"],
  developed: [PHASES[5], "verification"],
  testing: [`6, ${PHASES[7]}`, null],
  /* The contract's cells and this table's are mirrored, so `forge guide contract awaiting_release` is what a reader is held to: the close is the tail of the ship's own phase and the row names it there. */
  awaiting_release: [`${PHASES[7]}, the close`, null],
  closed: ["none", "learning"],
  dropped: ["none", "learning"],
  reopen: [`${PHASES[1]}, of the person's finding`, null],
};

export const methodOf = (status) => {
  const held = PHASE[status];
  if (!held) return null;
  return { phase: held[0], reference: held[1] ? `forge guide issue-flow ${held[1]}` : "forge guide issue-flow" };
};

const NUMBERED = /^(\d+)/u;

/** The phase number a status owes, or NaN where the row names none. */
export const phaseNumber = (status) => Number(NUMBERED.exec(PHASE[status]?.[0] ?? "")?.[1] ?? NaN);

/* Every payload each entry check refuses without, held to their own refusals by a case. The one that discharges the phase below the status leads the row, `dischargedBy` answering with it. */
export const CITED = {
  confirmed: ["confirmation"],
  approved: ["decision", "plan", "criteria"],
  in_progress: ["baseline"],
  developed: ["review", "merged"],
  testing: ["verdict"],
  awaiting_release: ["verification", "note"],
};

export const dischargedBy = (status) => CITED[stepAfter(status)]?.[0] ?? null;

/** Two readings of one row: every phase it names, and the phase the landing ends — the last its own row names, that row abbreviating the note and the ship into one cell. docs/cli/addressing-a-part.md. */
const EVERY_NUMBER = /\d+/gu;

export const phasesOwed = (status) =>
  [...String(PHASE[status]?.[0] ?? "").matchAll(EVERY_NUMBER)].map((one) => Number(one[0]));

/* Which phase each cited record ends, declared per kind rather than derived from where its rung sits in the order. A rung naming several phases holds records that end different ones and no table says which, so the derivation answered nothing for four of these ten (ISS-1064) and answers nothing for seven of them now that the fold gave `confirmed` two phases (ISS-1066). Keyed by the kind, so merging two rungs moves no row of this: every row below outlived the fold unedited, which is what the column was for. */
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

/** Every waiver a rung grants on the way out of a status, each named by what it drops and why. A list, because one status may drop several payloads and the first of them is not the whole of what the rung bought; the plural name is what makes a reader testing this for one waiver fail rather than read an empty list as a granted one (ISS-1066). */
const waiversFor = (status, fields) => {
  const next = stepAfter(status);
  return next ? lighterRows(next, fields).map((one) => ({ drops: one.drops, because: one.because })) : [];
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
      waivers: aside ? [] : waiversFor(one, fields),
    })),
    first,
    aside,
  };
};

/* Each clause says the reading and stops there. The base is the merge-base the capture measured, so equal to the head it means the branch had nothing of its own then — a branch just cut and a branch just merged both — and the tense is the capture's, this being two saved values and no reading of a default branch that may have moved since (consult ecf127 F2, 6f36f2 F1). docs/cli/the-work.md. */
const headSaid = (work) => {
  if (!work.base) return `at ${shortSha(work.head)}`;
  return work.base === work.head
    ? `at ${shortSha(work.head)}, its own base at that reading, so nothing of its own on it`
    : `at ${shortSha(work.head)}, cut from ${shortSha(work.base)}`;
};

/* One phrase per pointer field, so a field added to `POINTER` fails here rather than going unprinted; `base` has none of its own, the head's clause being where a base is a fact. */
const SAID = {
  branch: (work) => work.branch,
  head: headSaid,
  base: () => null,
  at: (work) => `captured ${atMinute(work.at)}`,
};

const reachSaid = (reach) => {
  if (!reach) return null;
  if (!reach.here) {
    return "no checkout here holds that commit. Fetch, and start this phase over if it does not arrive.";
  }
  /* Both arms qualified, a remote-tracking ref being a reading of the last fetch and not of the remote: a force-push since leaves the first stale, a push from elsewhere leaves the second, and neither arm may say where the work is — only what this checkout has seen of it (consults 34d2ee F2, ecf127 F1). */
  return reach.remote
    ? `this checkout holds that commit, and ${reach.remote} carried it as of the last fetch here.`
    : "this checkout holds that commit, and no remote-tracking ref here contains it as of the last "
      + "fetch, so nothing seen from here would survive losing this machine.";
};

const LEAD = "work: ";

/** The work the last run left, in the one place a reader of either verb meets it. docs/cli/the-work.md. */
export const workLines = (work) => {
  if (!work?.branch) return [];
  const said = POINTER.map((name) => (work[name] ? SAID[name](work) : null)).filter(Boolean);
  const reach = reachSaid(work.reach);
  return [
    `${LEAD}${said.join(", ")}`,
    ...(reach ? [`${" ".repeat(LEAD.length)}${reach}`] : []),
  ];
};

export const READ_OFF_THE_RECORD =
  "Start at the phase owed. The phases before it are read off the record and not run again — each"
  + " one below names the record that discharged it.";

/** The opening on an issue somebody else opened: one line per phase behind, none where none is, and one renderer for `resume` and `claim` both (ISS-804, BR-09). docs/cli/resume.md. */
/* And the work under the record, gated on a phase being owed — a closed issue's branch is nobody's next step — and on the branch, so a phase owed with nothing behind it reads exactly as it did (ISS-1183). */
export const openingLines = (status, held, work = null) => {
  const { passed, first } = behind(status, held);
  const earned = first ? passed.filter((one) => one.cites) : [];
  const lines = earned.length
    ? [READ_OFF_THE_RECORD, ...earned.map((one) => `  passed: ${one.phase}  —  ${one.cites}`)]
    : [];
  return first ? [...lines, ...workLines(work).map((one) => `  ${one}`)] : lines;
};

/** Whether the opening is where the pointer is printed at this status, so the block below it renders what the opening left to nobody rather than a fact going unsaid (ISS-1183). */
export const opensWork = (status, held) => Boolean(behind(status, held).first);

/* The lane: every status from this one on, and the payloads each is earned by at this rung, read off the two tables and never off the record — so a status it says owes nothing is one the rung leaves no payload to write rather than one whose payload happens to be on the page, which is the distinction ISS-810 defers. A route is not a shortfall. docs/cli/the-ladder.md. */
export const laneOf = ({ status, fields }) => {
  const at = ORDER.indexOf(status);
  if (at < 0) return { aside: status, rows: [] };
  return {
    aside: null,
    rung: rungOf(fields),
    rows: ORDER.slice(at).map((one) => {
      const earns = CITED[one] ?? [];
      const dropped = lighterRows(one, fields).map((row) => row.kind);
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

/* One line per waiver, and the phase named once however many there are: a phase repeated down the column reads as a phase owed twice, and this list is what a run acts on (ISS-1066). */
const OWED = "owed     ";
const owedLines = (one) => {
  if (!one.waivers.length) return [`${OWED}${one.phase}`];
  const lead = `${OWED}${one.phase}  —  `;
  return one.waivers.map((held, at) =>
    `${at ? " ".repeat(lead.length) : lead}without ${held.drops}; ${held.because}`);
};

export const indexLines = (slug, ref, index) => [
  `${slug} for ${ref} — ${index.first ? `phase owed: ${index.first}` : "no phase owed"}`
    + `${index.aside ? ` (${index.aside}, which is off the ladder's linear path)` : ""}`,
  READ_OFF_THE_RECORD,
  "",
  ...index.passed.filter((one) => one.cites).map((one) => `passed   ${one.phase}  —  ${one.cites}`),
  ...index.owed.flatMap(owedLines),
  "",
  `The phase itself: \`forge guide ${slug} <phase>\`.`,
];
