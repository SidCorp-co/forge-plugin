/* The kinds, the table `forge record -h` prints of them, and the help rendered from that table —
   each capped field's cap on the row of the field it caps, so a note is drafted against the number
   rather than learning it from the refusal (ISS-46). */
import { FIELD_KINDS, PARKS, FINDINGS, PLAN_SECTIONS, SECTIONS, SHAPES, TRIAGES, VERDICTS,
  sectionOwedBy } from "../machine.mjs";
import { EARNED } from "./corrections/superseding.mjs";
import { CLAUSES, NOTHING } from "./judged/merged-clauses.mjs";
import { citationBlocks } from "../../spec/checked.mjs";
import { DECISION_PARTS, commitTakes } from "./content.mjs";
import { goalBlock } from "../../goals.mjs";
import { OPEN_KEPT } from "../worklog.mjs";
import { usageOf } from "../../resolve/visibility.mjs";
import { proseHelp } from "./prose-route.mjs";
import { bodyCap } from "../../tracker/comment-cap.mjs";
import { flowPinned, screensHere } from "../../guides/flow.mjs";

/* The shapes a verb writes, then the four the verb prepares by another route: three of them write a
   field of the issue and the fourth hangs the tracker's own mark. A `verbless` shape is read back
   and written by no verb, so it is no kind this verb takes. */
export const KINDS = [...Object.keys(SHAPES).filter((kind) => !SHAPES[kind].verbless), ...FIELD_KINDS];

const withCap = (value, cap) => (typeof cap === "number" ? `${value}(${cap})` : value);

const HAS_CAP = /\(\d+\)/u;

const CAP_LEGEND = [
  "A number in parentheses after a value is that field's cap in code points. A write over one is",
  "refused before the field's payload is sent.",
];

/* Wide enough for the criteria row carrying its cap, so the descriptions align either way. */
const VALUES = 19;

/* The row carries the flag where the table gives the kind the field, so a second kind growing it gets the row as well as the help block below. */
const servesOn = (kind) => (SERVES_KINDS.includes(kind) ? "  [--serves G]" : "");

const kindRows = (caps) => [
  "  confirmation --is I --where W... --finding F [--detail D] [--fixed X --survives S] [--landed L]   F: " + FINDINGS.join("|"),
  `  decision     --decision "${DECISION_PARTS.join(" | ")}"... | --none <why>` + servesOn("decision"),
  "  question     --reading \"reading -> outcome\" (two or more) [--to who]",
  "  answer       --from F --quoted Q                              a person's answer to a park, relayed",
  "  park         --kind K --why W [--evidence E]...             K: " + PARKS.join("|"),
  "  correction   --moved M --why W --corrects K                   K: the record or issue field it corrects",
  "  baseline     --gate G --result R --commit C --scope whole|part [--cited W]",
  "  verdict      --criterion N --verdict " + VERDICTS.join("|") + " --commit C|--landing L --evidence E... [--why W] [--filed R]",
  "  review       --reviewer R --commit C|--landing L --outcome approved|changes-requested [--finding F]...",
  "  routed       --what W --to T [--evidence E]... | --none <why>   a finding this run sent elsewhere",
  "  declined     --finding H --why W                              a folded finding this run will not fix here",
  "  gap          --where W --lacked L --did D | --none <why>       where the method did not answer",
  "  verification --where W --commit C --evidence E... [--contains C] | --where W --landing L --evidence E...",
  "  migration    --reaches R --statement \"S | additive|tightening|destructive\"... [--evidence E]...",
  "  wave         --member K... --role R --session S [--tree T]     one dispatch, on the wave's headline",
  "  fold         --summary S                                      the wave's end, once its fold is posted",
  "  finding      --expected E --seen S [--evidence E]... [--quoted Q] [--criterion N | --uc UC-nn-m]",
  "  triage       --outcome O --would-have-caught W [--detail D]  O: " + TRIAGES.join("|"),
  "  merged       " + CLAUSES.map((one) => (one.read ? `[--${one.flag} V]` : `--${one.flag} V`)).join(" ") + " [--to B] | --undo | --landing L",
  "  note         --section S --user " + withCap("T", caps.releaseNotes?.halves?.userFacing)
    + " [--technical " + withCap("T", caps.releaseNotes?.halves?.technical)
    + "] | --skip --why W   S: " + SECTIONS.join("|"),
  `  plan         ${withCap("<file.md>", caps.plan?.self).padEnd(VALUES)}${KIND_PHRASE.plan}`,
  `  criteria     ${withCap("<file.md>", caps.acceptanceCriteria?.self).padEnd(VALUES)}`
    + "numbered lines, from a file a consult has read  [--replace]",
];

