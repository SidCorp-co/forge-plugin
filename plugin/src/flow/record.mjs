/* The contract's payloads, each written in one shape a reader and a checker find alike, and read
   back by kind: docs/cli/record.md. The verb owns the shape; the tracker owns the fields. */
import { fail, translateTo } from "../resolve/settings.mjs";
import {
  CLOSES_FROM, FINDINGS, PARKS, SECTIONS, SHAPES, TRIAGES, blockOf, criterionNumber, markedCommit,
  readRecords, tagFor, unwrap,
} from "./machine.mjs";
import { bodyFrom } from "../resolve/payload.mjs";
import { FLAG_WORD, noValue, pullRepeated, flags, wantsHelp } from "../resolve/flags.mjs";
import { commentPage, cutLine, postComment } from "../tracker/comments.mjs";
import { attachPlan, attachmentNames, evidenceHeld, evidenceProblem, isCommit, strandedLine, uploadTo }
  from "../tracker/evidence.mjs";
import { CONTRACT } from "../tracker/contract.mjs";
import { releaseLine, releasePolicy } from "../tracker/project-config.mjs";
import { documentIdOf } from "../tracker/issues.mjs";
import { scoped, write } from "../tracker/rpc.mjs";
import { refuseIfGated, usageOf } from "../resolve/visibility.mjs";
import { didYouMean } from "../suggest.mjs";
import { FIELD as SESSION, nextLine, renew } from "./lease.mjs";
import { OPEN_KEPT, patchFrom, worklogLines, worklogOf } from "./worklog.mjs";

/* Thrown, not exited: the helpers are tested in-process, and the verb turns one into a refusal.
   `advance` reads the same record and refuses the same way, so both share this one class. */
export class Refused extends Error {}
export const refuse = (message) => {
  throw new Refused(message);
};

const NUMBERED = /^(\d+)\.\s+(.*)$/u;

/* Named once: `pullRun` strips them, and `criteria` offers them back to a caller who typed one. */
const RUN_FLAGS = ["--open", "--next", "--pushed", "--review"];
const [OPEN, NEXT, ...TOGGLES] = RUN_FLAGS;

const CRITERIA_BODY = "record criteria takes the file holding the numbered lines, or - for stdin.";

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
  "  routed       --what W --to T [--evidence E]... | --none <why>   a finding this run sent elsewhere",
  "  gap          --where W --lacked L --did D | --none <why>       where the method did not answer",
  "  verification --where W --commit C --evidence E...",
  "  finding      --expected E --seen S --evidence E... --quoted Q [--criterion N | --uc UC-nn-m]",
  "  triage       --outcome O --would-have-caught W [--detail D]  O: " + TRIAGES.join("|"),
  "  note         --section S --user T [--technical T] | --skip --why W   S: " + SECTIONS.join("|"),
  "  criteria     <file.md|@file|->   numbered lines, one criterion each",
  "  report       the latest record of each kind, the latest verdict per criterion, and what is owed",
  "",
  "--criterion repeats: each one opens a block, and one write carries a verdict on every criterion",
  "it names. What stands before the first --criterion is every block's, so one commit and one",
  "evidence set cover them all. A block's own value of a flag taking one replaces the shared one; a",
  "repeatable flag adds to it, so a criterion whose evidence is its own cites that too:",
  "  record verdict ISS-45 --commit <sha> --evidence run.txt --verdict pass \\",
  "    --criterion 1 --criterion 2 --criterion 3 --verdict fail --why \"<what failed>\"",
  "A file two criteria cite goes up once, under the one name both of them carry. Each block reads",
  "back as the record a single write makes, so nothing downstream can tell one write from three.",
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
  "--commit and --evidence are read off the record where the flag is absent: the commit from the",
  "merged mark's note, the evidence from what the latest record of this kind cited. Each is printed.",
].join("\n");


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

/* A heading for a person, the payload in a fenced block the prose rewrite copies byte for byte, and
   the tag last in a code span for the same reason. The stamp is read off the issue at the write —
   which status a park left, which reopen a finding belongs to — and is no flag, because a value the
   author could type is one they could get wrong about the very thing the record is matched by. */
