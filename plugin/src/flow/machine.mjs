/* A project whose `.forge.json` names a prose language has every body and prose field rewritten on
   the way out (tools/vi.mjs), and a rewrite renames prose, so a key travels in a form the rewrite copies byte for byte: a fenced block, or a code span. `content.mjs` is the one thing imported here and imports nothing itself, so both sides can still import this. */
import { decisionProblem, whereProblem } from "./record/content.mjs";
import { CODE_SPAN, SPAN, blanked, fenceMarked } from "../prose.mjs";

/** An ISO stamp to the minute, as every screen in this tree shows one; apart from `lease.mjs`'s and `stats/runs.mjs`'s, which take milliseconds. */
export const atMinute = (at) => String(at ?? "").slice(0, 16);

const INFO = "forge-record";
const KEY = /^([a-z][a-z0-9-]*): ?(.*)$/u;
const OPEN = new RegExp(`^(\`{3,})${INFO}\\s*$`, "u");
const CLOSE = /^`{3,}[ \t]*$/u;
const CLOSES = /^ {0,3}`{3,}[ \t]*$/u;
/* What the first record in a body stamped, which is the one a write printed, matched over the whole line because a sentence ending in those words quotes a record rather than making one: docs/cli/the-rung-in-text.md. */
const FIRST_TAG = new RegExp(`^\`?${INFO}: ([a-z]+) · contract \\d+\`?[ \t]*$`, "mu");
const TAG = new RegExp(`\`?${INFO}: ([a-z]+) · contract (\\d+)\`?\\s*$`, "u");
const LABELLED = /^- \*\*([^*]+):\*\* (.*)$/u;

export const tagFor = (kind, contract) => `\`${INFO}: ${kind} · contract ${contract}\``;

