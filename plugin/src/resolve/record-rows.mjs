/* The kind table `forge record -h` prints, each capped field's cap on the row of the field it caps:
   a note is drafted against that number, and one learned from the refusal is learned after the
   prose (ISS-46). Beside the verb table, not in `flow/`, which is at its file limit. */
import { PARKS, FINDINGS, SECTIONS, TRIAGES } from "../flow/machine.mjs";

const withCap = (value, cap) => (typeof cap === "number" ? `${value}(${cap})` : value);

export const HAS_CAP = /\(\d+\)/u;

export const CAP_LEGEND = [
  "A number in parentheses after a value is that field's cap in code points. A write over one is",
  "refused before the field's payload is sent.",
];

/* Wide enough for the criteria row carrying its cap, so the descriptions align either way. */
const VALUES = 19;

export const kindRows = (caps) => [
  "  confirmation --where W... --is I --finding F [--detail D]   F: " + FINDINGS.join("|"),
  "  decision     --decision \"reading | assumption | undo\"... | --none <why>",
  "  question     --reading \"reading -> outcome\" (two or more) [--to who]",
  "  park         --kind K --why W [--evidence E]...             K: " + PARKS.join("|"),
  "  correction   --moved M --why W                                a plan or criteria change after approval",
  "  baseline     --gate G --result R --commit C --scope whole|part",
  "  verdict      --criterion N --verdict pass|fail|skipped --commit C --evidence E... [--why W]",
  "  review       --reviewer R --commit C --outcome approved|changes-requested [--finding \"F1 accepted\"]...",
  "  routed       --what W --to T [--evidence E]... | --none <why>   a finding this run sent elsewhere",
  "  gap          --where W --lacked L --did D | --none <why>       where the method did not answer",
  "  verification --where W --commit C --evidence E...",
  "  finding      --expected E --seen S --evidence E... --quoted Q [--criterion N | --uc UC-nn-m]",
  "  triage       --outcome O --would-have-caught W [--detail D]  O: " + TRIAGES.join("|"),
  "  note         --section S --user " + withCap("T", caps.releaseNotes?.halves?.userFacing)
    + " [--technical " + withCap("T", caps.releaseNotes?.halves?.technical)
    + "] | --skip --why W   S: " + SECTIONS.join("|"),
  `  criteria     ${withCap("<file.md>", caps.acceptanceCriteria?.self).padEnd(VALUES)}`
    + "numbered lines, from a file a consult has read",
  "  report       the latest record of each kind, the latest verdict per criterion, and what is owed",
];
