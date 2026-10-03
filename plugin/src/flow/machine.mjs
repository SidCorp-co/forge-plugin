/* A project whose configuration names a prose language has every body and prose field rewritten on
   the way out (tools/vi.mjs), and a rewrite renames prose, so a key travels in a form the rewrite copies byte for byte: a fenced block, or a code span. `content.mjs` and `machine/block.mjs`, the carrying of a record, are what is imported here, and neither imports this, so both sides can still import it. */
import { DECISION_TAKES, FINDING_TAKES, MEMBER_TAKES, RECOMMEND_TAKES, STATEMENT_TAKES, WHERE_TAKES, decisionProblem,
  findingProblem, memberProblem, recommendProblem, statementProblem, whereProblem } from "./record/content.mjs";
import { SPAN, blanked, fenceMarked } from "../prose.mjs";
import { MARKUP_PATTERN } from "../markdown.mjs";
import { entriesIn, firstKindIn } from "./machine/block.mjs";
import { heldOut } from "./machine/held.mjs";
import { JUDGED_COMMIT, JUDGED_LANDING, RUNTIME_TAKES, identityProblem, runtimeProblem } from "./machine/identity.mjs";

export { blockOf, readRecords, tagFor } from "./machine/block.mjs";

/** An ISO stamp to the minute, as every screen in this tree shows one; apart from `lease.mjs`'s and `stats/runs.mjs`'s, which take milliseconds. */
export const atMinute = (at) => String(at ?? "").slice(0, 16);

export const stampedIn = (body, kind, flag) => {
  if (firstKindIn(body) !== kind) return null;
  return entriesIn(body, SHAPES[kind]).entries.find(([key]) => key === flag)?.[1] ?? null;
};

/** A number or nothing: a caller keys a map by this, and `NaN` is a key nothing can supply. */
export const criterionNumber = (value) => {
  const found = /^\s*(\d+)/u.exec(String(value ?? ""));
  return found ? Number(found[1]) : null;
};


/* A trim: the fence is off before a field reaches here, so this goes with its callers (ISS-470). */
export const unwrap = (text) => String(text ?? "").trim();

/* Machine data in prose; every occurrence outside a code span decides, not the first (docs/cli/the-rung-in-text.md).
   `required` is which a plan must answer: the write and `approved` both read it here, so a declaration
   added to this table is enforced by being added to it (ISS-752). An optional row is one a plan may
   leave out, its absence reading `no`, because only a change of the kind `when` names has a reason to
   answer it; `nofile` is the change that lands nothing in the repository, which only a `yes` grants
   anything to, so an empty diff is never read as one (ISS-2384). */
const DECLARED = {
  screen: { name: "screen change", required: true },
  schema: { name: "schema coupling", required: true },
  deploy: { name: "deploy coupling", required: true },
  look: { name: "user-facing outcome", required: false, when: "where the change has one" },
  nofile: { name: "lands no file", required: false, when: "where the whole change lives outside this repository" },
};
const NAMES = Object.values(DECLARED).map((one) => one.name);
const required = Object.values(DECLARED).filter((one) => one.required);
const optional = Object.values(DECLARED).filter((one) => !one.required);
const DECLARATIONS_ASK = `each of ${required.map((one) => one.name).join(", ")}, written \`yes\` or \`no\``
  + optional.map((one) => `, and ${one.name} the same way ${one.when}`).join("");
/* Markup may stand at the joints — a bold label closing after its colon, or before it, or an emphasised
   value — and nowhere else. One pattern, so the reader and the protector below cannot disagree about
   which lines are declarations (ISS-312); the class is markdown.mjs's, never a second spelling. */
const MARKED = `(?:${MARKUP_PATTERN})*`;
const DECLARED_VALUE = `${MARKED}:(?:${MARKUP_PATTERN}|\\s)*(yes|no)\\b`;
const lineFor = (name) => new RegExp(`${name}${DECLARED_VALUE}`, "giu");

export const planFlags = (plan) => {
  const said = blanked(String(plan ?? ""), SPAN);
  return Object.fromEntries(Object.entries(DECLARED).map(([key, { name }]) => {
    const found = [...said.matchAll(lineFor(name))].map((one) => one[1].toLowerCase());
    return [key, found.includes("yes") ? "yes" : (found[0] ?? null)];
  }));
};

/** Which declaration asks for a person, beside the table it reads: FR-05 names two. */
export const looksTo = ({ screen, look }) =>
  (look === "yes" ? "a user-facing outcome" : (screen === "yes" ? "a screen change" : null));

/** Which park kind that person is asked for: a screen change is looked at on a screen, anything else wherever it is read. `SHOWS_EVIDENCE` holds both, so a project with no screen is asked for a look it can take. Read off the declaration and never the flow (ISS-902). */
export const looksIn = ({ screen }) => (screen === "yes" ? "screen-review" : "code-review");