export const render = (kind, blocks, status = null) => {
  const shape = SHAPES[kind];
  /* Each block whole, so one of them is byte for byte the record a single write makes. */
  const entries = (Array.isArray(blocks) ? blocks : [blocks]).flatMap((fields) => shape.fields
    .map((field) => [field.flag, fields[field.flag]])
    .filter(([, value]) => !(value === undefined || value === null || (Array.isArray(value) && !value.length))));
  if (shape.stamp && status) entries.push([shape.stamp.flag, status]);
  return [`## ${shape.heading}`, "", blockOf(entries), "", tagFor(kind, CONTRACT)].join("\n");
};

export const parseAll = (body) => readRecords(unwrap(body), (kind) => SHAPES[kind]);

/* The first block: for readers asking about the comment rather than about a criterion. */
export const parse = (body) => parseAll(body)[0] ?? null;

const criterionOf = (record) => criterionNumber(record.fields.criterion);

/* Latest of each kind, latest verdict per criterion, and the criteria no verdict names. */
export const assemble = (comments, criteria) => {
  const records = comments
    .flatMap((one) => parseAll(one.body ?? "").map((record) => ({ at: one.createdAt ?? "", record })))
    .sort((a, b) => a.at.localeCompare(b.at));
  const latest = {};
  const verdicts = new Map();
  const repeated = {};
  /* A verdict whose criterion this build cannot read is kept apart rather than keyed by what the
     read produced: keying by that is how an owed list came to name a criterion `NaN`. */
  const unreadable = [];
  for (const { at, record } of records) {
    if (record.kind === "verdict") {
      const number = criterionOf(record);
      if (number === null) unreadable.push({ at, record });
      else verdicts.set(number, { at, record });
      continue;
    }
    latest[record.kind] = { at, record };
    if (SHAPES[record.kind].repeats) (repeated[record.kind] ??= []).push({ at, record });
  }
  const owed = criteria.filter((one) => !verdicts.has(one.number)).map((one) => one.number);
  return { latest, verdicts, owed, repeated, unreadable };
};

/* The label is the shape's, never the record's: a record carries keys, and two forms of one record
   read back under one heading. A rewritten one carries no key and says so instead of nothing. */
const printRecord = ({ at, record }) => {
  const shape = SHAPES[record.kind];
  console.log(`${shape.heading}  (${at.slice(0, 16)}, contract ${record.contract})`);
  if (record.rewritten) return console.log("  rewritten by the prose pipeline: no field of this shape reads back");
  for (const field of [...shape.fields, ...(shape.stamp ? [shape.stamp] : [])]) {
    const value = record.fields[field.flag];
    if (value === undefined || (Array.isArray(value) && !value.length)) continue;
    for (const one of Array.isArray(value) ? value : [value]) console.log(`  ${field.label}: ${one}`);
  }
};

export const issueOf = async (reference) => {
  const documentId = await documentIdOf(reference);
  const body = await scoped("forge_issues", { action: "get", documentId });
  return { documentId, body };
};

/* Filled from the record where the flag is absent (ISS-65): the merged mark holds the commit and
   the issue holds the one attachment, so a verdict loop typed neither. Deferred rather than
   defaulted here, because the values arrive with the issue and a flag error must cost no call. */
export const DEFERRED = ["commit", "evidence"];

/* One pass over the shape: every flag read, every rule applied, before anything is written. */
const gather = (kind, argv, defer = []) => {
  const shape = SHAPES[kind];
  let rest = argv;
  const got = {};
  for (const field of shape.fields.filter((one) => one.many)) {
    const pulled = pullRepeated(rest, `--${field.flag}`, `record ${kind}`);
    got[field.flag] = pulled.values;
    rest = pulled.rest;
  }
  const single = flags(rest, `record ${kind}`);
  const known = new Set(shape.fields.filter((one) => !one.derived).map((one) => one.flag));
  for (const given of Object.keys(single)) {
    if (!known.has(given)) refuse(`record ${kind} takes no --${given}. Fields: ${[...known].map((one) => `--${one}`).join(" ")}`);
  }
  Object.assign(got, single);
  for (const field of shape.fields) {
    const value = got[field.flag];
    if (field.many) {
      const least = field.least ?? 1;
      if (value.length < least && !defer.includes(field.flag)) {
        refuse(`record ${kind} needs --${field.flag}${least > 1 ? ` ${least} or more times` : ""}.`);
      }
      continue;
    }
    if (value === undefined) {
      if (!field.optional && !defer.includes(field.flag)) {
        refuse(`record ${kind} needs --${field.flag} (${field.label.toLowerCase()}).`);
      }
      continue;
    }
    if (field.oneOf && !field.oneOf.includes(value)) {
      refuse(`--${field.flag} takes one of ${field.oneOf.join(", ")}, not \`${value}\`.`);
    }
    if (field.commit && !isCommit(value)) refuse(`--commit takes 7 to 40 hex digits, not \`${value}\`.`);
    if (field.criterion && !/^\d+$/u.test(value)) refuse(`--criterion takes the criterion's number, not \`${value}\`.`);
  }
  return got;
};