/* What each kind is for, one phrase each, because `forge record -h` is the list of kinds and a
   kind's own flags are `forge record <kind> -h`'s: a table of eighteen rows carrying every flag of
   every kind is read by nobody looking for one of them. */
const KIND_PHRASE = {
  confirmation: "what the issue is, where you looked, and the finding",
  decision: "the reading taken, its assumption and the line that undoes it",
  question: "the readings a person chooses between, as outcomes",
  answer: "a person's answer to a park, and who gave it",
  park: "the issue set down, its kind saying who it waits on",
  correction: "what moved in which record, and why",
  baseline: "the gate, what it reports, its commit, and a citation's source",
  verdict: "one criterion judged, at a commit, citing its own evidence",
  review: "who read which head, each finding answered, and the outcome",
  routed: "a finding this run sent to the issue that owns it",
  declined: "a folded finding not fixed here, and why",
  gap: "where the method did not answer, and what the run did instead",
  verification: "the change read where it now runs, with the evidence",
  migration: "each schema statement and its risk class",
  finding: "expected, seen, and the evidence or the quote",
  triage: "a reopen judged: which of three, and what would have caught it",
  merged: "the tracker's own mark, its note in five clauses",
  note: "the release note, in the words of whoever filed the issue",
  wave: "one dispatch of a wave, on its headline issue",
  fold: "the end of that wave, once its fold is posted",
  plan: "the plan itself, from a file a consult has read",
  criteria: "the numbered criteria, from a file a consult has read",
};

/* `forge record -h`'s own list, ordered by what a run reads it a second time to find rather than by
   the shape table's order: `criteria` and `plan` are written from their own dedicated help and are
   never what a mid-run lookup here is chasing, so they sit last; `routed`, `verdict`, `correction`
   and `review` are what a long run comes back for most (ISS-2028's reading of the transcript corpus).
   A kind absent from here would be a kind `forge record -h` no longer lists, so the row order is
   checked against `KINDS` as a set rather than trusted by eye. */
export const DISPLAY_ORDER = ["routed", "verdict", "correction", "review", "verification", "gap",
  "migration", "note", "declined", "finding", "triage", "confirmation", "merged", "park", "answer", "baseline",
  "decision", "question", "wave", "fold", "plan", "criteria"];

const phraseRows = () =>
  DISPLAY_ORDER.map((kind) => `  ${kind.padEnd(13)}${KIND_PHRASE[kind] ?? ""}`);

/* Read off the flag the assembly reads, so a kind flagged later says so here without being typed
   in a second list: the contract and `forge resume -h` both point at this line for the answer. */
const REPEATS = KINDS.filter((kind) => SHAPES[kind]?.repeats);

/* The sections a typed plan owes, each as the question it answers, so a plan is written against the list rather than against the refusal. The heading is the section's whole name and nothing else on its line; a plan carrying none of them writes as the free text it is and `approved` says so. Every section a declaration stands behind says so on a line of its own, read off the table, so one added there is not a sentence here to hand-edit. */
const declaringIt = (one) => sectionOwedBy(one.name, Object.fromEntries(one.owed.map((key) => [key, "yes"]))).join(" or ");
const conditionOn = (one) => (one.screens
  ? [`${one.name} is owed of every plan where this project's flow serves projects with a screen,`,
    `and at \`approved\` where the plan declares ${declaringIt(one)}.`]
  : [`${one.name} is owed only where the plan declares ${declaringIt(one)}.`]);

const PLAN_BLOCKS = [
  "The plan file is markdown, and a typed one carries these sections, each opened by a heading whose",
  "text is the name:",
  ...PLAN_SECTIONS.map((one) => `  ## ${one.name.padEnd(23)}${one.asks}`),
  ...PLAN_SECTIONS.filter((one) => one.owed).flatMap(conditionOn),
  "Every numbered step under Steps names what it serves as `criteria: 3` or `criteria: 3, 4`, and a",
  "step naming none is refused here. At `approved`, where the criteria field is read, so is a step",
  "whose numbers name no criterion the issue holds, and a criterion no step names.",
];

/* This project's own answer to the screen question, printed where the file is written against rather than learned from the refusal after a consult has read it (ISS-1895). */
const screensBlocks = () => {
  const pin = flowPinned();
  const screens = screensHere(pin);
  if (screens === null) {
    return ["This project chose no flow, so nothing here says whether its projects have a screen: a",
      "plan declaring screen change is written, and owes Witnessed on screen like any plan declaring it."];
  }
  return screens
    ? [`This project's flow, ${pin.value}, set in ${pin.from}, serves projects with a screen, so every`,
      "plan here owes Witnessed on screen."]
    : [`This project's flow, ${pin.value}, set in ${pin.from}, serves projects with no screen, so a plan`,
      "declaring screen change is refused here."];
};

