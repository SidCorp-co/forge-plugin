/* A project whose `.forge.json` names a prose language has every body and prose field rewritten on
   the way out (tools/vi.mjs), and a rewrite renames prose, so a key travels in a form the rewrite
   copies byte for byte: a fenced block, or a code span. Nothing imports here, so both sides can. */

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

/* Keys resolving to none of the shape's is rewritten, not empty; and no body sources a derived one. */
export const readRecord = (body, shapeOf) => {
  const tag = TAG.exec(body ?? "");
  const shape = tag ? shapeOf(tag[1]) : null;
  if (!shape) return null;
  const fenced = payloadIn(body);
  const { entries, rewritten } = fenced ? { entries: fenced, rewritten: false } : labelledIn(body, shape);
  const fields = {};
  for (const field of [...shape.fields.filter((one) => !one.derived), ...(shape.stamp ? [shape.stamp] : [])]) {
    const held = valuesFor(entries, field);
    if (held !== undefined) fields[field.flag] = held;
  }
  return { kind: tag[1], contract: Number(tag[2]), fields, rewritten };
};

/* A number or nothing: a caller keys a map by this, and `NaN` is a key and an unsuppliable item. */
export const criterionNumber = (value) => {
  const found = /^\s*(\d+)/u.exec(String(value ?? ""));
  return found ? Number(found[1]) : null;
};

/* One wrapper, one source, and here rather than in the tracker: docs/cli/the-primitives.md. The fence a field comes back in is no part of it, and the mark's note is where the commit is. */
export const FENCE_PATTERN = String.raw`^⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧\s*$`;
const FENCE = new RegExp(FENCE_PATTERN, "gmu");
export const unwrap = (text) => String(text ?? "").replace(FENCE, "").trim();

const MARK = /^mark_merged\b/u;
const AT_SHA = /\bat ([0-9a-f]{7,40})\b/iu;
const HEAD_SHA = /\breviewed head ([0-9a-f]{7,40})\b/iu;
const JUDGED_SHA = /\bjudged head ([0-9a-f]{7,40})\b/iu;
const MOVED = /\blanding moved ([^;\n]+)/iu;
/* Enumerated, because matching it stands every verdict: `nothingness` and `nothing generated` are
   paths, and a clause that parses to no path at all says nothing rather than none. */
const NONE = /^nothing(?: of this change| this change touched)?\.?$/iu;

const lastMark = (comments) => {
  const marks = comments.map((one) => unwrap(one.body)).filter((body) => MARK.test(body));
  return marks.length ? marks.at(-1) : null;
};

export const markedCommit = (comments) => AT_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;
export const reviewedHead = (comments) => HEAD_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;
export const judgedHead = (comments) => JUDGED_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;

export const landingMoved = (comments) => {
  const said = MOVED.exec(lastMark(comments) ?? "")?.[1]?.trim();
  if (!said) return null;
  if (NONE.test(said)) return [];
  const paths = said.split(",").map((one) => one.trim()).filter(Boolean);
  return paths.length ? paths : null;
};

/* Machine data inside prose, read by this wording; `look` is optional, since FR-05 names two. */
const DECLARED = { screen: "screen change", schema: "schema coupling", look: "user-facing outcome" };
const lineFor = (name) => new RegExp(`${name}:\\s*(yes|no)\\b`, "iu");

export const planFlags = (plan) =>
  Object.fromEntries(Object.entries(DECLARED).map(([key, name]) =>
    [key, lineFor(name).exec(plan ?? "")?.[1]?.toLowerCase() ?? null]));

/** Which declaration asks for a person, beside the table it reads so no two readers name a different one. */
export const looksTo = ({ screen, look }) =>
  (look === "yes" ? "a user-facing outcome" : (screen === "yes" ? "a screen change" : null));

/* As far as `lineFor` reaches: one accepted mid-line and left bare is renamed, and declares nothing. */
const MACHINE = {
  plan: new RegExp(`(${Object.values(DECLARED).join("|")}):[ \\t]*(yes|no)\\b`, "gimu"),
};
/* The spans the rewrite keeps, in the shape it reads them: what is inside one is already safe, and
   a second pair of backticks in there would split the span and expose what it holds. */
const SPAN = /(`[^`\n]+`)/u;

export const protectMachine = (field, text) => {
  const pattern = MACHINE[field];
  if (!pattern) return text;
  return String(text)
    .split(new RegExp(SPAN.source, "gu"))
    .map((part, at) => (at % 2 ? part : part.replace(pattern, (_whole, name, value) => `\`${name}: ${value}\``)))
    .join("");
};

/* The mark is a reporter's own description line, which this flow does not rewrite, so the way back
   is a record — one direction: removing demands would unearn statuses already held. */
const RESIZE = /\bsize:\s*fix\s*(?:->|\u2192|to)\s*(?:feature|full)\b/iu;
export const resizeForm = (ref) =>
  `forge record correction ${ref} --moved "Size: fix -> feature" --why "<what the work turned out to be>"`;
const resized = (moved) => (moved ?? []).some((one) => RESIZE.test(String(one ?? "")));

/* What the size decides, in the one table the checks and the report both read. */
export const LIGHTER = [
  {
    status: "clarified",
    drops: "a decision record",
    because: "the reading that mattered is the defect, and the confirmation held it",
  },
  {
    status: "approved",
    drops: "the plan field, and the declarations it would carry, which absent read `no`",
    because: "a fix's criteria are the one check that fails without it, which is the whole of its plan",
  },
  {
    status: "released",
    drops: "a release note",
    because: "no person sees the change, so the withholding is the rule and not a record to type",
  },
];