/* The witnessed section's other answer, read by `witnessedOn` and held across a prose rewrite as the citations beside it are — one source for both, because a reader and a protector spelling one answer differently accept a plan they cannot hand back. It reaches from the line's own indent through whatever separates the word from the reading after it, so a rewrite that replaces that reading leaves the word standing alone rather than joined to it. */
const WITNESSED_NONE = "^[^\\S\\n]*none\\b[^\\p{L}\\p{N}\\n]*";

export const WITNESSED = "Witnessed on screen";

/* What a typed plan answers, one section per question: the name is the whole text of the heading that opens it, `owed` the declarations behind which the tree puts a section, `screens` what a flow whose projects have one asks for whichever way the plan declared — only the write reading that second one, under the rule `screensOf` carries.
   Presence is the whole of the check; whether a section answers well is the reviewer's. */
export const PLAN_SECTIONS = [
  { name: "Files touched", asks: "which files this change opens" },
  { name: "Before", asks: "what the code does today" },
  { name: "After", asks: "what it does once this lands" },
  { name: "Deliberately unchanged", asks: "what this change leaves alone on purpose" },
  { name: "Verified in code", asks: "the one thing read in the source that makes this possible" },
  { name: "Conventions reversed", asks: "which documented convention this reverses, and where the same change rewrites it" },
  { name: "Declarations", asks: DECLARATIONS_ASK },
  { name: WITNESSED, asks: "which criteria only a person at the running product can witness, by number, or `none` and the reading that makes it none", owed: ["screen"], screens: true },
  { name: "Steps", asks: "the ordered steps, each naming the criterion number it serves" },
  { name: "The way back", asks: "what triggers it, the steps, who is told", owed: ["schema", "deploy"] },
];

const PLAN_NAMES = PLAN_SECTIONS.map((one) => one.name).join("|");
const CANONICAL = new Map(PLAN_SECTIONS.map((one) => [one.name.toLowerCase(), one.name]));
/* One separator rule across the three, or the protector holds a line the section reader dropped. */
const HEADING = `^#{1,6}[ \\t]+(?:${PLAN_NAMES})[ \\t]*$`;
const ANY_HEADING = /^#{1,6}(?:[ \t]|$)/u;
const NAMED_HEADING = /^#{1,6}[ \t]+(.*?)[ \t]*$/u;
/* A step's criterion, over the raw plan and over a step whose wrapped lines are joined: a break the reader turned into a space is one the protector must hold. */
const citedList = (colon) => `criteri(?:on|a)[ \\t]*${colon}[ \\t\\r\\n]*\\d+(?:[ \\t]*,[ \\t\\r\\n]*\\d+)*`;
const CITED = citedList(":?");
const CITES = new RegExp(CITED, "giu");
/* The witnessed section's citation is the same list with its colon owed: a step is a sentence about
   the criterion it serves, while this section's prose often names one to say it is not witnessed, and
   that sentence must not join the set a person is asked to look at (ISS-2029). */
const WITNESS_CITED = citedList(":");
const WITNESS_CITES = new RegExp(WITNESS_CITED, "giu");
const WITNESS_CITE = new RegExp(WITNESS_CITED, "iu");
const NUMBERED_STEP = /^\s*(\d+)\.\s+(.*)$/u;

const sectionAt = (line) => {
  const found = NAMED_HEADING.exec(line);
  return found ? CANONICAL.get(found[1].toLowerCase()) ?? null : null;
};

/** The sections a plan carries by canonical name; a heading the table does not name closes the one above and opens none. */
export const planSections = (plan) => {
  const open = new Map();
  let held = null;
  for (const { line, fenced } of fenceMarked(plan)) {
    if (!fenced && ANY_HEADING.test(line)) {
      held = sectionAt(line);
      if (held) open.set(held, []);
      continue;
    }
    if (held) open.get(held).push(line);
  }
  return new Map([...open].map(([name, lines]) => [name, lines.join("\n").trim()]));
};

/** Typed once it carries one section; carrying none it is the free text `approved` calls untyped. */
export const planTyped = (plan) => planSections(plan).size > 0;

/** The `Steps` section's steps, each with the criterion numbers its lines cite. */
export const planSteps = (plan) => {
  const body = planSections(plan).get("Steps");
  if (body === undefined) return [];
  const out = [];
  for (const { line, fenced } of fenceMarked(body)) {
    if (fenced) continue;
    const found = NUMBERED_STEP.exec(line);
    if (found) out.push({ number: Number(found[1]), text: found[2].trim() });
    else if (out.length && line.trim()) out.at(-1).text += ` ${line.trim()}`;
  }
  const numbers = (text) => [...text.matchAll(CITES)].flatMap((one) => (one[0].match(/\d+/gu) ?? []).map(Number));
  return out.map((one) => ({ ...one, cites: [...new Set(numbers(one.text))].sort((a, b) => a - b) }));
};