/* The success line echoes what was sent, which reads the same for an append and a replace, so each
   of the two says which one it is before a caller has to learn it from a read-back (ISS-1444). */
const WHOLE_BLOCKS = {
  criteria: [
    "The write replaces the whole set the field holds and never adds to it. One that leaves out a",
    "number the field holds, or whose set does not open at 1, is refused naming both counts and the",
    "numbers it would drop: send every criterion the issue is to hold, or pass --replace to write",
    "the set as it stands. Every write says on stderr how many criteria the field held and holds now.",
  ],
  plan: [
    "The write replaces the whole plan the field holds, and says on stderr how many lines the field",
    "held and holds now.",
  ],
};

/* The two kinds whose file is written from what a consult read, which is why the citation belongs on their help and not only in the entry check's refusal: by the refusal the consult has been spent. */
const CITES = ["plan", "criteria"];

/* The one place the note's clauses are described, from the same table that writes and reads them:
   a template a run copied by hand is how a sha reached the slot another clause is read from. */
const MERGED_BLOCKS = [
  "The mark's note is one sentence and each flag writes one clause of it. Every clause is owed but",
  "the ones read from git unless given, and a write missing any names all of them at once rather",
  "than one per round:",
  ...CLAUSES.flatMap((one) => [`  --${one.flag.padEnd(10)}${one.label}`,
    ...(one.read ? [`  ${"".padEnd(12)}read from git unless given`] : [])]),
  "A clause read from git and given anyway is compared with git's reading, and a write whose value",
  "differs is refused naming that reading.",
  `A path clause takes paths separated by commas, or the word \`${NOTHING}\`, which reads back as`,
  "none rather than as silence. --to is the branch the change landed on, read from this project's",
  "base branch where it is not given. --undo removes the mark whole, prints the note it removed and",
  "takes no clause beside it: a clause is written by the mark and not by its removal.",
  "Where the tracker says the issue lands outside git (its `landingShape` is `outside_git`), the mark",
  "is --landing alone: where the change now is — a URL, a CMS entry, a store resource — sent as the",
  "tracker's own landing, one line of at most 2000 code points and never a value shaped like a sha.",
  "Every clause above and --to are refused there, and --landing is refused on an issue landing in git.",
  ...CLAUSES.filter((one) => one.none).flatMap((one) => [
    `--${one.flag} also takes the word \`${NOTHING}\`, where ${one.none}: the note says so in`,
    "words, every reader of the clause takes it for no head, and `landing moved` is read between",
    "--reviewed and --at. The word is refused where the page carries a verdict.",
  ]),
];

/* What each value records. The set is four because the outcomes are: only `skipped` says nobody
   reached the criterion, which is why it alone owes no evidence, and a reader who cannot tell it
   from a shortfall somebody released on purpose can count neither (ISS-1875). */
const VERDICT_BLOCKS = [
  "What each value records:",
  "  pass     the criterion was met as it is written",
  "  fail     it was exercised and not met, and the shortfall holds the rung until it is answered",
  "  short    it was exercised, met short of its wording, and the shortfall judged not to block:",
  "           the change releases, --why says how it fell short, --filed names the row it became",
  "  skipped  no route reached it, so nobody looked and there is nothing to cite",
  "That row's reference goes on --filed, never a sentence, and on no other value.",
  "A later --commit carrying the merged one earns `testing`: the write records what git says of it.",
];

/* The cap beside the one-write rule, since the rule is what steers a long verdict into one comment.
   Read when the help is, the reader importing the tracker's writer (ISS-489, ISS-652). */
const capBlocks = (cap = bodyCap()) => (cap === null ? [] : [
  `A write whose comment is over ${cap} code points is refused before any file goes up, naming the`,
  "writes to split it into.",
]);

const CRITERION_BLOCKS = [
  "--criterion repeats: each one opens a block, and one write judges every criterion it names.",
  "What stands before the first --criterion is every block's: a block's own value replaces it, and a",
  "repeatable flag adds to it. A flag that part names is restated only in the last block, which no",
  "block follows to be read as; in any other block it is refused. Restated last, it is taken:",
  "  record verdict ISS-45 --commit <sha> --evidence run.txt --verdict pass \\",
  "    --criterion 1 --criterion 2 --criterion 3 --verdict fail --why \"<what failed>\"",
  "A file two criteria cite goes up once. Each block reads back as the record a single write makes.",
];

