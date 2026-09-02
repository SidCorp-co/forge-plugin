/* The contract's payloads, each written in one shape a reader and a checker find alike, and read
   back by kind: docs/FORGE-CLI.md § record. The verb owns the shape; the tracker owns the fields. */
import { readFileSync } from "node:fs";

import { fail, translateTo } from "./resolve/settings.mjs";
import { pullRepeated, flags } from "./resolve/flags.mjs";
import { documentIdOf, rowsOf } from "./issues.mjs";
import { scoped, write } from "./rpc.mjs";
import { refuseIfGated, usageOf } from "./resolve/visibility.mjs";

export const CONTRACT = 1;

/* Thrown, not exited: the helpers are tested in-process, and the verb turns one into a refusal. */
class Refused extends Error {}
const refuse = (message) => {
  throw new Refused(message);
};

export const FINDINGS = ["holds", "already-fixed", "duplicate", "intended", "obsolete", "premise-false"];
export const PARKS = [
  "question", "screen-review", "destructive-migration", "rolled-back", "no-way-back",
  "unshippable", "blocked", "paused", "crashed", "release-decision",
];
export const VERDICTS = ["pass", "fail", "skipped"];
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
  "  verification --where W --commit C --evidence E...",
  "  note         --section S --user T [--technical T] | --skip --why W   S: " + SECTIONS.join("|"),
  "  criteria     <file.md|@file|->   numbered lines, one criterion each",
  "  report       the latest record of each kind, the latest verdict per criterion, and what is owed",
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

const issueOf = async (reference) => {
  const documentId = await documentIdOf(reference);
  const body = await scoped("forge_issues", { action: "get", documentId });
  return { documentId, body };
};

const commentsOf = (documentId) =>
  scoped("forge_comments", { action: "list", filters: { issue: documentId }, limit: 200 }).then((got) =>
    rowsOf(got, "comments"),
  );

const attachmentNames = (body, comments) => [
  ...(body.attachments ?? []).map((one) => one.name),
  ...comments.flatMap((one) => (one.attachments ?? []).map((two) => two.name)),
];

const checkEvidence = (refs, names) => {
  for (const ref of refs) {
    if (URL_REF.test(ref) || COMMIT.test(ref) || names.includes(ref)) continue;
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

const post = async (documentId, body) => {
  refuseIfGated("forge_comments");
  const answer = await write("forge_comments", { action: "create", data: { issue: documentId, body } });
  console.log(body);
  return answer;
};

const recordShaped = async (kind, reference, argv) => {
  const got = gather(kind, argv);
  const { documentId, body } = await issueOf(reference);
  const shape = SHAPES[kind];
  if (shape.fields.some((one) => one.evidence) && got.evidence?.length) {
    checkEvidence(got.evidence, attachmentNames(body, await commentsOf(documentId)));
  }
  if (kind === "verdict") {
    const held = criteriaLines(unwrap(body.acceptanceCriteria)).find((one) => one.number === Number(got.criterion));
    if (!held) refuse(`${reference} has no criterion ${got.criterion}; its field holds ${criteriaCount(body)}.`);
    got.criterion = `${held.number} — ${held.text}`;
  }
  return post(documentId, render(kind, got, shape.status ? body.status : null));
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

/* A field accepted and dropped answers like one stored, so the field is read back before success. */
const updateField = async (documentId, field, value, same) => {
  await write("forge_issues", { action: "update", documentId, data: { [field]: value } });
  const back = await scoped("forge_issues", { action: "get", documentId, fields: [field] });
  if (!same(back?.[field])) refuse(`The update answered success but ${field} did not read back as written. Nothing to rely on.`);
};

const recordNote = async (reference, argv) => {
  const releaseNotes = noteFrom(argv);
  const { documentId } = await issueOf(reference);
  const same = (held) => ["section", "userFacing", "technical"].every((key) => (held?.[key] ?? null) === releaseNotes[key]);
  await updateField(documentId, "releaseNotes", releaseNotes, same);
  console.log(JSON.stringify(releaseNotes, null, 2));
};

const recordCriteria = async (reference, [path, ...extra]) => {
  if (!path) refuse("record criteria takes the file holding the numbered lines, or - for stdin.");
  if (extra.length) refuse(`record criteria takes one file and nothing after it, not \`${extra.join(" ")}\`.`);
  const criteria = criteriaLines(bodyFrom(path));
  const joined = joinedCriteria(criteria, conjunctionsFor());
  const { documentId } = await issueOf(reference);
  const acceptanceCriteria = criteria.map((one) => `${one.number}. ${one.text}`).join("\n");
  await updateField(documentId, "acceptanceCriteria", acceptanceCriteria, (held) => unwrap(held) === acceptanceCriteria);
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
  const { latest, verdicts, owed } = assemble(await commentsOf(documentId), criteria);
  for (const kind of Object.keys(SHAPES)) if (latest[kind]) printRecord(latest[kind]);
  for (const number of [...verdicts.keys()].sort((a, b) => a - b)) printRecord(verdicts.get(number));
  if (body.releaseNotes?.section) console.log(`Release note  ${body.releaseNotes.section}: ${body.releaseNotes.userFacing}`);
  console.log(owed.length ? `\nOwed: a verdict on criterion ${owed.join(", ")}.` : `\nEvery criterion has a verdict.`);
};

const run = async ([kind, reference, ...rest]) => {
  if (!kind || kind === "-h" || kind === "--help") return console.log(USAGE);
  if (!KINDS.includes(kind)) refuse(`record knows no kind \`${kind}\`. Kinds: ${KINDS.join(", ")}.`);
  if (!reference) refuse(USAGE.split("\n")[0]);
  if (kind === "note") return recordNote(reference, rest);
  if (kind === "criteria") return recordCriteria(reference, rest);
  if (kind === "report") return recordReport(reference);
  return recordShaped(kind, reference, rest);
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