const SAYS_NONE = new RegExp(WITNESSED_NONE, "iu");

/** What a plan says only a person at the running product can witness, and which way it answered — `cites` and `none` being the two, read off one reading by the write that refuses a file and by the status that reads the plan the issue stored, or a plan edited anywhere but here enters at a shape the write turns back. A number is cited only in the `criteria:` form, and `none` only where it opens the first paragraph that answers at all — so a restated question above the answer is not the answer, and `display: none` in a criterion it names, or a later paragraph opening `None of the others`, is prose. Both answers come back rather than one winning: a section giving neither and one giving both each leave a reader guessing, and only the caller that refuses them can say which happened. */
export const witnessedOn = (plan) => {
  const body = planSections(plan).get(WITNESSED);
  if (body === undefined) return null;
  const said = fenceMarked(body).filter((one) => !one.fenced).map((one) => one.line).join("\n");
  const cites = [...said.matchAll(WITNESS_CITES)].flatMap((one) => (one[0].match(/\d+/gu) ?? []).map(Number));
  const answers = said.split(/\n[^\S\n]*(?:\n|$)/u).map((one) => one.replace(/^(?:[^\S\n]*\n)+/u, ""))
    .find((one) => SAYS_NONE.test(one) || WITNESS_CITE.test(one)) ?? "";
  return { cites: [...new Set(cites)].sort((one, two) => one - two), none: SAYS_NONE.test(answers) };
};
export const witnessedAnswers = (witnessed) => [witnessed?.cites.length ? "cites" : null, witnessed?.none ? "none" : null].filter(Boolean);

/** The sections a typed plan is missing, the way back among them where a declaration owes one. */
export const sectionsOwed = (plan, flags = {}) => {
  const held = planSections(plan);
  return PLAN_SECTIONS
    .filter((one) => !one.owed || one.owed.some((key) => flags[key] === "yes"))
    .filter((one) => !held.has(one.name))
    .map((one) => one.name);
};

export const declaredAs = (keys) => keys.map((key) => DECLARED[key]?.name ?? key);

/** The required declarations a plan leaves unanswered, by key and in the table's order: the one reading
 *  the write and `approved` share, so a plan one accepts is never one the other refuses for a line. */
export const declarationsMissing = (flags = {}) =>
  Object.keys(DECLARED).filter((key) => DECLARED[key].required && !flags[key]);

/** A declaration as the line a plan writes to answer it: `Deploy coupling: yes|no`. */
export const declarationLine = (key) => {
  const name = DECLARED[key]?.name ?? key;
  return `${name[0].toUpperCase()}${name.slice(1)}: yes|no`;
};

export const sectionOwedBy = (name, flags = {}) =>
  declaredAs((PLAN_SECTIONS.find((one) => one.name === name)?.owed ?? [])
    .filter((key) => flags[key] === "yes"));

/** The steps that serve nothing: citing none, or none the given criteria hold — with none given, presence is the whole of it. Taking the steps and not the plan, because one caller judges both rules over one plan and reading it twice is the read twice. */
export const stepsUncited = (steps, criteria) => {
  const held = criteria?.length ? new Set(criteria.map((one) => one.number)) : null;
  return steps.filter((one) => (held
    ? !one.cites.some((number) => held.has(number))
    : !one.cites.length));
};

export const criteriaUncovered = (steps, criteria) => {
  const cited = new Set(steps.flatMap((one) => one.cites));
  return criteria.map((one) => one.number).filter((number) => !cited.has(number));
};

const MACHINE = {
  plan: new RegExp(
    `${HEADING}|(?:${NAMES.join("|")})${DECLARED_VALUE}|${CITED}|${WITNESSED_NONE}`,
    "gimu",
  ),
};
/** Held by the one pattern this field's declarations match: `machine/held.mjs` says how. */
export const protectMachine = (field, text, held = {}) => heldOut(MACHINE[field], text, held);
export { restoreMachine } from "./machine/held.mjs";

/* What a payload of each kind holds, in the one table the write, the read-back and the usage
   list all read: a field named in two places is a shape that disagrees with itself. The block it is
   written into is `machine/block.mjs`'s, which imports nothing from here, so either side may reach it. */
const CAUSE_FIXED = "cause-fixed";
const OWN_LANDING = "own-landing";
export const FINDINGS = ["holds", "already-fixed", "duplicate", "intended", "obsolete", "premise-false", "superseded", CAUSE_FIXED, OWN_LANDING];
/* The findings that end an issue without code, read by every reader that counts a disposition rather
   than each comparing with `holds`. Two keep the lane: a cause another change fixed with the stated
   deliverable still owed (ISS-406), and this issue's own change landed outside the flow with only its
   record owed, which `dropped` would erase (ISS-1693). `already-fixed` is another change's fix. */
