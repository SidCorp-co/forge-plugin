/* The contract's payloads, each written in one shape a reader and a checker find alike, and read
   back by kind: docs/FORGE-CLI.md § record. The verb owns the shape; the tracker owns the fields. */
import { readFileSync } from "node:fs";

import { fail, translateTo } from "./resolve/settings.mjs";
import { pullRepeated, flags } from "./resolve/flags.mjs";
import { documentIdOf, rowsOf } from "./issues.mjs";
import { scoped, write } from "./rpc.mjs";
import { refuseIfGated, usageOf } from "./resolve/visibility.mjs";
import { nextLine, renew } from "./lease.mjs";

export const CONTRACT = 1;

/* Thrown, not exited: the helpers are tested in-process, and the verb turns one into a refusal.
   `advance` reads the same record and refuses the same way, so both share this one class. */
export class Refused extends Error {}
export const refuse = (message) => {
  throw new Refused(message);
};

export const FINDINGS = ["holds", "already-fixed", "duplicate", "intended", "obsolete", "premise-false"];
export const PARKS = [
  "question", "screen-review", "destructive-migration", "rolled-back", "no-way-back",
  "unshippable", "blocked", "paused", "crashed", "release-decision", "code-review", "dropped",
];
export const VERDICTS = ["pass", "fail", "skipped"];
export const OUTCOMES = ["approved", "changes-requested"];
const FINDING = /^F\d+ (?:accepted|rejected: .+)$/u;
export const SECTIONS = ["Added", "Changed", "Fixed", "Removed", "Security"];

const COMMIT = /^[0-9a-f]{7,40}$/iu;
/* The tracker fences what it returns as data; the fence is not part of the field. */
const FENCE = /^⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧\s*$/gmu;
export const unwrap = (text) => String(text ?? "").replace(FENCE, "").trim();
const URL_REF = /^https?:\/\//u;
const NUMBERED = /^(\d+)\.\s+(.*)$/u;

/* `many` flags repeat; `oneOf` names the values; `least` is the smallest count that is a payload. */
const FIELD = (flag, label, extra = {}) => ({ flag, label, ...extra });

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
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
    ],
    status: "Status left",
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
      FIELD("evidence", "Evidence", { many: true, least: 0, evidence: true }),
      FIELD("why", "Why", { optional: true }),
    ],
    check: (got) => {
      if (got.verdict === "skipped" && !got.why) return "--why, for a skipped check";
      if (got.verdict !== "skipped" && !got.evidence.length) return "--evidence (repeatable): a verdict with none is refused";
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
  verification: {
    heading: "Release verification",
    fields: [
      FIELD("where", "Where it runs"),
      FIELD("commit", "Commit", { commit: true }),
      FIELD("evidence", "Evidence", { many: true, least: 1, evidence: true }),
    ],
  },
};

export const KINDS = [...Object.keys(SHAPES), "note", "criteria", "report"];

export const USAGE = [
  usageOf("record"),
  "A contract payload, written in the one shape the CLI owns and read back by kind. A missing field",
  "is refused by name; the last line of every record names its kind and the contract version.",
  "",
  "  confirmation --where W... --is I --finding F [--detail D]   F: " + FINDINGS.join("|"),
  "  decision     --decision \"reading | assumption | undo\"... | --none <why>",
  "  question     --reading \"reading -> outcome\" (two or more) [--to who]",
  "  park         --kind K --why W [--evidence E]...             K: " + PARKS.join("|"),
  "  correction   --moved M --why W                                a plan or criteria change after approval",
  "  baseline     --gate G --result R --commit C",
  "  verdict      --criterion N --verdict pass|fail|skipped --commit C --evidence E... [--why W]",
  "  review       --reviewer R --commit C --outcome approved|changes-requested [--finding \"F1 accepted\"]...",
  "  verification --where W --commit C --evidence E...",
  "  note         --section S --user T [--technical T] | --skip --why W   S: " + SECTIONS.join("|"),
  "  criteria     <file.md|@file|->   numbered lines, one criterion each",
  "  report       the latest record of each kind, the latest verdict per criterion, and what is owed",
  "",
  "  --next <line>   on any kind that writes: the step whoever comes next starts on, onto the lease",
  "",
  "Evidence is an attachment name on the issue, a URL, or a commit of 7 to 40 hex digits.",
].join("\n");

