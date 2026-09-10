/* A project whose `.forge.json` names a prose language has every body and prose field rewritten on
   the way out (tools/vi.mjs), and a rewrite renames prose, so a key travels in a form the rewrite copies byte for byte: a fenced block, or a code span. `content.mjs` is the one thing imported here and imports nothing itself, so both sides can still import this. */
import { decisionProblem, whereProblem } from "./record/content.mjs";

/** An ISO stamp to the minute, as every screen in this tree shows one; apart from `lease.mjs`'s and `stats/runs.mjs`'s, which take milliseconds. */
export const atMinute = (at) => String(at ?? "").slice(0, 16);

const INFO = "forge-record";
const KEY = /^([a-z][a-z0-9-]*): ?(.*)$/u;
const OPEN = new RegExp(`^(\`{3,})${INFO}\\s*$`, "u");
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

export const payloadIn = (body) => {
  const lines = String(body ?? "").split("\n");
  const at = lines.findIndex((line) => OPEN.test(line));
  if (at < 0) return null;
  const fence = OPEN.exec(lines[at])[1];
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim().startsWith(fence)) return out;
    const indented = /^ {2}(.*)$/u.exec(line);
    const key = indented ? null : KEY.exec(line);
    if (key) out.push([key[1], key[2]]);
    else if (out.length) out[out.length - 1][1] += `\n${indented ? indented[1] : line}`;
  }
  return out;
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

const valuesFor = (entries, field) => {
  const held = entries.filter(([key]) => key === field.flag).map(([, value]) => value);
  if (field.many) return held.length ? held : undefined;
  return held.length ? held[0] : undefined;
};

/* A `per` key opens a block; what stands before the first is every block's (ISS-289). */
const groupsIn = (entries, per) => {
  const opens = per ? entries.findIndex(([key]) => key === per) : -1;
  if (opens < 0) return [entries];
  const shared = entries.slice(0, opens);
  const groups = [];
  for (const entry of entries.slice(opens)) {
    if (entry[0] === per) groups.push([...shared]);
    groups.at(-1).push(entry);
  }
  return groups;
};

/* Keys resolving to none of the shape's is rewritten, not empty; and no body sources a derived one — so a fact a check has to read back is `stamped`, which the write fills and this reads, never `derived`, which is a copy for a person and reaches no checker. */
export const readRecords = (body, shapeOf) => {
  const tag = TAG.exec(body ?? "");
  const shape = tag ? shapeOf(tag[1]) : null;
  if (!shape) return [];
  const fenced = payloadIn(body);
  const { entries, rewritten } = fenced ? { entries: fenced, rewritten: false } : labelledIn(body, shape);
  const read = [...shape.fields.filter((one) => !one.derived), ...(shape.stamp ? [shape.stamp] : [])];
  return groupsIn(entries, shape.per).map((group) => {
    const fields = {};
    for (const field of read) {
      const held = valuesFor(group, field);
      if (held !== undefined) fields[field.flag] = held;
    }
    return { kind: tag[1], contract: Number(tag[2]), fields, rewritten };
  });
};

/* What the first record in a body stamped, which is the one a write printed: docs/cli/the-ladder.md. */
const FIRST_TAG = new RegExp(`\`?${INFO}: ([a-z]+) · contract \\d+\`?[ \t]*$`, "mu");

export const stampedIn = (body, kind, flag) => {
  if (FIRST_TAG.exec(body ?? "")?.[1] !== kind) return null;
  return (payloadIn(body) ?? []).find(([key]) => key === flag)?.[1] ?? null;
};

/** A number or nothing: a caller keys a map by this, and `NaN` is a key nothing can supply. */
export const criterionNumber = (value) => {
  const found = /^\s*(\d+)/u.exec(String(value ?? ""));
  return found ? Number(found[1]) : null;
};

/* The criteria grammar the issue-flow guide states — one outcome per numbered line — read as far as a
   lexical pass can prove it, so `forge record criteria` refuses a line carrying two rather than warning
   about a word (ISS-483). Every shape below wants a subject and a verb after the coordinator, which is why
   the `and` inside a hyphenated slug and the `and` between two nouns are not among them (ISS-73). A miss
   costs the consult round the guide already spends and a wrong refusal costs the write, so the reading errs
   towards writing: no verb this table carries, no subject it can see, and the line stands. */