export const checked = (kind, got) => {
  const said = SHAPES[kind].check?.(got);
  if (said) refuse(`record ${kind} needs ${said}.`);
};

/* What the stored copy will be, said where the write is made: the payload block is the record and
   travels as written, and everything a rewrite reaches is prose around it. */
const REWRITTEN = {
  record: "the payload block is stored as written; the heading above it is rewritten",
  criteria: "the criteria are rewritten, and the numbers a verdict names are what survives",
  note: "the user-facing half is rewritten and the technical half is stored as written",
};

export const sayStored = (which, language = translateTo()) => {
  if (!language) return null;
  const said = `prose ${language}: ${REWRITTEN[which]}.`;
  console.error(said);
  return said;
};

/* The ladder under the write that just landed (ISS-285), on stderr because stdout is the record;
   imported at the call, since `route.mjs` reads this module; and never a record's own failure. The
   write counts itself, stamped by the tracker or no earlier than the newest row it would sort under. */
const stampedLast = (comments, written) => String(written?.createdAt
  ?? [new Date().toISOString(), ...comments.map((one) => String(one.createdAt ?? ""))].sort().at(-1));
const sayOwed = async (documentId, issue, ref, held = null) => {
  try {
    const { owedSaid } = await import("./route.mjs");
    const page = held ?? await commentPage(documentId);
    const cut = held ? held.cut : (page.hasMore ? cutLine(page) : null);
    console.error(await owedSaid(documentId, issue, page.comments, ref, cut));
  } catch (error) {
    console.error(`what this write now owes could not be read: ${error.message}`);
  }
};

export const post = async (documentId, body, ref = documentId, next = undefined, patch = null) => {
  refuseIfGated("forge_comments");
  sayStored("record");
  await renew(documentId, ref, next, patch);
  const answer = await postComment(documentId, body);
  console.log(body);
  return answer;
};

/* Read off the record rather than off the issue: what this issue's evidence is belongs to whoever
   wrote the first record of the kind, and the rest of a loop inherit that citation rather than a
   guess. Not per criterion — one document answers twenty of them, which is the loop it removes. */
const citedBy = (comments, kind) =>
  comments.flatMap((one) => parseAll(one.body ?? "")).filter((one) => one.kind === kind).at(-1)?.fields.evidence ?? [];

/* An upload is refused where the page was cut rather than risked past it: a name it has to be
   unique against may live on a comment the cut held back, and one attached twice is two documents. */
const CROWDED = (kind, cut) => `record ${kind} would put a file up, and the names already on this `
  + `issue cannot be read whole. ${cut} A name attached twice resolves to two documents, and every `
  + `record citing it is then ambiguous. Cite a URL or a commit, or attach the file under a name `
  + `nothing else could carry and cite that.`;

/* A default read off the page is the latest of its kind, the cut keeping the most recent. Found
   nowhere, on a cut page, it may be the comment behind it, so the flag is asked for (ISS-131). */
const BEHIND = (kind, flag, cut) => `record ${kind} reads --${flag} off this issue and the page `
  + `carries none to read. ${cut} The one that would answer may be a comment behind the cut, so `
  + `name --${flag} for this write.`;

/* The record answers for the flag it was not given, and says where the value came from: a default
   nobody can see is one nobody can catch being wrong. Where it cannot answer, the refusal says what
   the issue does carry, because the old one named a flag and left the reader to go and look. */