const bodyFrom = (path) => (path === "-" ? readFileSync(0, "utf8") : readFileSync(path.replace(/^@/u, ""), "utf8"));

const wordIn = (word, text) => new RegExp(`(?:^|[^\\p{L}])${word}(?![\\p{L}])`, "iu").test(text);

/* The list follows the project's prose language, English where it names none: a warning at the
   write, never a refusal, because "and" also joins two nouns in one outcome. */
export const conjunctionsFor = (language = translateTo()) =>
  /^vi/iu.test(language ?? "") ? ["và", "hoặc", "cũng như", "đồng thời"] : ["and", "or", "as well as", "plus"];

export const criteriaLines = (text) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const match = NUMBERED.exec(line);
    if (!match) refuse(`Every criterion is a numbered line, \`N. outcome\`; this one is not:\n  ${line}`);
    const number = Number(match[1]);
    if (out.some((one) => one.number === number)) refuse(`Two criteria are numbered ${number}; a verdict names one by its number.`);
    out.push({ number, text: match[2] });
  }
  if (!out.length) refuse("No criteria given; an empty field is what Phase 5 cannot judge against.");
  return out;
};

export const joinedCriteria = (criteria, words) =>
  criteria.filter((one) => words.some((word) => wordIn(word, one.text))).map((one) => one.number);

/* Rendered for a person first: a heading, one line per field, and the parsed line last. */
export const render = (kind, fields, status = null) => {
  const shape = SHAPES[kind];
  const lines = [`## ${shape.heading}`, ""];
  for (const field of shape.fields) {
    const value = fields[field.flag];
    if (value === undefined || value === null || (Array.isArray(value) && !value.length)) continue;
    lines.push(`- **${field.label}:** ${Array.isArray(value) ? value.join("; ") : value}`);
  }
  if (shape.status && status) lines.push(`- **${shape.status}:** ${status}`);
  lines.push("", `\`forge-record: ${kind} · contract ${CONTRACT}\``);
  return lines.join("\n");
};

const TAG = /`?forge-record: ([a-z]+) · contract (\d+)`?\s*$/u;
const LINE = /^- \*\*([^*]+):\*\* (.*)$/u;

export const parse = (body) => {
  const tag = TAG.exec(unwrap(body));
  if (!tag || !SHAPES[tag[1]]) return null;
  const fields = {};
  for (const line of unwrap(body).split("\n")) {
    const match = LINE.exec(line.trim());
    if (match) fields[match[1]] = match[2];
  }
  return { kind: tag[1], contract: Number(tag[2]), fields };
};

const criterionOf = (record) => Number(/^(\d+)/u.exec(record.fields.Criterion ?? "")?.[1]);

/* Latest of each kind, latest verdict per criterion, and the criteria no verdict names. */
export const assemble = (comments, criteria) => {
  const records = comments
    .map((one) => ({ at: one.createdAt ?? "", record: parse(one.body ?? "") }))
    .filter((one) => one.record)
    .sort((a, b) => a.at.localeCompare(b.at));
  const latest = {};
  const verdicts = new Map();
  for (const { at, record } of records) {
    if (record.kind === "verdict") verdicts.set(criterionOf(record), { at, record });
    else latest[record.kind] = { at, record };
  }
  const owed = criteria.filter((one) => !verdicts.has(one.number)).map((one) => one.number);
  return { latest, verdicts, owed };
};

const printRecord = ({ at, record }) => {
  console.log(`${SHAPES[record.kind].heading}  (${at.slice(0, 16)}, contract ${record.contract})`);
  for (const [label, value] of Object.entries(record.fields)) console.log(`  ${label}: ${value}`);
};

export const issueOf = async (reference) => {
  const documentId = await documentIdOf(reference);
  const body = await scoped("forge_issues", { action: "get", documentId });
  return { documentId, body };
};

export const COMMENT_PAGE = 200;

/* The page is the tool's own maximum and it offers no cursor, so a fuller read cannot be asked
   for: a reader that judges the record has to say it saw only part of it. */
export const commentPage = (documentId) =>
  scoped("forge_comments", { action: "list", filters: { issue: documentId }, limit: COMMENT_PAGE }).then((got) => ({
    comments: rowsOf(got, "comments"),
    hasMore: Boolean(got?.hasMore),
  }));

export const attachmentNames = (body, comments) => [
  ...(body.attachments ?? []).map((one) => one.name),
  ...comments.flatMap((one) => (one.attachments ?? []).map((two) => two.name)),
];