export const DISPOSITIONS = FINDINGS.filter((one) => one !== FINDINGS[0] && one !== CAUSE_FIXED && one !== OWN_LANDING);
const FINDING_FORM = `one of ${FINDINGS.join(", ")}; already-fixed is another change's fix and drops the issue, and`
  + ` ${OWN_LANDING} is this issue's own change landed outside the flow with only its record owed, and keeps the lane`;
/* Each field one finding owes and no other finding takes: the finding, and what the field holds, said
   by the help and by the refusal alike. */
const OWED_BY = {
  fixed: { finding: CAUSE_FIXED, holds: "what was already fixed, and the evidence that settles it" },
  survives: { finding: CAUSE_FIXED, holds: "the deliverable still owed, and what will judge it" },
  landed: { finding: OWN_LANDING,
    holds: "the commit this issue's own change landed as, or where it now is where the issue lands outside git" },
};
const WHY_OWED = {
  [CAUSE_FIXED]: "names what was already fixed and what survives, and a run holding only one of the two is"
    + " choosing between the other findings",
  [OWN_LANDING]: "names the landing that carried this issue's own change, without which it reads as another"
    + " change's fix, which is already-fixed",
};
const halfForm = (flag) => `${OWED_BY[flag].holds}; owed under --finding ${OWED_BY[flag].finding} and refused beside any other finding`;
const owedFieldsProblem = (got) => {
  const flags = Object.keys(OWED_BY);
  const lacking = flags.filter((flag) => OWED_BY[flag].finding === got.finding && !String(got[flag] ?? "").trim());
  if (lacking.length) {
    return `${lacking.map((flag) => `--${flag} <${OWED_BY[flag].holds}>`).join(" and ")}: a ${got.finding} finding`
      + ` ${WHY_OWED[got.finding]}`;
  }
  const given = flags.filter((flag) => OWED_BY[flag].finding !== got.finding && got[flag] !== undefined);
  return given.length
    ? `no ${given.map((flag) => `--${flag}`).join(" or ")} beside --finding ${got.finding}: `
      + given.map((flag) => `--${flag} is read only under --finding ${OWED_BY[flag].finding}`).join(", ")
    : null;
};
/* The status `closed` is entered from. */
export const CLOSES_FROM = "awaiting_release";
export const PARKS = [
  "question", "screen-review", "destructive-migration", "rolled-back", "no-way-back",
  "unshippable", "blocked", "paused", "crashed", "release-decision", "code-review", "dropped",
];
/* The three parks that speak to a reviewer, who cannot answer without the thing to look at. One list, because the read-back judges a park a hand wrote by the same rule the write applies.
   The two of them that are a person's look answer it whichever kind was asked for, the kind saying where a person looked rather than whether they did. */
export const SHOWS_EVIDENCE = ["screen-review", "code-review", "destructive-migration"];
export const ANSWERS_LOOK = ["screen-review", "code-review"];
const FAIL = "fail";
export const SHORT = "short";
/* Four outcomes and not three: a criterion exercised, found short of its wording and judged not to
   block is a decision, where a `skipped` one is a gap in equipment, and a set that spells both the
   same way cannot be counted or chased either way (ISS-1875). */
export const VERDICTS = ["pass", FAIL, "skipped", SHORT];
/** Whether anybody exercised the criterion, which is the one question both evidence obligations
 *  answer to — the write's and the screen check's. Here rather than spelled at each, so a value
 *  added to the set cannot be exempt from one of them and not the other. */
export const somebodyLooked = (verdict) => verdict !== "skipped";
export const JUDGE_FROM = "judge-from";
const SCOPES = ["whole", "part"];

export { commandAt, missingLines, need } from "./machine/owed.mjs";
/* What the agent may rule a person's finding to be: the criterion asked the wrong thing, the
   criterion was not met, or nothing in the specification ever promised what the person expected. */
export const TRIAGES = ["wrong-test", "not-met", "not-in-spec"];
export const OUTCOMES = ["approved", "changes-requested"];
/* A finding's identifier is unique only inside the consult that raised it, and the method mandates
   several reads of one change, so one review holds several F1s sharing nothing but a number
   (ISS-1128). The leading token is that consult, which makes them rows that stand apart rather than
   a reader being told which of them by nothing at all; it is unconstrained, being the reviewer's own
   handle and not a shape this file gets to assume. What a finding line may say is the field's own
   rule and lives with the others of its sort in `record/content.mjs`. */
export const SECTIONS = ["Added", "Changed", "Fixed", "Removed", "Security"];