/** Which kinds carry a `Serves:`, off the table that gives them the field: one derivation, so a second kind growing it is a row in `SHAPES` and nothing typed anywhere. */
export const SERVES_KINDS = Object.entries(SHAPES)
  .filter(([, shape]) => shape.fields.some((one) => one.flag === "serves"))
  .map(([kind]) => kind);

const servesBlocks = (goals) => (goals
  ? goalBlock(goals, `A \`${SERVES_KINDS.join("` or a `")}\` record`)
  : []);

/* This and each sentence under it go to the kinds whose own shape carries the field: one predicate
   over both field types promised five kinds a flag their parse refuses (ISS-835). */
const EVIDENCE_BLOCKS = [
  "Evidence is an attachment name on the issue, a URL, a commit of 7 to 40 hex digits, or a path to",
  "a readable file, which goes up under its base name and is cited by it. A name already attached is",
  "refused rather than attached twice. A file whose bytes are text goes up as text whatever its name,",
  "any other under the type its extension names, and the tracker judges the bytes. A file it refuses",
  "leaves the rest going up and no record written, and the refusal names the types the tracker takes.",
];

/** The field a deferred fill reads, the first of its type: `verification` declares two commit-typed fields, the fill reads the first, and the second is promised nothing. */
const filled = (kind, type) => SHAPES[kind]?.fields.find((one) => one[type]) ?? null;

/* What a commit-typed field the fill does not read takes, off the field itself: `readsOff` below promises the first one a read and says nothing of the others, so `verification`'s `--contains` was described nowhere but in the refusal a caller got for guessing (ISS-833). */
const alsoCommit = (kind) => (SHAPES[kind]?.fields ?? [])
  .filter((one) => one.commit)
  .slice(1)
  .map((one) => `--${one.flag} takes ${commitTakes(one)}.`);

/* Off the field itself and in the words its own rule refuses against, which is where the reason for
   printing it at all is written. A row spells which flags a kind takes; this spells what one of
   them will take. */
const formsTaken = (kind) => (SHAPES[kind]?.fields ?? [])
  .filter((one) => one.form)
  .map((one) => `--${one.flag} takes ${one.form}.`);

/* The fields declaring `onePer`, and its unit: machine.mjs says what the declaration means. */
const onePerOf = (kind) => {
  const fields = (SHAPES[kind]?.fields ?? []).filter((one) => one.onePer);
  return fields.length ? { fields, unit: fields[0].onePer } : null;
};

const flagList = (fields) => {
  const named = fields.map((one) => `--${one.flag}`);
  return named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)}` : named[0];
};

const onePerBlocks = (kind) => {
  const declared = onePerOf(kind);
  if (!declared) return [];
  const { fields, unit } = declared;
  return [`One record carries one ${unit}: ${flagList(fields)} take${fields.length > 1 ? "" : "s"} one value each,`,
    `so several ${unit}s are several calls.`];
};

/** What a repeated one-per-record flag is answered with, keyed by flag for the parser: the call that
 *  records the next one, since asking for the one meant would lose the rest. Empty for a kind that
 *  declares none, so the parser's own route stands. */
export const onePerRoutes = (kind, reference = "<ref>") => {
  const declared = onePerOf(kind);
  if (!declared) return {};
  const { fields, unit } = declared;
  const call = `forge record ${kind} ${reference} `
    + fields.map((one) => `--${one.flag} <${one.label.toLowerCase()}>`).join(" ");
  const route = `One ${kind} record carries one ${unit}, so write one per ${unit}:\n  ${call}`;
  return Object.fromEntries(fields.map((one) => [`--${one.flag}`, route]));
};

/* One sentence per fill, under that fill's own condition: an evidence field nothing owes, `routed`'s, is never filled and is promised no read. */
const readsOff = (kind) => {
  const commit = filled(kind, "commit");
  const evidence = filled(kind, "evidence");
  const reads = evidence && ((evidence.least ?? 1) >= 1 || Boolean(evidence.owed));
  const said = [
    ...(commit && filled(kind, "landing")
      ? [`--${commit.flag}, or --landing outside git, is read off the mark where absent.`]
      : []),
    ...(commit && !filled(kind, "landing")
      ? [`--${commit.flag} is read off the merged mark's note where the flag is absent.`]
      : []),
    ...(reads
      ? [`--${evidence.flag} is read off what the latest record of this kind cited where the flag is`,
        `absent${evidence.owed ? " and this record owes one" : ""}.`]
      : []),
  ];
  return said.length ? ["", ...said, "Every value read that way is printed."] : [];
};