/* The fence outruns any run inside it; an indented line continues the value above, not a key. */
export const fenceFor = (text) => "`".repeat(Math.max(3, ...[...String(text).matchAll(/`+/gu)].map((one) => one[0].length + 1)));

const linesFor = (key, value) => String(value).split("\n").map((line, at) => (at ? `  ${line}` : `${key}: ${line}`));

export const blockOf = (entries) => {
  const lines = entries.flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).flatMap((one) => linesFor(key, one)));
  const fence = fenceFor(lines.join("\n"));
  return [`${fence}${INFO}`, ...lines, fence].join("\n");
};

const keyedIn = (lines, closes) => {
  const out = [];
  for (const line of lines) {
    if (closes(line)) return out;
    const indented = /^ {2}(.*)$/u.exec(line);
    const key = indented ? null : KEY.exec(line);
    if (key) out.push([key[1], key[2]]);
    else if (out.length) out[out.length - 1][1] += `\n${indented ? indented[1] : line}`;
  }
  return out;
};

export const payloadIn = (body) => {
  const lines = String(body ?? "").split("\n");
  const at = lines.findIndex((line) => OPEN.test(line));
  if (at < 0) return null;
  const fence = OPEN.exec(lines[at])[1];
  return keyedIn(lines.slice(at + 1), (line) => line.trim().startsWith(fence));
};

/* The same payload with its head off: a host truncates a long tool result from the top, so a record
   this CLI printed can arrive without its opening fence. What stands in for the one it lost is the
   trailer `render` writes — a fence where `blockOf` puts one, the tag alone beneath, and nothing below that markdown would have closed the first on, which it would three spaces in. */
const headlessIn = (body) => {
  const lines = fenceMarked(body);
  const at = lines.findIndex((one) => one.fenced);
  if (at < 0 || !CLOSE.test(lines[at].line)) return null;
  const under = lines.slice(at + 1);
  if (under.some((one) => CLOSES.test(one.line))) return null;
  const said = under.find((one) => one.line.trim());
  if (!said || !FIRST_TAG.test(said.line)) return null;
  const out = keyedIn(lines.slice(0, at).map((one) => one.line), () => false);
  return out.length ? out : null;
};

/* The label is the key in this form alone: resolved once, here, and nowhere further in. It also
   joins a repeating field's values, so this form alone splits them; a fenced line may hold that pair. */
const labelledIn = (body, shape) => {
  const held = [...shape.fields, ...(shape.stamp ? [shape.stamp] : [])];
  const map = new Map(held.map((one) => [one.label, one]));
  const out = [];
  let seen = 0;
  for (const line of String(body ?? "").split("\n")) {
    const found = LABELLED.exec(line.trim());
    if (!found) continue;
    seen += 1;
    const field = map.get(found[1]);
    if (field) for (const one of field.many ? found[2].split("; ") : [found[2]]) out.push([field.flag, one]);
  }
  return { entries: out, rewritten: seen > 0 && out.length === 0 };
};

/* One reading of a body, so no two callers can come to disagree over what a record said. */
const entriesIn = (body, shape) => {
  const keyed = payloadIn(body) ?? headlessIn(body);
  if (keyed) return { entries: keyed, rewritten: false };
  return shape ? labelledIn(body, shape) : { entries: [], rewritten: false };
};

const valuesFor = (entries, field) => {
  const held = entries.filter(([key]) => key === field.flag).map(([, value]) => value);
  if (field.many) return held.length ? held : undefined;
  return held.length ? held[0] : undefined;
};

/* A `per` key opens a block; what stands before the first is every block's (ISS-289), and a block's own value of a flag taking one replaces the shared one, so that occurrence comes out for exactly the flags the block names while a repeatable flag adds to the shared values and keeps them ahead of its own (ISS-307) — the rule `blocksIn` gives the writer's argv, read here off the payload because a record is also written by hand. A payload opening no block shares nothing, so a key repeated in one is handed on as it was read. */
const groupsIn = (entries, per, single = []) => {
  const opens = per ? entries.findIndex(([key]) => key === per) : -1;
  if (opens < 0) return [entries];
  const shared = entries.slice(0, opens);
  const groups = [];
  for (const entry of entries.slice(opens)) {
    if (entry[0] === per) groups.push([]);
    groups.at(-1).push(entry);
  }
  return groups.map((own) => {
    const replaced = new Set(own.map(([key]) => key).filter((key) => single.includes(key)));
    return [...shared.filter(([key]) => !replaced.has(key)), ...own];
  });
};

/* Keys resolving to none of the shape's is rewritten, not empty; and no body sources a derived one — so a fact a check has to read back is `stamped`, which the write fills and this reads, never `derived`, which is a copy for a person and reaches no checker. */
export const readRecords = (body, shapeOf) => {
  const tag = TAG.exec(body ?? "");
  const shape = tag ? shapeOf(tag[1]) : null;
  if (!shape) return [];
  const { entries, rewritten } = entriesIn(body, shape);
  const read = [...shape.fields.filter((one) => !one.derived), ...(shape.stamp ? [shape.stamp] : [])];
  const single = read.filter((one) => !one.many).map((one) => one.flag);
  return groupsIn(entries, shape.per, single).map((group) => {
    const fields = {};
    for (const field of read) {
      const held = valuesFor(group, field);
      if (held !== undefined) fields[field.flag] = held;
    }
    return { kind: tag[1], contract: Number(tag[2]), fields, rewritten };
  });
};

export const stampedIn = (body, kind, flag) => {
  if (FIRST_TAG.exec(body ?? "")?.[1] !== kind) return null;
  return entriesIn(body, SHAPES[kind]).entries.find(([key]) => key === flag)?.[1] ?? null;
};

/** A number or nothing: a caller keys a map by this, and `NaN` is a key nothing can supply. */
export const criterionNumber = (value) => {
  const found = /^\s*(\d+)/u.exec(String(value ?? ""));
  return found ? Number(found[1]) : null;
};


/* A trim: the fence is off before a field reaches here, so this goes with its callers (ISS-470). */
export const unwrap = (text) => String(text ?? "").trim();

/* Machine data in prose; every occurrence outside a code span decides, not the first (docs/cli/the-rung-in-text.md). */
const DECLARED = {
  screen: "screen change", schema: "schema coupling", deploy: "deploy coupling", look: "user-facing outcome",
};
const DECLARED_VALUE = ":\\s*(yes|no)\\b";
const lineFor = (name) => new RegExp(`${name}${DECLARED_VALUE}`, "giu");

export const planFlags = (plan) => {
  const said = blanked(String(plan ?? ""), SPAN);
  return Object.fromEntries(Object.entries(DECLARED).map(([key, name]) => {
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
  { name: "Declarations", asks: `each of ${Object.values(DECLARED).join(", ")}, written \`yes\` or \`no\`` },
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
const CITED = "criteri(?:on|a)[ \\t]*:?[ \\t\\r\\n]*\\d+(?:[ \\t]*,[ \\t\\r\\n]*\\d+)*";
const CITES = new RegExp(CITED, "giu");
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

/** What a plan says only a person at the running product can witness, and which way it answered — `cites` and `none` being the two, read off one reading by the write that refuses a file and by the status that reads the plan the issue stored, or a plan edited anywhere but here enters at a shape the write turns back. It is read where an answer stands — the section's opening word — so `display: none` in a criterion it names is prose, as it would be anywhere else. Both answers come back rather than one winning: a section giving neither and one giving both each leave a reader guessing, and only the caller that refuses them can say which happened. */
export const witnessedOn = (plan) => {
  const body = planSections(plan).get(WITNESSED);
  if (body === undefined) return null;
  const said = fenceMarked(body).filter((one) => !one.fenced).map((one) => one.line).join("\n");
  const cites = [...said.matchAll(CITES)].flatMap((one) => (one[0].match(/\d+/gu) ?? []).map(Number));
  const opens = said.split("\n").find((one) => one.trim()) ?? "";
  return { cites: [...new Set(cites)].sort((one, two) => one - two), none: SAYS_NONE.test(opens) };
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

export const declaredAs = (keys) => keys.map((key) => DECLARED[key] ?? key);

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
    `${HEADING}|(?:${Object.values(DECLARED).join("|")})${DECLARED_VALUE}|${CITED}|${WITNESSED_NONE}`,
    "gimu",
  ),
};
/* What a declaration stands as while the prose pass runs. It cannot itself be a code span — the
   reader refuses those — and an identifier inside one is carried whole by a pass that keeps spans byte for byte. */
const HELD = "forge-machine";
const SPAN_PART = new RegExp(`(${CODE_SPAN})`, "gu");
/* Named away from anything the text already says, so a plan quoting the mark keeps its quotation:
   the restore cannot tell a span it wrote from one it was given, so it is never given one. */
const heldIn = (source) => {
  let key = HELD;
  while (source.includes(key)) key = `${key}x`;
  return key;
};

/** Every bare declaration out of the rewrite's way, its own text kept in `held` for the restore. */
export const protectMachine = (field, text, held = {}) => {
  const pattern = MACHINE[field];
  const source = String(text);
  if (!pattern) return source;
  const key = heldIn(source);
  const texts = [];
  const out = source
    .split(SPAN_PART)
    .map((part, at) => (at % 2 ? part : part.replace(pattern, (whole) => {
      texts.push(whole);
      return `\`${key}-${texts.length - 1}\``;
    })))
    .join("");
  Object.assign(held, { key, texts });
  return out;
};

/** The other half of the protection: what `protectMachine` held, back where its own marks stand. */
export const restoreMachine = (text, held = {}) => {
  const { key, texts } = held;
  if (!key || !texts?.length) return String(text);
  return String(text).replace(new RegExp(`\`${key}-(\\d+)\``, "gu"), (mark, at) => texts[Number(at)] ?? mark);
};

/* What a payload of each kind holds, in the one table the write, the read-back and the usage
   list all read: a field named in two places is a shape that disagrees with itself. Kept beside
   the block it is written into, and importing nothing, so either side may reach it. */
export const FINDINGS = ["holds", "already-fixed", "duplicate", "intended", "obsolete", "premise-false"];
/* The status `closed` is entered from. Here, not beside ORDER: record.mjs cannot import earned.mjs. */
export const CLOSES_FROM = "awaiting_release";
export const PARKS = [
  "question", "screen-review", "destructive-migration", "rolled-back", "no-way-back",
  "unshippable", "blocked", "paused", "crashed", "release-decision", "code-review", "dropped",
];
/* The three parks that speak to a reviewer, who cannot answer without the thing to look at. One list, because the read-back judges a park a hand wrote by the same rule the write applies.
   The two of them that are a person's look answer it whichever kind was asked for, the kind saying where a person looked rather than whether they did. */
export const SHOWS_EVIDENCE = ["screen-review", "code-review", "destructive-migration"];
export const ANSWERS_LOOK = ["screen-review", "code-review"];
export const FAIL = "fail";
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
export const SCOPES = ["whole", "part"];

/** One owed item — what the record lacks and the one command that supplies it — and the way every reader prints a set of them. Here rather than in the checks, so a check split out of them takes the shape with it and imports nothing back, and so a refusal's shortfall and a write's own tail cannot spell one differently. */
export const need = (what, command) => ({ what, command });
export const missingLines = (missing) => missing.map((one) => `\n  ${one.what}\n    ${one.command}`);
/* What the agent may rule a person's finding to be: the criterion asked the wrong thing, the
   criterion was not met, or nothing in the specification ever promised what the person expected. */
export const TRIAGES = ["wrong-test", "not-met", "not-in-spec"];
export const OUTCOMES = ["approved", "changes-requested"];
/* A finding's identifier is unique only inside the consult that raised it, and the method mandates
   several reads of one change, so one review holds several F1s sharing nothing but a number
   (ISS-1128). The leading token is that consult, which makes them rows that stand apart rather than
   a reader being told which of them by nothing at all; it is unconstrained, being the reviewer's own
   handle and not a shape this file gets to assume. The identifier is a letter series and a number
   for the reason the other way round: a reviewer numbers from F1 or from G1 as it chooses (ISS-933),
   and a bare number is a count. Words after either disposition say what changed or why, an
   acceptance being where the sentence a later reader has to have actually lives. */
const FINDING = /^(?:\S+ )?[A-Za-z]+\d+ (?:accepted(?:: .+)?|rejected: .+)$/u;
/* Asked before the grammar, so a rejection with nothing after it is told what it lacks rather than
   what shape to take. Its identifier is as loose as the other's, or a `G1 rejected` would fall to a
   message about a grammar it already satisfies. */
const BARE_REJECTED = /^(?:\S+ )?[A-Za-z]+\d+ rejected$/u;
export const SECTIONS = ["Added", "Changed", "Fixed", "Removed", "Security"];

/* `many` flags repeat; `oneOf` names the values; `least` is the smallest count that is a payload; `newer` is asked for at the write and excused at the read-back, a shape's records outliving it.
   `takes` is what a sentence about the field says it holds where the label cannot say it: the label is `labelledIn`'s read key above, so renaming one drops that field off every record already written in that form, and what a refusal has to say is longer than what a printed line wants (ISS-833). */
const FIELD = (flag, label, extra = {}) => ({ flag, label, ...extra });

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

/* Said once, by the shape and by whatever turns a write back, so both name the same two grounds. */
export const ON_EITHER_GROUND = "--quoted \"<their words>\" where a person reported it, or --evidence "
  + "<attachment|url|sha> where this run saw it: a finding that quotes nobody and captured nothing "
  + "is an assertion nothing on the record stands behind";

export const SHAPES = {
  confirmation: {
    heading: "Confirmation",
    fields: [
      FIELD("is", "What it is"),
      FIELD("where", "Where looked", { many: true, each: whereProblem }),
      FIELD("finding", "Finding", { oneOf: FINDINGS }),
      FIELD("detail", "Detail", { optional: true }),
      FIELD("rung", "Rung", { optional: true, derived: true }),
    ],
  },
  decision: {
    heading: "Decision record",
    fields: [FIELD("decision", "Decision", { many: true, least: 0, each: decisionProblem }),
      FIELD("none", "None found", { optional: true }), FIELD("serves", "Serves", { optional: true })],
    check: (got) => {
      if (!got.decision.length && !got.none) return "--decision (repeatable) or --none <why>";
      return null;
    },
  },
  question: {
    heading: "Question",
    fields: [FIELD("reading", "Reading", { many: true, least: 2 }), FIELD("to", "To", { optional: true })],
    repeats: true,
  },
  park: {
    heading: "Park",
    repeats: true,
    fields: [
      FIELD("kind", "Kind", { oneOf: PARKS }),
      FIELD("why", "Why"),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true, owed: OWES.park }),
    ],
    stamp: FIELD("left", "Status left"),
    check: (got) =>
      (OWES.park(got) && !got.evidence.length
        ? `--evidence: a ${got.kind} park names what the reviewer is to look at`
        : null),
  },
  correction: {
    heading: "Correction",
    fields: [FIELD("moved", "What moved"), FIELD("why", "Why")],
    repeats: true,
  },
  baseline: {
    heading: "Baseline",
    fields: [
      FIELD("gate", "Gate"),
      FIELD("result", "Result"),
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
  /* `per` opens a block: one write, a verdict per criterion. A stamp renders last, so a shape with `per` takes none. */
  verdict: {
    heading: "Verdict",
    per: "criterion",
    fields: [
      FIELD("criterion", "Criterion", { criterion: true }),
      FIELD("verdict", "Verdict", { oneOf: VERDICTS }),
      FIELD("commit", "Commit", { commit: true }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true, owed: OWES.verdict }),
      FIELD("why", "Why", { optional: true }),
      FIELD("filed", "Filed as", { optional: true }),
      FIELD("judge", "Judge", { written: "id", newer: true }),
      FIELD(JUDGE_FROM, "Judge id from", { written: "source", newer: true }),
    ],
    check: (got) => {
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
      FIELD("commit", "Head judged", { commit: true }),
      FIELD("outcome", "Outcome", { oneOf: OUTCOMES }),
      FIELD("finding", "Findings", { many: true, least: 0 }),
    ],
    check: (got) => {
      const bare = got.finding.find((one) => BARE_REJECTED.test(one));
      if (bare) return `a reason after a rejected finding: \`${bare}: why\``;
      const odd = got.finding.find((one) => !FINDING.test(one));
      if (odd) return "each --finding as `F1 accepted`, `F1 rejected: why`, or either opening with "
        + `the consult that raised it — \`8c1a15 F1 accepted: what changed\` — not \`${odd}\``;
      return null;
    },
  },
  /* What one look found: a person's voice carried for them, or the agent's own where the flow sent
     it to look. A reopen with no finding is a status that moved and nothing saying why. */
  finding: {
    heading: "Finding",
    repeats: true,
    fields: [
      FIELD("expected", "Expected"),
      FIELD("seen", "Seen"),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
      FIELD("criterion", "Criterion", { criterion: true, optional: true }),
      FIELD("uc", "Use case", { optional: true }),
      FIELD("quoted", "In their words", { optional: true }),
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
      FIELD("would-have-caught", "Would have caught it"),
      FIELD("detail", "Detail", { optional: true }),
    ],
    stamp: FIELD("reopen", "Reopen", { from: "reopenCount" }),
  },
  /* A finding this run made about something it is not working, and where it went: without the
     destination the parent has to chase it, which is a round nobody can bill to this issue. */
  routed: {
    heading: "Routed finding",
    repeats: true,
    fields: [
      FIELD("what", "What was found", { optional: true }),
      FIELD("to", "Where it went", { optional: true }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
      FIELD("none", "None found", { optional: true }),
    ],
    check: (got) => escapeOr(got, ["what", "to"], "routed nothing"),
  },
  /* Where the method this run followed did not answer, typed at the moment it did not: a report
     written from memory at the end keeps the workaround and loses the gap that forced it. */
  gap: {
    heading: "Gap in the method",
    repeats: true,
    fields: [
      FIELD("where", "Where", { optional: true }),
      FIELD("lacked", "What it did not say", { optional: true }),
      FIELD("did", "What was done instead", { optional: true }),
      FIELD("none", "None found", { optional: true }),
    ],
    check: (got) => escapeOr(got, ["where", "lacked", "did"], "met no gap"),
  },
  verification: {
    heading: "Release verification",
    fields: [
      FIELD("where", "Where it runs"),
      FIELD("commit", "Commit", { commit: true }),
      FIELD("contains", "Landed commit in it", { optional: true, commit: true, takes: "the landed commit the head on --commit carries" }),
      FIELD("evidence", "Evidence", { many: true, least: 1, evidence: true }),
      FIELD("review", "Review", { optional: true, derived: true }),
      FIELD("promotion", "Promotion", { optional: true, derived: true }),
    ],
  },
};

/* Said once, so the report's count line and the brief's cannot disagree; silent at the one `latest` gives. */
export const heldSaid = (kind, held) => (held > 1 ? `${held} ${SHAPES[kind].heading} records` : null);
