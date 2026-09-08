/* The kinds, the table `forge record -h` prints of them, and the help rendered from that table —
   each capped field's cap on the row of the field it caps, so a note is drafted against the number
   rather than learning it from the refusal (ISS-46). Beside the verb table, not in `flow/`, which
   is at its file limit. */
import { PARKS, FINDINGS, PLAN_SECTIONS, SECTIONS, SHAPES, TRIAGES,
  sectionOwedBy } from "../flow/machine.mjs";
import { CLAUSES, NOTHING } from "../flow/record/merged.mjs";
import { declaredFor } from "../tracker/rpc.mjs";
import { goalBlock } from "../goals.mjs";
import { OPEN_KEPT } from "../flow/worklog.mjs";
import { usageOf } from "./visibility.mjs";

/* The shapes, then the kinds whose payload is a field or the tracker's own mark rather than a
   comment: each of those four has a route of its own in `record.mjs`. */
export const KINDS = [...Object.keys(SHAPES), "merged", "note", "criteria", "plan"];

const withCap = (value, cap) => (typeof cap === "number" ? `${value}(${cap})` : value);

export const HAS_CAP = /\(\d+\)/u;

export const CAP_LEGEND = [
  "A number in parentheses after a value is that field's cap in code points. A write over one is",
  "refused before the field's payload is sent.",
];

/* Wide enough for the criteria row carrying its cap, so the descriptions align either way. */
const VALUES = 19;

/* The row carries the flag where the table gives the kind the field, so a second kind growing it gets the row as well as the help block below. */
const servesOn = (kind) => (SERVES_KINDS.includes(kind) ? "  [--serves G]" : "");

export const kindRows = (caps) => [
  "  confirmation --where W... --is I --finding F [--detail D]   F: " + FINDINGS.join("|"),
  "  decision     --decision \"reading | assumption | undo\"... | --none <why>" + servesOn("decision"),
  "  question     --reading \"reading -> outcome\" (two or more) [--to who]",
  "  park         --kind K --why W [--evidence E]...             K: " + PARKS.join("|"),
  "  correction   --moved M --why W                                a plan or criteria change after approval",
  "  baseline     --gate G --result R --commit C --scope whole|part",
  "  verdict      --criterion N --verdict pass|fail|skipped --commit C --evidence E... [--why W]",
  "  review       --reviewer R --commit C --outcome approved|changes-requested [--finding \"F1 accepted\"]...",
  "  routed       --what W --to T [--evidence E]... | --none <why>   a finding this run sent elsewhere",
  "  gap          --where W --lacked L --did D | --none <why>       where the method did not answer",
  "  verification --where W --commit C --evidence E... [--contains C]",
  "  finding      --expected E --seen S --evidence E... --quoted Q [--criterion N | --uc UC-nn-m]",
  "  triage       --outcome O --would-have-caught W [--detail D]  O: " + TRIAGES.join("|"),
  "  merged       " + CLAUSES.map((one) => `--${one.flag} V`).join(" ") + " [--to B] | --undo",
  "  note         --section S --user " + withCap("T", caps.releaseNotes?.halves?.userFacing)
    + " [--technical " + withCap("T", caps.releaseNotes?.halves?.technical)
    + "] | --skip --why W   S: " + SECTIONS.join("|"),
  `  plan         ${withCap("<file.md>", caps.plan?.self).padEnd(VALUES)}${KIND_PHRASE.plan}`,
  `  criteria     ${withCap("<file.md>", caps.acceptanceCriteria?.self).padEnd(VALUES)}`
    + "numbered lines, from a file a consult has read",
];

/* What each kind is for, one phrase each, because `forge record -h` is the list of kinds and a
   kind's own flags are `forge record <kind> -h`'s: a table of eighteen rows carrying every flag of
   every kind is read by nobody looking for one of them. */
const KIND_PHRASE = {
  confirmation: "where you looked, what the issue is, and the finding",
  decision: "the reading taken, its assumption and the line that undoes it",
  question: "the readings a person is to choose between, as outcomes",
  park: "the issue set down, with the kind saying who it waits on",
  correction: "what moved in the plan or the criteria after approval, and why",
  baseline: "the gate, what it already reports, and the commit it ran at",
  verdict: "one criterion judged, at a commit, citing its own evidence",
  review: "who read which head, each finding answered, and the outcome",
  routed: "a finding this run sent to the issue that owns it",
  gap: "where the method did not answer, and what the run did instead",
  verification: "the change read where it now runs, with the evidence",
  finding: "what was expected, what was seen, and what it was quoted from",
  triage: "a reopen judged: which of the three it was, and what would have caught it",
  merged: "the tracker's own mark, its note built from the five clauses the next statuses read",
  note: "the release note, in the words of whoever filed the issue",
  plan: "the plan itself, from a file a consult has read",
  criteria: "the numbered criteria, from a file a consult has read",
};

const phraseRows = () =>
  KINDS.map((kind) => `  ${kind.padEnd(13)}${KIND_PHRASE[kind] ?? ""}`);

/* The sections a typed plan owes, each as the question it answers, so a plan is written against the list rather than against the refusal. The heading is the section's whole name and nothing else on its line; a plan carrying none of them writes as the free text it is and `approved` says so.
   The section a declaration puts a way back behind, and the declarations that do, are both off the table below, so a third one growing it is not a sentence here to hand-edit. */
const OWED_BY = PLAN_SECTIONS.find((one) => one.owed);
const TRIGGERS = sectionOwedBy(OWED_BY.name,
  Object.fromEntries(OWED_BY.owed.map((key) => [key, "yes"])));