export const evidenceHeld = (ref, names) => URL_REF.test(ref) || COMMIT.test(ref) || names.includes(ref);

export const checkEvidence = (refs, names) => {
  for (const ref of refs) {
    if (evidenceHeld(ref, names)) continue;
    refuse(
      `Evidence \`${ref}\` is no attachment on this issue, no URL and no commit. ` +
        `Attach it first (forge attach issue <ref> <file>), or cite a URL or a commit.` +
        (names.length ? `\n  Attached: ${names.join(", ")}` : ""),
    );
  }
};

/* One pass over the shape: every flag read, every rule applied, before anything is written. */
const gather = (kind, argv) => {
  const shape = SHAPES[kind];
  let rest = argv;
  const got = {};
  for (const field of shape.fields.filter((one) => one.many)) {
    const pulled = pullRepeated(rest, `--${field.flag}`, `record ${kind}`);
    got[field.flag] = pulled.values;
    rest = pulled.rest;
  }
  const single = flags(rest, `record ${kind}`);
  const known = new Set(shape.fields.map((one) => one.flag));
  for (const given of Object.keys(single)) {
    if (!known.has(given)) refuse(`record ${kind} takes no --${given}. Fields: ${[...known].map((one) => `--${one}`).join(" ")}`);
  }
  Object.assign(got, single);
  for (const field of shape.fields) {
    const value = got[field.flag];
    if (field.many) {
      const least = field.least ?? 1;
      if (value.length < least) refuse(`record ${kind} needs --${field.flag}${least > 1 ? ` ${least} or more times` : ""}.`);
      continue;
    }
    if (value === undefined) {
      if (!field.optional) refuse(`record ${kind} needs --${field.flag} (${field.label.toLowerCase()}).`);
      continue;
    }
    if (field.oneOf && !field.oneOf.includes(value)) {
      refuse(`--${field.flag} takes one of ${field.oneOf.join(", ")}, not \`${value}\`.`);
    }
    if (field.commit && !COMMIT.test(value)) refuse(`--commit takes 7 to 40 hex digits, not \`${value}\`.`);
    if (field.criterion && !/^\d+$/u.test(value)) refuse(`--criterion takes the criterion's number, not \`${value}\`.`);
  }
  const said = shape.check?.(got);
  if (said) refuse(`record ${kind} needs ${said}.`);
  return got;
};

export const post = async (documentId, body, ref = documentId, next = undefined) => {
  refuseIfGated("forge_comments");
  await renew(documentId, ref, next);
  const answer = await write("forge_comments", { action: "create", data: { issue: documentId, body } });
  console.log(body);
  return answer;
};

const recordShaped = async (kind, reference, argv, next) => {
  const got = gather(kind, argv);
  const { documentId, body } = await issueOf(reference);
  const shape = SHAPES[kind];
  if (shape.fields.some((one) => one.evidence) && got.evidence?.length) {
    checkEvidence(got.evidence, attachmentNames(body, (await commentPage(documentId)).comments));
  }
  if (kind === "verdict") {
    const held = criteriaLines(unwrap(body.acceptanceCriteria)).find((one) => one.number === Number(got.criterion));
    if (!held) refuse(`${reference} has no criterion ${got.criterion}; its field holds ${criteriaCount(body)}.`);
    got.criterion = `${held.number} — ${held.text}`;
  }
  return post(documentId, render(kind, got, shape.status ? body.status : null), reference, next);
};

const criteriaCount = (body) => {
  try {
    return `${criteriaLines(unwrap(body.acceptanceCriteria)).length} criteria`;
  } catch {
    return "no numbered criteria";
  }
};

/* Two forms, and a flag from the other one is refused rather than dropped. */
export const noteFrom = (argv) => {
  const { skip, ...rest } = flags(argv, "record note", ["--skip"]);
  const allowed = skip ? ["why", "technical"] : ["section", "user", "technical"];
  for (const given of Object.keys(rest)) {
    if (!allowed.includes(given)) {
      refuse(`record note${skip ? " --skip" : ""} takes ${allowed.map((one) => `--${one}`).join(" ")}, not --${given}.`);
    }
  }
  if (skip) {
    if (!rest.why) refuse("record note --skip needs --why: a withheld note says why it is withheld.");
    return { section: "Skip", userFacing: rest.why, technical: rest.technical ?? null };
  }
  if (!SECTIONS.includes(rest.section)) refuse(`--section takes one of ${SECTIONS.join(", ")}, or --skip --why.`);
  if (!rest.user) refuse("record note needs --user: what the reporter will now see, in their words.");
  return { section: rest.section, userFacing: rest.user, technical: rest.technical ?? null };
};

