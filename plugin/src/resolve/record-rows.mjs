/* The kinds, the table `forge record -h` prints of them, and the help rendered from that table —
   each capped field's cap on the row of the field it caps, so a note is drafted against the number
   rather than learning it from the refusal (ISS-46). Beside the verb table, not in `flow/`, which
   is at its file limit. */
import { PARKS, FINDINGS, PLAN_SECTIONS, SECTIONS, SHAPES, TRIAGES } from "../flow/machine.mjs";
import { DECLARES } from "../tracker/rest.mjs";
import { OPEN_KEPT } from "../flow/worklog.mjs";
import { usageOf } from "./visibility.mjs";

export const KINDS = [...Object.keys(SHAPES), "note", "criteria", "plan", "report"];

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
  `  plan         ${withCap("<file.md>", caps.plan?.self).padEnd(VALUES)}`
    + "the plan itself, from a file a consult has read",
  `  criteria     ${withCap("<file.md>", caps.acceptanceCriteria?.self).padEnd(VALUES)}`
    + "numbered lines, from a file a consult has read",
  "  report       the latest record of each kind, the latest verdict per criterion, and what is owed",
];

/* The sections a typed plan owes, each as the question it answers, so a plan is written against the
   list rather than against the refusal. The heading is the section's whole name and nothing else on
   its line; a plan carrying none of them writes as the free text it is and `approved` says so. */
const PLAN_BLOCKS = [
  "The plan file is markdown, and a typed one carries these sections, each opened by a heading whose",
  "text is the name:",
  ...PLAN_SECTIONS.map((one) => `  ## ${one.name.padEnd(23)}${one.asks}`),
  "The way back is owed only where the plan declares schema coupling or deploy coupling. Every",
  "numbered step under Steps names what it serves as `criteria: 3` or `criteria: 3, 4`, and a step",
  "naming none is refused here. At `approved`, where the criteria field is read, so is a step whose",
  "numbers name no criterion the issue holds, and a criterion no step names.",
];

const CRITERION_BLOCKS = [
  "--criterion repeats: each one opens a block, and one write carries a verdict on every criterion",
  "it names. What stands before the first --criterion is every block's, so one commit and one",
  "evidence set cover them all. A block's own value of a flag taking one replaces the shared one; a",
  "repeatable flag adds to it, so a criterion whose evidence is its own cites that too:",
  "  record verdict ISS-45 --commit <sha> --evidence run.txt --verdict pass \\",
  "    --criterion 1 --criterion 2 --criterion 3 --verdict fail --why \"<what failed>\"",
  "A file two criteria cite goes up once, under the one name both of them carry. Each block reads",
  "back as the record a single write makes, so nothing downstream can tell one write from three.",
];

export const usage = (caps = {}) => {
  const rows = kindRows(caps);
  return [
    usageOf("record"),
    "A contract payload, written in the one shape the CLI owns and read back by kind. A missing field",
    "is refused by name; the last line of every record names its kind and the contract version.",
    "",
    ...rows,
    "",
    ...(rows.some((row) => HAS_CAP.test(row)) ? [...CAP_LEGEND, ""] : []),
    ...CRITERION_BLOCKS,
    "",
    "  --next <line>   on any kind that writes: the step whoever comes next starts on, onto the lease",
    "  --pushed        the branch, head, base and files touched, read from git at this moment",
    "  --review        the last codex consult, its findings and what it owes, read from the log now",
    `  --open <line>   a scratch decision or a dead end, appended; past ${OPEN_KEPT} the oldest is dropped`,
    "",
    "Every write ends on stderr with the line `forge advance --owed` would print for the issue at that",
    "moment: the next status and how much it is owed, or the status the record earns.",
    "",
    "Evidence is an attachment name on the issue, a URL, a commit of 7 to 40 hex digits, or a path to",
    "a readable file, which goes up under its base name and is cited by it. A name already attached is",
    "refused rather than attached twice.",
    "",
    `The tracker types a file by its name and takes ${DECLARES.forge_uploads.extensions.join(" ")}.`,
    "That set is this CLI's reading of the tracker's rather than the tracker's own answer, so one",
    "missing from it may work too — and every path on a write is minted before any bytes go, so a",
    "name it will not take costs no upload.",
    "",
    "--commit and --evidence are read off the record where the flag is absent: the commit from the",
    "merged mark's note, the evidence from what the latest record of this kind cited. Each is printed.",
  ].join("\n");
};

/* The rows with no cap on them, for the readers asking which flags exist rather than what a field
   takes: the route check `forge -h` answers to, and the kind table's own test. */
export const USAGE = usage();

const rowFor = (kind, caps) => kindRows(caps).find((row) => new RegExp(`^ {2}${kind}\\b`, "u").test(row));

export const kindHelp = (kind, caps = {}) => {
  const row = rowFor(kind, caps) ?? `  ${kind}`;
  return [
    usageOf("record").replace("<kind>", kind),
    "",
    row,
    ...(HAS_CAP.test(row) ? ["", ...CAP_LEGEND] : []),
    ...(kind === "plan" ? ["", ...PLAN_BLOCKS] : []),
    ...(SHAPES[kind]?.per ? ["", ...CRITERION_BLOCKS] : []),
    "",
    "The flags every writing kind also takes, what counts as evidence, and the other "
      + `${KINDS.length - 1} kinds: \`forge record -h\`.`,
  ].join("\n");
};