export const fromRecord = (kind, got, { comments, names, cut = null }, say = console.error) => {
  const shape = SHAPES[kind];
  const commit = shape.fields.find((one) => one.commit);
  if (commit && got.commit === undefined) {
    const marked = markedCommit(comments);
    if (!marked && cut) refuse(BEHIND(kind, "commit", cut));
    if (!marked) {
      refuse(`record ${kind} needs --commit (${commit.label.toLowerCase()}), and no merged mark on `
        + "this issue names one to read it from.");
    }
    got.commit = marked;
    say(`--commit ${marked}, from the merged mark's note.`);
  }
  const evidence = shape.fields.find((one) => one.evidence);
  /* Asked of the field, never inferred from the check: a check refusing something else entirely
     would otherwise read as the shape asking for evidence. */
  if (!evidence || got[evidence.flag]?.length) return;
  if ((evidence.least ?? 1) < 1 && !evidence.owed?.(got)) return;
  /* The author's own earlier citation, never the attachment set: a lone document the issue happens
     to carry is nobody's citation of it, and the first record of a loop still names one. */
  const before = citedBy(comments, kind).filter((one) => evidenceHeld(one, names));
  if (!before.length && cut) refuse(BEHIND(kind, evidence.flag, cut));
  if (!before.length) {
    refuse(`record ${kind} needs --evidence (repeatable), and no ${kind} on this issue cites one to `
      + `read it from. This issue carries `
      + `${names.length ? `${names.length} attachment(s): ${names.join(", ")}` : "no attachment"}. `
      + "Name an attachment, a URL, a commit, or a file to put up.");
  }
  got[evidence.flag] = before;
  say(`--evidence ${before.join(", ")}, as the latest ${kind} on this issue cites it.`);
};

/* From the project's config, because a line an author could type proves only that they typed it. */
const derive = async (kind, blocks) => {
  if (kind !== "verification") return;
  const held = releaseLine(await releasePolicy());
  if (held) for (const got of blocks) got[held[0]] = held[1];
};

/* The argv split by the rule `groupsIn` splits the payload by, so what one call writes is what the
   reader hands back as several records. One commit and one evidence set over fourteen criteria. */
export const blocksIn = (argv, per) => {
  const flag = `--${per}`;
  const opens = per ? argv.indexOf(flag) : -1;
  if (opens < 0) return [argv];
  const shared = argv.slice(0, opens);
  const blocks = [];
  for (const token of argv.slice(opens)) {
    if (token === flag) blocks.push([...shared]);
    blocks.at(-1).push(token);
  }
  return blocks;
};

/* Refused here and nowhere later, and by the number the reader keys by, so `01` and `1` are one:
   the map every check keys keeps the last of two blocks naming one, and says so nowhere. */
const blocksOf = (kind, argv) => {
  const shape = SHAPES[kind];
  const blocks = blocksIn(argv, shape.per).map((one) => gather(kind, one, DEFERRED));
  const seen = new Set();
  for (const got of blocks) {
    const named = got[shape.per];
    if (named === undefined) continue;
    const key = criterionNumber(named) ?? named;
    if (seen.has(key)) {
      refuse(`This write names ${shape.per} ${key} twice. A ${kind} judges one ${shape.per}, and `
        + `the second block would replace the first with nothing on the record saying so.`);
    }
    seen.add(key);
  }
  return blocks;
};

/* One plan over what every block cites: a document three criteria prove goes up once under the one
   name all three carry, so the collision `attachPlan` refuses is never this write citing its own. */
const citeOnce = (kind, blocks, { held, cut }) => {
  const refs = [...new Set(blocks.flatMap((one) => one.evidence ?? []))];
  if (!refs.length) return null;
  const plan = attachPlan(refs, held, (ref) => evidenceHeld(ref, held));
  if (plan.refusal) refuse(plan.refusal);
  if (cut && plan.upload.length) refuse(CROWDED(kind, cut));
  const cited = new Map(refs.map((one, at) => [one, plan.cite[at]]));
  for (const one of blocks) one.evidence = one.evidence.map((ref) => cited.get(ref));
  return plan;
};

/* A criterion is named by number and quoted as it stood, because the field can change later and the
   record has to say what it was about. Read off the shape, so every kind that cites one does it the
   same way and a citation of a criterion the issue has not got is refused. */
const quoteCriteria = (kind, blocks, body, reference) => {
  const cites = SHAPES[kind].fields.find((one) => one.criterion);
  if (!cites) return;
  let lines = null;
  for (const got of blocks) {
    if (got[cites.flag] === undefined) continue;
    lines ??= criteriaLines(unwrap(body.acceptanceCriteria));
    const held = lines.find((one) => one.number === Number(got[cites.flag]));
    if (!held) refuse(`${reference} has no criterion ${got[cites.flag]}; its field holds ${criteriaCount(body)}.`);
    got[cites.flag] = `${held.number} — ${held.text}`;
  }
};