/* A cut page never lightens: losing a re-size to it would shrink a shortfall others only grow. */
export const onLightPath = ({ fix, plan, moved, whole }) =>
  Boolean(fix) && Boolean(whole) && !resized(moved) && !looksTo(planFlags(plan));

/** The row is what lightens a status, so taking one out restores the demand and not just the report. */
export const lightens = (status, size) =>
  LIGHTER.some((one) => one.status === status) && onLightPath(size);

const WIDTH = 9;
const lighterLines = () => LIGHTER.map((one) =>
  `  ${`at ${one.status}`.padEnd(WIDTH + 5)}not owed: ${one.drops}\n  ${" ".repeat(WIDTH + 5)}  because ${one.because}`);

/* Both ways off the light path in the form each wants: a route a run must infer is the refusal it
   cannot act on. */
export const sizeReport = ({ fix, plan, moved, mark, whole }, ref) => {
  if (!fix) return null;
  if (resized(moved)) {
    return [`This issue was marked \`${mark}\` and a correction re-sized it, so the light path`,
      "no longer applies and every entry check below asks for the full set."].join("\n");
  }
  if (!whole) {
    return [`This issue is marked \`${mark}\`, and the page above was shortened: a cut cannot show`,
      "a correction that re-sized it, so the light path is not applied and the full set is asked."].join("\n");
  }
  const declared = looksTo(planFlags(plan));
  if (declared) {
    return [`This issue is marked \`${mark}\`, and its plan declares ${declared}, which is what`,
      "takes a fix off the light path: every entry check below asks for the full set."].join("\n");
  }
  return [
    `This issue is marked \`${mark}\`, so the entry checks run the contract's light path:`,
    ...lighterLines(),
    "Every other demand below stands as a feature's does — the confirmation with its where, the",
    "criteria, the baseline, the merged mark, the review of the head that landed, a verdict on every",
    "criterion, the verification, and the migration classification where a plan declares schema",
    "coupling, which the size never drops. Two ways off the light path, both belonging before the plan —",
    `  a plan declaring a screen change or a user-facing outcome:  forge plan ${ref} <plan.md>`,
    `  the work turned out larger:  ${resizeForm(ref)}`,
  ].join("\n");
};

/* What a payload of each kind holds, in the one table the write, the read-back and the usage
   list all read: a field named in two places is a shape that disagrees with itself. Kept beside
   the block it is written into, and importing nothing, so either side may reach it. */
export const FINDINGS = ["holds", "already-fixed", "duplicate", "intended", "obsolete", "premise-false"];
/* The status `closed` is entered from. Here, not beside ORDER: record.mjs cannot import earned.mjs. */
export const CLOSES_FROM = "released";
export const PARKS = [
  "question", "screen-review", "destructive-migration", "rolled-back", "no-way-back",
  "unshippable", "blocked", "paused", "crashed", "release-decision", "code-review", "dropped",
];
/* The three parks that speak to a reviewer, who cannot answer without the thing to look at. One
   list, because the read-back judges a park a hand wrote by the same rule the write applies. */
export const SHOWS_EVIDENCE = ["screen-review", "code-review", "destructive-migration"];
export const VERDICTS = ["pass", "fail", "skipped"];
/* What the agent may rule a person's finding to be: the criterion asked the wrong thing, the
   criterion was not met, or nothing in the specification ever promised what the person expected. */
export const TRIAGES = ["wrong-test", "not-met", "not-in-spec"];
export const OUTCOMES = ["approved", "changes-requested"];
const FINDING = /^F\d+ (?:accepted|rejected: .+)$/u;
export const SECTIONS = ["Added", "Changed", "Fixed", "Removed", "Security"];

/* `many` flags repeat; `oneOf` names the values; `least` is the smallest count that is a payload. */
const FIELD = (flag, label, extra = {}) => ({ flag, label, ...extra });

/* The shape `decision` established: a kind whose honest answer may be *none* asks for every field
   or for the reason there is none, and never for half of one, so an absent record and an unasked
   question stop reading the same. Checked here rather than by the field loop, which cannot see
   that one flag excuses three. */
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
      FIELD("where", "Where looked", { many: true }),
      FIELD("is", "What it is"),
      FIELD("finding", "Finding", { oneOf: FINDINGS }),
      FIELD("detail", "Detail", { optional: true }),
    ],
  },
  decision: {
    heading: "Decision record",
    fields: [FIELD("decision", "Decision", { many: true, least: 0 }), FIELD("none", "None found", { optional: true })],
    check: (got) => {
      if (!got.decision.length && !got.none) return "--decision (repeatable) or --none <why>";
      return null;
    },
  },
  question: {
    heading: "Question",
    fields: [FIELD("reading", "Reading", { many: true, least: 2 }), FIELD("to", "To", { optional: true })],
  },
  park: {
    heading: "Park",
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
  },
  baseline: {
    heading: "Baseline",
    fields: [FIELD("gate", "Gate"), FIELD("result", "Result"), FIELD("commit", "Commit", { commit: true })],
  },
  verdict: {
    heading: "Verdict",
    fields: [
      FIELD("criterion", "Criterion", { criterion: true }),
      FIELD("verdict", "Verdict", { oneOf: VERDICTS }),
      FIELD("commit", "Commit", { commit: true }),
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true, owed: OWES.verdict }),
      FIELD("why", "Why", { optional: true }),
    ],
    check: (got) => {
      if (got.verdict === "skipped" && !got.why) return "--why, for a skipped check";
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
      FIELD("evidence", "Evidence", { many: true, least: 1, evidence: true }),
      FIELD("review", "Review", { optional: true, derived: true }),
      FIELD("promotion", "Promotion", { optional: true, derived: true }),
    ],
  },
};