const GRAMMAR = {
  en: {
    coordinators: ["and", "or"],
    pronouns: ["it", "they", "this", "these", "those", "there", "he", "she", "we"],
    determiners: ["the", "a", "an", "its", "their", "his", "her", "our", "that", "each", "every",
      "no", "any", "one", "some", "both", "either", "neither", "another"],
    auxiliaries: ["is", "are", "was", "were", "has", "have", "had", "does", "do", "did", "can",
      "could", "will", "would", "shall", "should", "may", "might", "must"],
    /* A form that is also a common plural noun — passes, runs, reads, counts — is left out, and one
       that is here counts as a verb only where an opener follows it: `the median passes per run` is
       a noun phrase and `maps to the head` is a clause, and nothing else tells them apart. */
    verbs: ["names", "prints", "says", "refuses", "carries", "holds", "resolves", "maps", "shows",
      "hides", "fires", "reaches", "keeps", "judges", "earns", "owes", "asks", "cites", "quotes",
      "gives", "takes", "sits", "stands", "adds", "sends", "leaves", "makes", "opens", "closes",
      "treats", "covers", "follows", "matches", "spends", "renders", "records", "attaches"],
    openers: ["the", "a", "an", "its", "their", "his", "her", "our", "that", "each", "every", "no",
      "any", "one", "some", "both", "this", "these", "those", "it", "them", "they", "what",
      "nothing", "none", "to", "into", "onto", "as", "back"],
    modifiers: ["of", "per", "in", "for", "from", "with", "at", "on", "by", "under", "over",
      "about", "across", "between", "through", "without", "against", "within", "beside"],
    subordinators: ["when", "whenever", "if", "where", "wherever", "while", "unless", "until",
      "because", "since", "after", "before", "though", "although", "whether", "which", "who",
      "whom", "whose", "that", "as", "so", "once"],
  },
};

/* One inline code span, built from once below: what `protectMachine` leaves inside one is what `planFlags` refuses to count, and one half saying so alone is not the rule (ISS-488). */
const CODE_SPAN = "`[^`\\n]+`";
const SPAN = new RegExp(CODE_SPAN, "gu");
const SPANS = new RegExp(`${CODE_SPAN}|"[^"\\n]*"|\\([^)\\n]*\\)`, "gu");
const BREAKS = /[,;:—]$/u;

const blanked = (text, spans) => text.replace(spans, (span) => "·".repeat(span.length));
const masked = (text) => blanked(text, SPANS);

const tokensOf = (text) => {
  const out = [];
  let breakBefore = true;
  for (const found of masked(text).matchAll(/\S+/gu)) {
    const raw = found[0];
    out.push({ word: raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase(), at: found.index, breakBefore });
    breakBefore = BREAKS.test(raw);
  }
  return out;
};

const verbAt = (tokens, index, g) => {
  const word = tokens[index]?.word;
  if (!word) return false;
  if (g.auxiliaries.includes(word)) return true;
  return g.verbs.includes(word) && g.openers.includes(tokens[index + 1]?.word ?? "");
};

const clauseAt = (tokens, index, g) => {
  const word = tokens[index]?.word;
  if (!word) return false;
  if (verbAt(tokens, index, g)) return true;
  if (g.pronouns.includes(word)) return verbAt(tokens, index + 1, g);
  if (!g.determiners.includes(word)) return false;
  for (let step = index + 1; step < tokens.length && step <= index + 4; step += 1) {
    const { word: next, breakBefore } = tokens[step];
    if (breakBefore || g.subordinators.includes(next) || g.modifiers.includes(next) || g.determiners.includes(next)) return false;
    if (verbAt(tokens, step, g)) return true;
  }
  return false;
};

const halvesAt = (text, tokens, index) => ({
  first: text.slice(0, tokens[index].at).replace(/[\s,;:—]+$/u, ""),
  second: text.slice(tokens[index + 1].at),
});

/* Two outcomes want a verb on each side — without the left one, `the list and the export are hidden` is one predicate over two subjects — and the second has to run to the end of the line, since a clause the line goes on past is as likely a condition among several. */
const outcomeAt = (tokens, index, g) => tokens.slice(0, index).some((one, at) => verbAt(tokens, at, g))
  && clauseAt(tokens, index + 1, g)
  && !tokens.slice(index + 1).some((one) => one.breakBefore);

const splitOf = (one, g) => {
  const tokens = tokensOf(one.text);
  let subordinate = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const { word, breakBefore } = tokens[index];
    if (breakBefore) subordinate = false;
    if (g.subordinators.includes(word)) subordinate = true;
    if (subordinate || !g.coordinators.includes(word)) continue;
    if (outcomeAt(tokens, index, g)) return { number: one.number, ...halvesAt(one.text, tokens, index) };
  }
  return null;
};

/** Each criterion of `criteria` this grammar reads as two outcomes, with the halves it read. */
export const compoundCriteria = (criteria, language) => {
  const g = GRAMMAR[String(language ?? "en").slice(0, 2).toLowerCase()];
  if (!g) return [];
  return criteria.map((one) => splitOf(one, g)).filter(Boolean);
};

/* A trim: the fence is off before a field reaches here, so this goes with its callers (ISS-470). */
export const unwrap = (text) => String(text ?? "").trim();

/* Machine data in prose; every occurrence outside a code span decides, not the first (docs/cli/the-ladder.md). */
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

/* What a typed plan answers, one section per question: the name is the whole text of the heading that
   opens it, `owed` the declarations behind which the tree puts a way back. Presence is the whole of the
   check; whether a section answers well is the reviewer's. */