/* `many` flags repeat; `oneOf` names the values; `each` is the rule over every one of them and `form` the words it and the kind's own help both state, so a caller reads the grammar before composing rather than out of the refusal (ISS-457); `least` is the smallest count that is a payload; `newer` is asked for at the write and excused at the read-back, a shape's records outliving it; `prose` is a value made of sentences, which a blank and a route to its text are both refused at, and a field naming a place does not carry it (record/prose-route.mjs).
   `takes` is what a sentence about the field says it holds where the label cannot say it: the label is the read key of `labelledIn` in `machine/block.mjs`, so renaming one drops that field off every record already written in that form, and what a refusal has to say is longer than what a printed line wants (ISS-833). */
const FIELD = (flag, label, extra = {}) => ({ flag, label, ...extra });

/** Two verdict fields' keys, each spelt once for its writer, `record/judged/carried.mjs`, and its reader. */
export const CARRIES = "carries";
export const CARRIES_DEPLOYMENT = "carries-deployment";

/* The shape `decision` established: a kind whose honest answer may be *none* asks for every field or
   for the reason there is none, never half of one, so an absent record and an unasked question stop
   reading the same. Here rather than in the field loop, which cannot see one flag excusing three. */
const escapeOr = (got, wanted, said) => {
  if (got.none) {
    /* Every other flag of the shape, read off what was given rather than off `wanted`: an optional
       field left out of that list would be storable beside the answer saying there is nothing. */
    const also = Object.entries(got)
      .filter(([flag, value]) => flag !== "none" && (Array.isArray(value) ? value.length : value !== undefined))
      .map(([flag]) => `--${flag}`);
    return also.length
      ? `--none alone: it is the whole record, so ${also.join(" or ")} has no place beside it`
      : null;
  }
  const missing = wanted.filter((one) => got[one] === undefined);
  return missing.length
    ? `${missing.map((one) => `--${one}`).join(", ")}, or --none "<why>" when this run ${said}`
    : null;
};

/* When a kind owes evidence, answered once: the field says so for the deferred fill and the check
   refuses by the same answer, so a check that also refuses something else cannot be mistaken for
   this. A kind absent here owes none whatever its check says. */
const OWES = {
  park: (got) => SHOWS_EVIDENCE.includes(got.kind),
  verdict: (got) => somebodyLooked(got.verdict),
};

/* What the fourth value owes beyond the three: the reason it fell short, and the row the shortfall
   became. A `short` releases the change, so the record is the only place the observation survives —
   without the row it is a way to close one, which is what this value is not for. The row is a
   reference because a reader has to follow it; whitespace is how a sentence gets typed there. */
const shortProblem = (got) => {
  /* Emptied rather than absent is the same shortfall to a reader following it, and a record written
     by hand reaches this check as a written one does. */
  const filed = String(got.filed ?? "").trim();
  if (got.verdict !== SHORT) {
    return got.filed === undefined ? null
      : `--filed only on a \`${SHORT}\` verdict: it names the row a released shortfall became, and a \`${got.verdict}\` releases none`;
  }
  if (!got.why) return `--why, naming how the criterion fell short of its wording: a \`${SHORT}\` releases the change and the record says what it released`;
  if (!filed) return `--filed <the row this shortfall became>: a \`${SHORT}\` records that the observation went somewhere else and closes nothing`;
  if (/\s/u.test(filed)) return `--filed as the row's own reference, not a sentence: nobody reading \`${filed}\` can follow it`;
  return null;
};

/* A folded finding's name on the record: the head of its comment's id, unique among one issue's
   comments and short enough to type into a criterion. A whole id is taken and cut to it. */
export const HANDLE_LENGTH = 8;
const HANDLE_FORM = new RegExp(`^[0-9a-f]{${HANDLE_LENGTH}}(?:-[0-9a-f-]*)?$`, "iu");
export const handleOf = (id) => String(id ?? "").toLowerCase().slice(0, HANDLE_LENGTH);
const HANDLE_TAKES = `the finding's handle, the ${HANDLE_LENGTH} hex characters \`forge advance --owed\` names it by, or its comment's whole id`;

/* What a correction may name beyond the shapes: `FIELD_KINDS`, whose reason is given where `KINDS`
   joins them in record-rows.mjs. `issue` names a field of the issue itself that no record holds — its status, its
   complexity — which the CLI's own corrections move as often as they move a record. */
export const FIELD_KINDS = ["merged", "note", "criteria", "plan"];
const ISSUE_TARGET = "issue";
const CORRECTS_TAKES = "a record kind, or `issue:<field>` for a field of the issue no record holds, "
  + "either followed by `:<occasion>` where one record of the kind is meant — `plan`, `criteria:3`, "
  + "`issue:status`";
const OCCASION = /^[^\s:]+$/u;

/** Which kind a correction names, the occasion after it dropped: `criteria` for `criteria:3`. */
export const correctedKind = (corrects) => String(corrects ?? "").split(":")[0];