const PLAN_BLOCKS = [
  "The plan file is markdown, and a typed one carries these sections, each opened by a heading whose",
  "text is the name:",
  ...PLAN_SECTIONS.map((one) => `  ## ${one.name.padEnd(23)}${one.asks}`),
  `${OWED_BY.name} is owed only where the plan declares ${TRIGGERS.join(" or ")}. Every`,
  "numbered step under Steps names what it serves as `criteria: 3` or `criteria: 3, 4`, and a step",
  "naming none is refused here. At `approved`, where the criteria field is read, so is a step whose",
  "numbers name no criterion the issue holds, and a criterion no step names.",
];

/* The one place the note's clauses are described, from the same table that writes and reads them:
   a template a run copied by hand is how a sha reached the slot another clause is read from. */
const MERGED_BLOCKS = [
  "The mark's note is one sentence and each flag writes one clause of it. Every clause is owed, and",
  "a write missing any names all of them at once rather than one per round:",
  ...CLAUSES.map((one) => `  --${one.flag.padEnd(10)}${one.label}`),
  `A path clause takes paths separated by commas, or the word \`${NOTHING}\`, which reads back as`,
  "none rather than as silence. --to is the branch the change landed on, read from this project's",
  "base branch where it is not given. --undo removes the mark whole, prints the note it removed and",
  "takes no clause beside it: a clause is written by the mark and not by its removal.",
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

/** Which kinds carry a `Serves:`, off the table that gives them the field: one derivation, so a second kind growing it is a row in `SHAPES` and nothing typed anywhere. */
export const SERVES_KINDS = Object.entries(SHAPES)
  .filter(([, shape]) => shape.fields.some((one) => one.flag === "serves"))
  .map(([kind]) => kind);

const servesBlocks = (goals) => (goals
  ? goalBlock(goals, `A \`${SERVES_KINDS.join("` or a `")}\` record`)
  : []);

/* The evidence vocabulary sits under the kinds that cite evidence rather than over the whole list:
   a caller writing a verdict is the one who needs it, and `forge record -h` is not that call. */
const EVIDENCE_BLOCKS = [
  "Evidence is an attachment name on the issue, a URL, a commit of 7 to 40 hex digits, or a path to",
  "a readable file, which goes up under its base name and is cited by it. A name already attached is",
  `refused rather than attached twice. The tracker types a file by its name and takes`,
  `${declaredFor("forge_uploads", "extensions").join(" ")} — this CLI's reading of the tracker's set rather`,
  "than its answer, so one missing may work too, and no path costs an upload before it is minted.",
  "",
  "--commit and --evidence are read off the record where the flag is absent: the commit from the",
  "merged mark's note, the evidence from what the latest record of this kind cited. Each is printed.",
];

const CITES_EVIDENCE = (kind) =>
  Boolean(SHAPES[kind]?.fields.some((one) => one.evidence || one.commit));

const SHARED_FLAGS = [
  "  --next <line>   on any kind that writes: the step whoever comes next starts on, onto the lease",
  "  --pushed        the branch, head, base and files touched, read from git at this moment",
  "  --review        the last codex consult, its findings and what it owes, read from the log now",
  `  --open <line>   a scratch decision or a dead end, appended; past ${OPEN_KEPT} the oldest is dropped`,
];

export const usage = () => [
  usageOf("record"),
  "A contract payload, written in the one shape the CLI owns and read back by kind. A missing field",
  "is refused by name, and one kind's own flags are `forge record <kind> -h`.",
  "",
  ...phraseRows(),
  "",
  ...SHARED_FLAGS,
  "",
  "Every write ends on stderr with the line `forge advance --owed` would print for the issue at that",
  "moment: the next status and how much it is owed, or the status the record earns.",
].join("\n");

/* The rows with no cap on them, for the readers asking which flags exist rather than what a field
   takes: the route check `forge -h` answers to, and the kind table's own test. */
export const USAGE = usage();

const rowFor = (kind, caps) => kindRows(caps).find((row) => row.startsWith(`  ${kind} `));

/** What a kind's own `-h` opens with, which is the set its parse refuses a stranger against. Built
 *  once per kind: a record's parse asks for it at each of its three steps. */
const KIND_USAGE = new Map();
export const kindUsage = (kind) => {
  if (!KIND_USAGE.has(kind)) {
    KIND_USAGE.set(kind, [usageOf("record").replace("<kind>", kind), rowFor(kind, {}) ?? "", ...SHARED_FLAGS].join("\n"));
  }
  return KIND_USAGE.get(kind);
};

export const kindHelp = (kind, caps = {}, goals = null) => {
  const row = rowFor(kind, caps) ?? `  ${kind}`;
  return [
    usageOf("record").replace("<kind>", kind),
    KIND_PHRASE[kind] ? `${KIND_PHRASE[kind][0].toUpperCase()}${KIND_PHRASE[kind].slice(1)}.` : "",
    "",
    row,
    ...(HAS_CAP.test(row) ? ["", ...CAP_LEGEND] : []),
    ...(kind === "plan" ? ["", ...PLAN_BLOCKS] : []),
    ...(kind === "merged" ? ["", ...MERGED_BLOCKS] : []),
    ...(goals && SERVES_KINDS.includes(kind) ? ["", ...servesBlocks(goals)] : []),
    ...(SHAPES[kind]?.per ? ["", ...CRITERION_BLOCKS] : []),
    ...(CITES_EVIDENCE(kind) ? ["", ...EVIDENCE_BLOCKS] : []),
    "",
    `The flags every writing kind also takes, and the other ${KINDS.length - 1} kinds: \`forge record -h\`.`,
  ].join("\n");
};