export const PLAN_SECTIONS = [
  { name: "Files touched", asks: "which files this change opens" },
  { name: "Before", asks: "what the code does today" },
  { name: "After", asks: "what it does once this lands" },
  { name: "Deliberately unchanged", asks: "what this change leaves alone on purpose" },
  { name: "Verified in code", asks: "the one thing read in the source that makes this possible" },
  { name: "Conventions reversed", asks: "which documented convention this reverses, and where the same change rewrites it" },
  { name: "Declarations", asks: `each of ${Object.values(DECLARED).join(", ")}, written \`yes\` or \`no\`` },
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

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/u;

/** A plan's lines with the fenced ones marked: what a fence holds is text a plan quotes and never
    structure it makes. Only markdown's own closer closes — the opener's character, at least its
    length and nothing after it — so a longer fence quoting a shorter one holds all of it. */
const fenceMarked = (text) => {
  const out = [];
  let opener = null;
  for (const line of String(text ?? "").split(/\r?\n/u)) {
    const found = FENCE.exec(line);
    const closes = opener && found && found[1][0] === opener[0]
      && found[1].length >= opener.length && !found[2].trim();
    if (closes) opener = null;
    else if (found && !opener) opener = found[1];
    out.push({ line, fenced: Boolean(found ?? opener) });
  }
  return out;
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

/** The sections a typed plan is missing, the way back among them where a declaration owes one. */
export const sectionsOwed = (plan, flags = {}) => {
  const held = planSections(plan);
  return PLAN_SECTIONS
    .filter((one) => !one.owed || one.owed.some((key) => flags[key] === "yes"))
    .filter((one) => !held.has(one.name))
    .map((one) => one.name);
};

export const sectionOwedBy = (name, flags = {}) =>
  (PLAN_SECTIONS.find((one) => one.name === name)?.owed ?? [])
    .filter((key) => flags[key] === "yes")
    .map((key) => DECLARED[key]);

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
    `${HEADING}|(?:${Object.values(DECLARED).join("|")})${DECLARED_VALUE}|${CITED}`,
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
/* The three parks that speak to a reviewer, who cannot answer without the thing to look at. One
   list, because the read-back judges a park a hand wrote by the same rule the write applies. */
export const SHOWS_EVIDENCE = ["screen-review", "code-review", "destructive-migration"];
export const FAIL = "fail";
export const VERDICTS = ["pass", FAIL, "skipped"];
export const JUDGE_FROM = "judge-from";
export const SCOPES = ["whole", "part"];

/** One owed item: what the record lacks, and the one command that supplies it. Here rather than in the checks, so a check split out of them takes the shape with it and imports nothing back. */
export const need = (what, command) => ({ what, command });
/* What the agent may rule a person's finding to be: the criterion asked the wrong thing, the
   criterion was not met, or nothing in the specification ever promised what the person expected. */
export const TRIAGES = ["wrong-test", "not-met", "not-in-spec"];
export const OUTCOMES = ["approved", "changes-requested"];
const FINDING = /^F\d+ (?:accepted|rejected: .+)$/u;
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
  verdict: (got) => got.verdict !== "skipped",
};

export const SHAPES = {
  confirmation: {
    heading: "Confirmation",
    fields: [
      FIELD("where", "Where looked", { many: true, each: whereProblem }),
      FIELD("is", "What it is"),
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
      FIELD("judge", "Judge", { written: "id", newer: true }),
      FIELD(JUDGE_FROM, "Judge id from", { written: "source", newer: true }),
    ],
    check: (got) => {
      if (got.verdict === "skipped" && !got.why) return "--why, for a skipped check";
      /* A failing verdict is the one another run acts on, and one saying only `fail` sends them back to run it again to find out what. */
      if (got.verdict === FAIL && !got.why) return `--why, naming what the criterion did instead: a \`${FAIL}\` is what another run acts on`;
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
      const bare = got.finding.find((one) => /^F\d+ rejected$/u.test(one));
      if (bare) return `a reason after a rejected finding: \`${bare}: why\``;
      const odd = got.finding.find((one) => !FINDING.test(one));
      if (odd) return `each --finding as \`F1 accepted\` or \`F1 rejected: why\`, not \`${odd}\``;
      return null;
    },
  },
  /* The person's voice, written by the agent on their behalf: a reopen with no finding is a status
     that moved and nothing that says why. `repeats` because a second look finds a second thing. */
  finding: {
    heading: "Finding",
    repeats: true,
    fields: [
      FIELD("expected", "Expected"),
      FIELD("seen", "Seen"),
      FIELD("evidence", "Evidence", { many: true, least: 1, evidence: true }),
      FIELD("criterion", "Criterion", { criterion: true, optional: true }),
      FIELD("uc", "Use case", { optional: true }),
      FIELD("quoted", "In their words"),
    ],
    stamp: FIELD("reopen", "Reopen", { from: "reopenCount" }),
    check: (got) => {
      if (got.criterion !== undefined && got.uc !== undefined) {
        return "one of --criterion and --uc, not both: a finding names one thing it is about";
      }
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