/* Worded to follow `needs`, as every shape's check is: the refusal reads `record correction needs …`. */
const correctsProblem = (value) => {
  const [target, ...rest] = String(value).split(":");
  const kinds = [...Object.keys(SHAPES).filter((kind) => !SHAPES[kind].verbless), ...FIELD_KINDS];
  /* `issue` owes the field it names before any occasion; a kind owes nothing after it. */
  const [field, ...after] = target === ISSUE_TARGET ? rest : [null, ...rest];
  const occasion = after.join(":");
  const known = target === ISSUE_TARGET || kinds.includes(target);
  const shaped = (field === null || OCCASION.test(field ?? "")) && (!after.length || /^\S+$/u.test(occasion));
  if (known && shaped) return null;
  return `--corrects as ${CORRECTS_TAKES}, not \`${value}\``
    + (known ? "" : `; the kinds are ${kinds.join(", ")}`);
};

/* The two grounds a finding stands on, said by the finding shape when it turns a write back. */
const ON_EITHER_GROUND = "--quoted \"<their words>\" where a person reported it, or --evidence "
  + "<attachment|url|sha> where this run saw it: a finding that quotes nobody and captured nothing "
  + "is an assertion nothing on the record stands behind";

export const SHAPES = {
  confirmation: {
    heading: "Confirmation",
    fields: [
      FIELD("is", "What it is", { prose: true }),
      FIELD("where", "Where looked", { many: true, each: whereProblem, form: WHERE_TAKES }),
      FIELD("finding", "Finding", { oneOf: FINDINGS, form: FINDING_FORM }),
      FIELD("detail", "Detail", { optional: true, prose: true }),
      FIELD("fixed", "What was already fixed", { optional: true, prose: true, form: halfForm("fixed") }),
      FIELD("survives", "What survives", { optional: true, prose: true, form: halfForm("survives") }),
      FIELD("landed", "Where it landed", { optional: true, landed: true, form: halfForm("landed") }),
      FIELD("rung", "Rung", { optional: true, derived: true }),
    ],
    check: owedFieldsProblem,
  },
  decision: {
    heading: "Decision record",
    fields: [FIELD("decision", "Decision", { many: true, least: 0, each: decisionProblem, form: DECISION_TAKES, prose: true }),
      FIELD("none", "None found", { optional: true, prose: true }), FIELD("serves", "Serves", { optional: true })],
    check: (got) => {
      if (!got.decision.length && !got.none) return "--decision (repeatable) or --none <why>";
      return null;
    },
  },
  /* The recommendation is the run's own, owed because the question it asks on the issue cannot be
     asked without one (docs/cli/record-question.md); `newer`, so a record from before it still reads. */
  question: {
    heading: "Question",
    fields: [FIELD("reading", "Reading", { many: true, least: 2, prose: true }), FIELD("to", "To", { optional: true }),
      FIELD("recommend", "Recommended", { newer: true, form: RECOMMEND_TAKES })],
    repeats: true,
    check: (got) => recommendProblem(got.recommend, got.reading.length),
  },
  /* A person's answer to a park, carried onto the record by a run. The CLI writes on one credential
     whoever composes the prose, so no identity on the comment row tells the parker from whoever
     answered; the source the write names is the whole of what separates a relayed answer from a
     run answering itself, which is why both fields are owed (ISS-198). */
  answer: {
    heading: "Answer",
    repeats: true,
    fields: [FIELD("from", "From", { prose: true }), FIELD("quoted", "In their words", { prose: true })],
  },
  park: {
    heading: "Park",
    repeats: true,
    fields: [
      FIELD("kind", "Kind", { oneOf: PARKS }),
      FIELD("why", "Why", { prose: true }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true, owed: OWES.park }),
    ],
    stamp: FIELD("left", "Status left"),
    check: (got) =>
      (OWES.park(got) && !got.evidence.length
        ? `--evidence: a ${got.kind} park names what the reviewer is to look at`
        : null),
  },
  /* `corrects` is what makes a correction findable by what it corrects rather than by reading its
     sentence, and what the field writes key their refusal on (record/corrections/superseding.mjs); `newer`, so
     every correction written before it reads back whole. */
  correction: {
    heading: "Correction",
    fields: [FIELD("moved", "What moved", { prose: true }), FIELD("why", "Why", { prose: true }),
      FIELD("corrects", "What it corrects", { newer: true, form: CORRECTS_TAKES })],
    repeats: true,
    check: (got) => (got.corrects === undefined ? null : correctsProblem(got.corrects)),
  },
  /* A value a field write replaced, posted by that write after the field and never by a verb: the
     attachment goes up before the field does, so the value is on the issue before it is gone from
     the field, and `by` is the handle of the correction the replacement spent. */
  superseded: {
    heading: "Superseded payload",
    repeats: true,
    verbless: true,
    fields: [
      FIELD("kind", "Kind"),
      FIELD("by", "Corrected by"),
      FIELD("attached", "Attached as"),
      FIELD("was", "As it stood", { optional: true }),
    ],
  },
  baseline: {
    heading: "Baseline",
    fields: [
      FIELD("gate", "Gate"),
      FIELD("result", "Result", { prose: true }),
      FIELD("commit", "Commit", { commit: true }),
      FIELD("scope", "Scope", { oneOf: SCOPES, newer: true }),
      FIELD("cited", "Cited from", { optional: true }),
      FIELD("head", "Head at the write", { optional: true, stamped: "head" }),
    ],
    check: (got) =>
      (got.cited !== undefined && !String(got.cited).trim()
        ? "--cited to name the recorded gate result its result was read off: a citation naming no source is a result from nowhere"
        : null),
  },
  /* What a schema-coupled change's migration does once deployed, owed at `testing` where the plan
     declares schema coupling: a record the gate reads, because the attachment it once counted could
     be any file at all (ISS-2196). */
  migration: {
    heading: "Migration risk classification",
    fields: [
      FIELD("reaches", "How it reaches the deployment", { prose: true }),
      FIELD("statement", "Statement", { many: true, each: statementProblem, form: STATEMENT_TAKES, prose: true }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
    ],
  },
  /* `per` opens a block: one write, a verdict per criterion. A stamp renders last, so a shape with `per` takes none. */
  verdict: {
    heading: "Verdict",
    per: "criterion",
    fields: [
      FIELD("criterion", "Criterion", { criterion: true }),
      FIELD("verdict", "Verdict", { oneOf: VERDICTS }),
      FIELD("commit", "Commit", JUDGED_COMMIT),
      FIELD("landing", "Landing judged", JUDGED_LANDING),
      FIELD("runtime", "Runtime exercised", { optional: true, form: RUNTIME_TAKES }),
      /* In no usage row, so no flag reaches it; stamped by its own writer, which needs the page. */
      FIELD(CARRIES, "Carries the merged commit", { optional: true, stamped: CARRIES }),
      FIELD(CARRIES_DEPLOYMENT, "Carries the deployment", { optional: true, stamped: CARRIES_DEPLOYMENT }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true, owed: OWES.verdict }),
      FIELD("why", "Why", { optional: true, prose: true }),
      FIELD("filed", "Filed as", { optional: true }),
      FIELD("judge", "Judge", { written: "id", newer: true }),
      FIELD(JUDGE_FROM, "Judge id from", { written: "source", newer: true }),
    ],
    check: (got) => {
      const identity = identityProblem(got) ?? runtimeProblem(got.runtime);
      if (identity) return identity;
      if (got.verdict === "skipped" && !got.why) return "--why, for a skipped check";
      /* A failing verdict is the one another run acts on, and one saying only `fail` sends them back to run it again to find out what. */
      if (got.verdict === FAIL && !got.why) return `--why, naming what the criterion did instead: a \`${FAIL}\` is what another run acts on`;
      const shortfall = shortProblem(got);
      if (shortfall) return shortfall;
      if (OWES.verdict(got) && !got.evidence.length) return "--evidence (repeatable): a verdict with none is refused";
      return null;
    },
  },
  review: {
    heading: "Code review",
    fields: [
      FIELD("reviewer", "Reviewer"),
      FIELD("commit", "Head judged", JUDGED_COMMIT),
      FIELD("landing", "Landing judged", JUDGED_LANDING),
      FIELD("outcome", "Outcome", { oneOf: OUTCOMES }),
      FIELD("finding", "Findings", { many: true, least: 0, each: findingProblem, form: FINDING_TAKES, prose: true }),
    ],
    check: identityProblem,
  },
  /* What one look found: a person's voice carried for them, or the agent's own where the flow sent
     it to look. A reopen with no finding is a status that moved and nothing saying why. */
  finding: {
    heading: "Finding",
    repeats: true,
    fields: [
      FIELD("expected", "Expected", { prose: true }),
      FIELD("seen", "Seen", { prose: true }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
      FIELD("criterion", "Criterion", { criterion: true, optional: true }),
      FIELD("uc", "Use case", { optional: true }),
      FIELD("quoted", "In their words", { optional: true, prose: true }),
    ],
    stamp: FIELD("reopen", "Reopen", { from: "reopenCount" }),
    check: (got) => {
      if (got.criterion !== undefined && got.uc !== undefined) {
        return "one of --criterion and --uc, not both: a finding names one thing it is about";
      }
      if (!got.quoted && !got.evidence.length) return ON_EITHER_GROUND;
      return null;
    },
  },
  /* The agent's ruling on a finding, and the one thing the reopen is for: what would have caught
     it. The outcome is what routes the fall, so a triage with none routes nothing. */
  triage: {
    heading: "Triage",
    repeats: true,
    fields: [
      FIELD("outcome", "Outcome", { oneOf: TRIAGES }),
      FIELD("would-have-caught", "Would have caught it", { prose: true }),
      FIELD("detail", "Detail", { optional: true, prose: true }),
    ],
    stamp: FIELD("reopen", "Reopen", { from: "reopenCount" }),
  },
  /* A finding this run made about something it is not working, and where it went: without the
     destination the parent has to chase it, which is a round nobody can bill to this issue.
     `onePer` is the unit one record carries, so a second one is a second record rather than a
     choice between them: the refusal of a repeat and this kind's `-h` both read it (ISS-234). */
  routed: {
    heading: "Routed finding",
    repeats: true,
    fields: [
      FIELD("what", "What was found", { optional: true, prose: true, onePer: "finding" }),
      FIELD("to", "Where it went", { optional: true, onePer: "finding" }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
      FIELD("none", "None found", { optional: true, prose: true }),
    ],
    check: (got) => escapeOr(got, ["what", "to"], "routed nothing"),
  },
  /* A filing the fold landed on this issue, typed so a reader finds it by kind. The fold writes it
     beneath the filing's own body and no verb writes it at all: one with no body above it would be
     a finding nobody filed. What answers one is `earned/findings.mjs`'s. */
  folded: {
    heading: "Folded finding",
    repeats: true,
    verbless: true,
    fields: [FIELD("title", "Title")],
  },
  /* A run's refusal to fix one folded finding here, and the reason: the other answer, a criterion
     carrying it, is a line of the criteria field and no record. */
  declined: {
    heading: "Finding declined",
    repeats: true,
    fields: [
      FIELD("finding", "Finding", { form: HANDLE_TAKES }),
      FIELD("why", "Why", { prose: true }),
    ],
    check: (got) => (HANDLE_FORM.test(String(got.finding ?? "")) ? null : `--finding as ${HANDLE_TAKES}, not \`${got.finding}\``),
  },
  /* Where the method this run followed did not answer, typed at the moment it did not: a report
     written from memory at the end keeps the workaround and loses the gap that forced it. */
  gap: {
    heading: "Gap in the method",
    repeats: true,
    fields: [
      FIELD("where", "Where", { optional: true }),
      FIELD("lacked", "What it did not say", { optional: true, prose: true }),
      FIELD("did", "What was done instead", { optional: true, prose: true }),
      FIELD("none", "None found", { optional: true, prose: true }),
    ],
    check: (got) => escapeOr(got, ["where", "lacked", "did"], "met no gap"),
  },
  /* One dispatch of a wave, on the issue the dispatcher heads it with: what the dispatcher knows at
     that moment and nothing a run will write, statuses and leases being read live. `finder` is a
     write that neither takes nor needs the lease, the headline being free or a member a runner
     holds; `closes` is the fold's, which ends the wave the dispatches after the last fold make (ISS-818). */
  wave: {
    heading: "Wave dispatch",
    repeats: true,
    finder: true,
    fields: [
      FIELD("member", "Member", { many: true, each: memberProblem, form: MEMBER_TAKES }),
      FIELD("role", "Role"),
      FIELD("tree", "Worktree", { optional: true }),
      FIELD("session", "Session granted"),
    ],
    check: (got) => {
      const twice = got.member.find((one, at) => got.member.indexOf(one) !== at);
      return twice ? `each --member once: \`${twice}\` is named twice, and one dispatch carries an issue once` : null;
    },
  },
  fold: {
    heading: "Wave fold",
    repeats: true,
    finder: true,
    closes: "wave",
    fields: [FIELD("summary", "Summary", { prose: true })],
  },
  verification: {
    heading: "Release verification",
    fields: [
      FIELD("where", "Where it runs"),
      FIELD("commit", "Commit", { commit: true, optional: true, identity: true }),
      FIELD("landing", "Landing judged", JUDGED_LANDING),
      FIELD("contains", "Landed commit in it", { optional: true, commit: true, takes: "the landed commit the head on --commit carries" }),
      FIELD("evidence", "Evidence", { many: true, least: 1, evidence: true }),
      FIELD("review", "Review", { optional: true, derived: true }),
      FIELD("promotion", "Promotion", { optional: true, derived: true }),
    ],
    check: (got) => identityProblem(got) ?? (got.landing !== undefined && got.contains !== undefined
      ? "--contains only beside --commit: it names the landed commit a deployed head carries, and a landing outside git has none"
      : null),
  },
};

/** What an owed command prints for a closed-set flag: every value the write accepts, off the field
 *  the write refuses against. One literal there reads as an example, and the value was then learned
 *  from the second refusal rather than the first (ISS-184). */
export const valuesOf = (kind, flag) =>
  `<${SHAPES[kind].fields.find((field) => field.flag === flag).oneOf.join("|")}>`;

/* Said once, so the report's count line and the brief's cannot disagree; silent at the one `latest` gives. */
export const heldSaid = (kind, held) => (held > 1 ? `${held} ${SHAPES[kind].heading} records` : null);