/* The read-back is owed here for the reason it is owed on `plan`, stated once beside that verb. */
const updateField = async (documentId, field, value, same, ref, next) => {
  await renew(documentId, ref, next);
  await write("forge_issues", { action: "update", documentId, data: { [field]: value } });
  const back = await scoped("forge_issues", { action: "get", documentId, fields: [field] });
  if (!same(back?.[field])) refuse(`The update answered success but ${field} did not read back as written. Nothing to rely on.`);
};

const recordNote = async (reference, argv, next) => {
  const releaseNotes = noteFrom(argv);
  const { documentId } = await issueOf(reference);
  const same = (held) => ["section", "userFacing", "technical"].every((key) => (held?.[key] ?? null) === releaseNotes[key]);
  await updateField(documentId, "releaseNotes", releaseNotes, same, reference, next);
  console.log(JSON.stringify(releaseNotes, null, 2));
};

const recordCriteria = async (reference, [path, ...extra], next) => {
  if (!path) refuse("record criteria takes the file holding the numbered lines, or - for stdin.");
  if (extra.length) refuse(`record criteria takes one file and nothing after it, not \`${extra.join(" ")}\`.`);
  const criteria = criteriaLines(bodyFrom(path));
  const joined = joinedCriteria(criteria, conjunctionsFor());
  const { documentId } = await issueOf(reference);
  const acceptanceCriteria = criteria.map((one) => `${one.number}. ${one.text}`).join("\n");
  await updateField(documentId, "acceptanceCriteria", acceptanceCriteria, (held) => unwrap(held) === acceptanceCriteria, reference, next);
  for (const number of joined) {
    console.error(`criterion ${number} holds a conjunction: is it two? A verdict judges one outcome.`);
  }
  console.log(acceptanceCriteria);
};

const recordReport = async (reference) => {
  const { documentId, body } = await issueOf(reference);
  let criteria = [];
  try {
    criteria = criteriaLines(unwrap(body.acceptanceCriteria));
  } catch {
    criteria = [];
  }
  const { comments, hasMore } = await commentPage(documentId);
  if (hasMore) console.error(`More than ${COMMENT_PAGE} comments match and the list stops there: this report read the first ${COMMENT_PAGE}.`);
  const { latest, verdicts, owed } = assemble(comments, criteria);
  for (const kind of Object.keys(SHAPES)) if (latest[kind]) printRecord(latest[kind]);
  for (const number of [...verdicts.keys()].sort((a, b) => a - b)) printRecord(verdicts.get(number));
  if (body.releaseNotes?.section) console.log(`Release note  ${body.releaseNotes.section}: ${body.releaseNotes.userFacing}`);
  console.log(owed.length ? `\nOwed: a verdict on criterion ${owed.join(", ")}.` : `\nEvery criterion has a verdict.`);
};

/* Pulled before the kind is dispatched, so no shape gains a field: the line is about the run and
   not about the payload, and `criteria` takes a bare path where a shape takes flags. */
const pullNext = (argv) => {
  const at = argv.indexOf("--next");
  if (at < 0) return { next: undefined, rest: argv };
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) refuse("record: --next was given no value.");
  return { next: nextLine(value), rest: [...argv.slice(0, at), ...argv.slice(at + 2)] };
};

const run = async ([kind, reference, ...argv]) => {
  if (!kind || kind === "-h" || kind === "--help") return console.log(USAGE);
  if (!KINDS.includes(kind)) refuse(`record knows no kind \`${kind}\`. Kinds: ${KINDS.join(", ")}.`);
  if (!reference) refuse(USAGE.split("\n")[0]);
  const { next, rest } = pullNext(argv);
  if (kind === "note") return recordNote(reference, rest, next);
  if (kind === "criteria") return recordCriteria(reference, rest, next);
  if (kind === "report") {
    if (next !== undefined) refuse("record report writes nothing, so it renews no lease and carries no --next.");
    return recordReport(reference);
  }
  return recordShaped(kind, reference, rest, next);
};

export const record = async (argv) => {
  try {
    await run(argv);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
record.answersHelp = true;