const recordShaped = async (kind, reference, argv, { next, patch }) => {
  const shape = SHAPES[kind];
  const blocks = blocksOf(kind, argv);
  const { documentId, body } = await issueOf(reference);
  const asks = shape.fields.some((one) => one.evidence || one.commit);
  const page = asks ? await commentPage(documentId) : { comments: [], hasMore: false };
  const { comments } = page;
  const cut = page.hasMore ? cutLine(page) : null;
  const held = attachmentNames(body, comments);
  const plan = citeOnce(kind, blocks, { held, cut });
  const names = [...held, ...(plan?.upload ?? []).map((one) => one.name)];
  /* Every block fills from the same record; three copies of one line is reading the write spared. */
  const spoken = new Set();
  const say = (line) => {
    if (spoken.has(line)) return;
    spoken.add(line);
    console.error(line);
  };
  for (const got of blocks) {
    if (asks) fromRecord(kind, got, { comments, names, cut }, say);
    checked(kind, got);
    const bad = got.evidence?.length ? evidenceProblem(got.evidence, names) : null;
    if (bad) refuse(bad);
  }
  await derive(kind, blocks);
  quoteCriteria(kind, blocks, body, reference);
  const stamp = shape.stamp ? String(body[shape.stamp.from ?? "status"] ?? "") : null;
  /* Asked here as well as in `post`, because a record that cannot be posted must not leave its
     evidence up: the two calls are one refusal a caller can act on and one nothing may skip. */
  refuseIfGated("forge_comments");
  /* Sent once every refusal the record's own shape can earn has been earned, and named from the
     line before the PUT: a file the tracker took with the answer lost is up all the same. */
  const sent = [];
  const stranded = (code) => code && sent.length && console.error(strandedLine(sent, reference));
  process.once("exit", stranded);
  for (const one of plan?.upload ?? []) {
    await renew(documentId, reference);
    await uploadTo("issue", documentId, one.path, (name) => sent.push(name));
  }
  const rendered = render(kind, blocks, stamp);
  const written = await post(documentId, rendered, reference, next, patch);
  /* Dropped on the way out and never in a `finally`: a thrown failure unwinds through one before the
     exit, and the notice would be gone for every route but `fail()`'s. */
  process.off("exit", stranded);
  const posted = { documentId: written?.documentId ?? null, createdAt: stampedLast(comments, written), body: rendered };
  await sayOwed(documentId, body, reference, asks ? { comments: [...comments, posted], cut } : null);
  return written;
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

/* The read-back is owed here for the reason it is owed on `plan`, stated once beside that verb, and
   it compares the copy the boundary sent: a project with a prose language sends a rewrite of what it
   was handed, and comparing the source would refuse every write that landed. */
const updateField = async (documentId, field, value, same, ref, next, patch) => {
  await renew(documentId, ref, next, patch);
  let sent = value;
  await write("forge_issues", { action: "update", documentId, data: { [field]: value } }, (data) => {
    sent = data?.[field] ?? value;
  });
  const back = await scoped("forge_issues", { action: "get", documentId, fields: [field] });
  if (!same(back?.[field], sent)) refuse(`The update answered success but ${field} did not read back as written. Nothing to rely on.`);
};

/* Unfenced and trimmed, the source marker being the tracker's own wrapping of a prose field. */
export const landedAs = (held, sent) => unwrap(held) === String(sent).trim();

/* A note is an object, so it is read back half by half and normalised nowhere: those three are held
   as sent, and a comparison loose enough to accept an empty half stops saying the write landed. */
export const noteLandedAs = (held, sent) =>
  ["section", "userFacing", "technical"].every((key) => (held?.[key] ?? null) === (sent?.[key] ?? null));

const recordNote = async (reference, argv, { next, patch }) => {
  const releaseNotes = noteFrom(argv);
  const { documentId, body } = await issueOf(reference);
  sayStored("note");
  await updateField(documentId, "releaseNotes", releaseNotes, noteLandedAs, reference, next, patch);
  console.log(JSON.stringify(releaseNotes, null, 2));
  await sayOwed(documentId, { ...body, releaseNotes }, reference);
};

const recordCriteria = async (reference, [path, ...extra], { next, patch }) => {
  if (!path) refuse(CRITERIA_BODY);
  if (path.startsWith("--")) refuse(`${didYouMean("record criteria flag", path, RUN_FLAGS)} ${CRITERIA_BODY}`);
  if (extra.length) refuse(`record criteria takes one file and nothing after it, not \`${extra.join(" ")}\`.`);
  const criteria = criteriaLines(await bodyFrom(path));
  const joined = joinedCriteria(criteria, conjunctionsFor());
  const { documentId, body } = await issueOf(reference);
  const acceptanceCriteria = criteria.map((one) => `${one.number}. ${one.text}`).join("\n");
  sayStored("criteria");
  await updateField(documentId, "acceptanceCriteria", acceptanceCriteria, landedAs, reference, next, patch);
  for (const number of joined) {
    console.error(`criterion ${number} holds a conjunction: is it two? A verdict judges one outcome.`);
  }
  console.log(acceptanceCriteria);
  await sayOwed(documentId, { ...body, acceptanceCriteria }, reference);
};

const recordReport = async (reference) => {
  const { documentId, body } = await issueOf(reference);
  let criteria = [];
  try {
    criteria = criteriaLines(unwrap(body.acceptanceCriteria));
  } catch {
    criteria = [];
  }
  const page = await commentPage(documentId);
  const { comments } = page;
  if (page.hasMore) console.error(`${cutLine(page)} This report was assembled from those rows and `
    + "from no others.");
  const { latest, verdicts, owed, repeated, unreadable } = assemble(comments, criteria);
  for (const kind of Object.keys(SHAPES)) {
    if (SHAPES[kind].repeats) for (const one of repeated[kind] ?? []) printRecord(one);
    else if (latest[kind]) printRecord(latest[kind]);
  }
  for (const number of [...verdicts.keys()].sort((a, b) => a - b)) printRecord(verdicts.get(number));
  for (const one of unreadable) printRecord(one);
  if (body.releaseNotes?.section) console.log(`Release note  ${body.releaseNotes.section}: ${body.releaseNotes.userFacing}`);
  /* The run's own captures: no payload, and all of what a fold asks for beyond the payloads. */
  const lines = worklogLines(worklogOf(body[SESSION]));
  if (lines.length) console.log(["", "The run, from its own captures:", ...lines.map((one) => `  ${one}`)].join("\n"));
  console.log(owed.length ? `\nOwed: a verdict on criterion ${owed.join(", ")}.` : `\nEvery criterion has a verdict.`);
  /* A run's end is measured by `closed`, and five of one day's runs stopped short of it (ISS-105). */
  if (body.status === CLOSES_FROM) {
    console.log(`Owed: the close. A run ends at closed, not at ${CLOSES_FROM}:\n  forge advance ${reference}`);
  }
};

const pullOne = (argv, flag) => {
  const at = argv.indexOf(flag);
  if (at < 0) return { value: undefined, rest: argv };
  const value = argv[at + 1];
  if (value === undefined || FLAG_WORD.test(value)) refuse(noValue("record", flag, value));
  return { value, rest: [...argv.slice(0, at), ...argv.slice(at + 2)] };
};

/* Pulled before the kind is dispatched, so no shape gains a field: these say what the run is doing
   and not what the payload holds, and `criteria` takes a bare path where a shape takes flags. */
const pullRun = (argv) => {
  const lines = pullRepeated(argv, OPEN, "record");
  const line = pullOne(lines.rest, NEXT);
  let rest = line.rest;
  const took = {};
  for (const flag of TOGGLES) {
    took[flag.slice(2)] = rest.includes(flag);
    rest = rest.filter((one) => one !== flag);
  }
  return {
    next: nextLine(line.value),
    patch: patchFrom({ ...took, open: lines.values }),
    /* Asked for, not produced: a capture that found nothing to write would otherwise let a
       read-only kind through the refusal below on the strength of an empty log. */
    asked: line.value !== undefined || lines.values.length || Object.values(took).some(Boolean),
    rest,
  };
};

const run = async ([kind, reference, ...argv]) => {
  if (!kind || wantsHelp([kind])) return console.log(USAGE);
  if (!KINDS.includes(kind)) refuse(`record knows no kind \`${kind}\`. Kinds: ${KINDS.join(", ")}.`);
  if (!reference) refuse(USAGE.split("\n")[0]);
  const { next, patch, asked, rest } = pullRun(argv);
  const run = { next, patch };
  if (kind === "note") return recordNote(reference, rest, run);
  if (kind === "criteria") return recordCriteria(reference, rest, run);
  if (kind === "report") {
    if (asked) {
      refuse("record report writes nothing, so it renews no lease and carries no --next, --pushed, --review or --open.");
    }
    return recordReport(reference);
  }
  return recordShaped(kind, reference, rest, run);
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