/* Why the kind exists is the one thing its row cannot say, and a run reaching for a comment instead
   is the defect it answers (ISS-198). */
const ANSWER_BLOCKS = [
  "Written after the park it answers, on an issue that park holds at waiting or needs_info, or at",
  "on_hold under a blocked park no edge that gates dispatch speaks for — a blocker in another",
  "project, or an edge never recorded or since removed — and refused anywhere else. --from names who",
  "gave the answer and --quoted is what they said. It is how a person's answer reaches the record",
  "through a run: a comment on the parker's own credential answers nothing, whoever composed it. The",
  "write resumes the issue where the park left it, in the same call.",
];

/* The one place a park record would contradict the status it stands beside, which the row cannot
   say (ISS-1750). */
const PARK_BLOCKS = [
  "This write moves no status, so it is refused on an issue at closed or dropped, which say nobody is",
  "waited on. There, `forge advance <ref> --park <kind> --why W` writes the same record and moves the",
  "status into the one the kind names, and the refusal prints that command with this call's values.",
];

/* Why the two are a finder's writes is what their rows cannot say, and a dispatcher reading only the
   row would expect the lease every other kind takes (ISS-818). */
const WAVE_BLOCKS = [
  "A wave is the dispatch records after the latest fold on its headline issue; `forge resume` on",
  "that issue prints it, each member's status and lease read live. Both kinds are a finder's",
  "writes: they renew the writer's own lease and take none, so the headline may be free or held",
  "by a run the wave dispatched. Each is written alone, so --also and the flags below that write",
  "the lease are refused beside it, and each is refused on an issue at waiting or needs_info, where",
  "the tracker reads a comment as the reply to its park. A fold with no dispatch after the last",
  "fold closes nothing and is refused.",
];

const SHARED_FLAGS = [
  "  --also <kind>   another kind of this rung, its payload after it; the set moves the status",
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
  "These kinds add to the issue, and the report lists each, oldest first, under a count:",
  `  ${REPEATS.join(", ")}`,
  `Every other kind is latest-wins, an earned ${Object.keys(EARNED).join(", ")} only after a correction.`,
  "",
  ...SHARED_FLAGS,
  "",
  "Every write ends on stderr with what `forge advance --owed` would then print.",
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

export const kindHelp = (kind, caps = {}, goals = null, cites = citationBlocks()) => {
  const row = rowFor(kind, caps) ?? `  ${kind}`;
  return [
    usageOf("record").replace("<kind>", kind),
    KIND_PHRASE[kind] ? `${KIND_PHRASE[kind][0].toUpperCase()}${KIND_PHRASE[kind].slice(1)}.` : "",
    "",
    row,
    ...(onePerBlocks(kind).length ? ["", ...onePerBlocks(kind)] : []),
    ...(HAS_CAP.test(row) ? ["", ...CAP_LEGEND] : []),
    ...(WHOLE_BLOCKS[kind] ? ["", ...WHOLE_BLOCKS[kind]] : []),
    ...(kind === "plan" ? ["", ...PLAN_BLOCKS, ...screensBlocks()] : []),
    ...(CITES.includes(kind) && cites.length ? ["", ...cites] : []),
    ...(kind === "merged" ? ["", ...MERGED_BLOCKS] : []),
    ...(goals && SERVES_KINDS.includes(kind) ? ["", ...servesBlocks(goals)] : []),
    ...(kind === "verdict" ? ["", ...VERDICT_BLOCKS] : []),
    ...(kind === "answer" ? ["", ...ANSWER_BLOCKS] : []),
    ...(kind === "park" ? ["", ...PARK_BLOCKS] : []),
    ...(SHAPES[kind]?.finder ? ["", ...WAVE_BLOCKS] : []),
    ...(SHAPES[kind]?.per ? ["", ...CRITERION_BLOCKS, ...capBlocks()] : []),
    ...(filled(kind, "evidence") ? ["", ...EVIDENCE_BLOCKS] : []),
    ...(alsoCommit(kind).length ? ["", ...alsoCommit(kind)] : []),
    ...(formsTaken(kind).length ? ["", ...formsTaken(kind)] : []),
    ...(proseHelp(kind).length ? ["", ...proseHelp(kind)] : []),
    ...readsOff(kind),
    "",
    `The flags every writing kind also takes, and the other ${KINDS.length - 1} kinds: \`forge record -h\`.`,
  ].join("\n");
};
