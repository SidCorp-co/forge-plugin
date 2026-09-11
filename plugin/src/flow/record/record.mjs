/* The contract's payloads, each written in one shape a reader and a checker find alike, and read
   back by kind: docs/cli/record.md. The verb owns the shape; the tracker owns the fields. */
import { fail, slugIfAny, translateTo } from "../../resolve/settings.mjs";
import { Refused, refuse } from "../../refusal.mjs";
import { citationProblem } from "../earned/published.mjs";

export { KINDS, USAGE, kindHelp, usage } from "./record-rows.mjs";
export { compoundRefused, criteriaLines, noteFrom } from "./fields.mjs";
import { CLOSES_FROM, SHAPES, criterionNumber, heldSaid, planTyped, unwrap } from "../machine.mjs";
import { assemble, parseAll, printRecord, render } from "./page.mjs";
import { markedCommit, mergedPrepared } from "./merged.mjs";
import { commitProblem, eachProblem } from "./content.mjs";
import { KINDS, SERVES_KINDS, USAGE, kindHelp, kindUsage, usage } from "./record-rows.mjs";
import { criteriaLines, criteriaPrepared, notePrepared, planPrepared } from "./fields.mjs";
import { kindBlocks, pullRun } from "./rung.mjs";
import { FLAG_WORD, firstLine, noValue, pullRepeated, flags, wantsHelp } from "../../resolve/flags.mjs";
import { commentPage, cutIn, cutLine, postComment } from "../../tracker/comments.mjs";
import {
  TWICE, attachPlan, attachmentNames, evidenceHeld, evidenceProblem, isCommit, strandedLine, uploadAll,
} from "../../tracker/evidence.mjs";
import { briefGoals, personOwedForRelease, releaseLine, releasePolicy } from "../../tracker/project-config.mjs";
import { NONE_STATED, servesRefusal } from "../../goals.mjs";
import { belowTop, climbForm, rungClaimed } from "../../ladder.mjs";
import { documentIdOf } from "../../tracker/issues.mjs";
import { capsOf, writeFields } from "../../tracker/field-write.mjs";
import { scoped } from "../../tracker/rest.mjs";
import { refuseIfGated } from "../../resolve/visibility.mjs";
import { pluginFilingLine } from "../../tracker/filing/plugin-defect.mjs";
import { partForRecord } from "../../guides/served.mjs";
import { workLines } from "../../guides/phases.mjs";
import { askedInSource } from "../../resolve/flags.mjs";
import { FIELD as SESSION, renew, writtenBy } from "../lease.mjs";
import { stampedNow, worklogLines, worklogOf, workNow } from "../worklog.mjs";

export const issueOf = async (reference) => {
  const documentId = await documentIdOf(reference);
  const body = await scoped("forge_issues", { action: "get", documentId });
  return { documentId, body };
};

/* Filled from the record where the flag is absent (ISS-65): a verdict loop typed both twenty times.
   Deferred and not defaulted, the values arriving with the issue and a flag error costing no call. */
export const DEFERRED = ["commit", "evidence"];

/* One pass over the shape: every flag read, every rule applied, before anything is written. */
const gather = (kind, argv, defer = []) => {
  const shape = SHAPES[kind];
  let rest = argv;
  const got = {};
  const usage = kindUsage(kind);
  for (const field of shape.fields.filter((one) => one.many)) {
    const pulled = pullRepeated(rest, `--${field.flag}`, `record ${kind}`, { usage });
    got[field.flag] = pulled.values;
    rest = pulled.rest;
  }
  const single = flags(rest, `record ${kind}`, [], { usage });
  Object.assign(got, single, writtenBy(shape), stampedNow(shape));
  for (const field of shape.fields) {
    const value = got[field.flag];
    if (field.many) {
      const least = field.least ?? 1;
      if (value.length < least && !defer.includes(field.flag)) {
        refuse(`record ${kind} needs --${field.flag}${least > 1 ? ` ${least} or more times` : ""}.`);
      }
      const bad = eachProblem(field, value);
      if (bad) refuse(`record ${kind}'s --${field.flag} ${bad}`);
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
    if (field.commit && !isCommit(value)) refuse(`--${field.flag} ${commitProblem(field, value)}`);
    if (field.criterion && !/^\d+$/u.test(value)) refuse(`--criterion takes the criterion's number, not \`${value}\`.`);
  }
  return got;
};

export const checked = (kind, got) => {
  const said = SHAPES[kind].check?.(got);
  if (said) refuse(`record ${kind} needs ${said}.`);
};

/* Beside `checked` rather than inside the shape's own `check`, which is handed the payload and nothing else: this one asks what a ship published, and machine.mjs imports nothing that reads a file. It is the whole of where a citation's authority is settled, so no entry check has to reach for a store one machine holds (ISS-1101). */
const citationChecked = (kind, reference, got) => {
  if (kind !== "baseline") return;
  const said = citationProblem(reference, slugIfAny(), got);
  if (said) refuse(`record ${kind} needs ${said}`);
};

/* What the stored copy will be, said where the write is made: the payload block is the record and
   travels as written, and everything a rewrite reaches is prose around it. */
const REWRITTEN = {
  record: "the payload block is stored as written; the heading above it is rewritten",
  criteria: "the criteria are rewritten, and the numbers a verdict names are what survives",
  plan: "the plan is rewritten, and the three declaration lines a later reader takes a value off are what have to survive it",
  note: "the user-facing half is rewritten and the technical half is stored as written",
};

export const sayStored = (which, language = translateTo()) => {
  if (!language) return null;
  const said = `prose ${language}: ${REWRITTEN[which]}.`;
  console.error(said);
  return said;
};

/* Stamped by the tracker or no earlier than the newest row it sorts under, so the ladder read at the end of a call counts the record that call made (ISS-285). */
const stampedLast = (comments, written) => String(written?.createdAt
  ?? [new Date().toISOString(), ...comments.map((one) => String(one.createdAt ?? ""))].sort().at(-1));

/* On stderr, beside what the write owes and not on the stream carrying the record: a caller reading a payload back is not reading the method. A record ends its phase's work, so the part is that phase's. */
const sayPart = (kind) => partForRecord(kind, (part) => console.error(`\n${part}`));

/* `renewed` is the caller whose write a moment ago renewed the lease, which a second lease write would only repeat; `soft` hands the tracker's refusal back rather than exiting, for the caller with something to say about it. */
export const post = async (documentId, body, { ref = documentId, next = undefined, patch = null, soft = false, renewed = false } = {}) => {
  refuseIfGated("forge_comments");
  sayStored("record");
  if (!renewed) await renew(documentId, ref, next, patch);
  const answer = await postComment(documentId, body, null, soft);
  /* Asked softly by a caller that has something to say about the failure: the tracker's own refusal
     exits the process, and the body would be lost with it. */
  if (answer?.refused) return answer;
  console.log(body);
  return answer;
};

/* Off the record and not the issue: whoever wrote the first of the kind cited it, and the rest of a
   loop inherit that rather than a guess. Not per criterion — one document answers twenty. */
const citedBy = (comments, kind) =>
  comments.flatMap((one) => parseAll(one.body ?? "")).filter((one) => one.kind === kind).at(-1)?.fields.evidence ?? [];

/* Refused where the page was cut rather than risked past it: the name it must be unique against may be on a comment the cut held back, and one attached twice is two documents. */
const CROWDED = (kind, cut) => `record ${kind} would put a file up, and the names already on this `
  + `issue cannot be read whole. ${cut} ${TWICE} Every record citing it is then ambiguous. Cite a `
  + `URL or a commit, or attach the file under a name nothing else could carry and cite that.`;

/* A default is the latest of its kind; found nowhere on a read that stopped short, it may be past where that read stopped, so the flag is asked for (ISS-131). */
const BEHIND = (kind, flag, cut) => `record ${kind} reads --${flag} off this issue and the page `
  + `carries none to read. ${cut} The one that would answer may be a comment behind the cut, so `
  + `name --${flag} for this write.`;

/* Where the value came from, said: a default nobody can see is one nobody can catch being wrong.
   Where it cannot answer, the refusal says what the issue does carry rather than naming a flag. */
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

/* Read off what the write already knows, a line an author could type proving only that they typed it: the release policy from the config, the rung off the `get` this write has already made.
   Not the entry checks' answer either — the stamp reads the complexity field, where `rungOf` climbs for a plan's declarations and for a correction that moved the issue up, and answers the top rung outright on a cut page (ISS-428). A copy for a reader outside the flow, so a hand-written record lacking it is refused nothing. */
const DERIVED = {
  verification: async () => {
    const held = releaseLine(await releasePolicy());
    return held ? { [held[0]]: held[1] } : null;
  },
  confirmation: async (body) => ({ rung: rungClaimed({ complexity: body?.complexity }).rung }),
};

/* The stamp said out loud, because a run that has to read its own record back to learn its rung learns it after the phase that would have checked it. The rung is the triager's claim; this run's reading of the code is what holds it up, and the route up is printed only where one exists — `climbForm` at the top rung renders a pair that does not climb, which `climbsIn` drops. Advisory throughout: nothing here can judge the work against the rung. */
const SAID = {
  confirmation: (body, reference) => {
    const { rung, complexity } = rungClaimed({ complexity: body?.complexity });
    const from = complexity
      ? `claimed by the complexity \`${complexity}\``
      : "claimed by nobody: this issue holds no complexity, so the top rung stands by the upward rule";
    return `rung \`${rung}\`, ${from}. `
      + (belowTop(rung)
        ? `Where what you have just read is bigger than that, move it up before the plan:\n  ${climbForm(reference, rung)}`
        : "No rung stands above it, so there is nothing here to correct upward.");
  },
};

const derive = async (kind, blocks, body, { say, reference }) => {
  const held = await DERIVED[kind]?.(body);
  if (!held) return;
  for (const got of blocks) Object.assign(got, held);
  const line = SAID[kind]?.(body, reference);
  if (line) say(line);
};

const SERVES = "serves";

/* Absent, it is written *none stated*: a goal nobody asked for and none named read alike without. */
const servesChecked = async (kind, blocks) => {
  if (!SERVES_KINDS.includes(kind)) return;
  const given = [...new Set(blocks.map((one) => one[SERVES]).filter((one) => one !== undefined))];
  if (!given.length) {
    for (const got of blocks) got[SERVES] = NONE_STATED;
    return;
  }
  const bad = servesRefusal(given, await briefGoals(), `This ${kind} record`);
  if (bad) refuse(bad);
};

/* A block's own value of a single flag replaces the shared one, so that occurrence comes out rather
   than riding in front of it: the parser refuses a name it has bound, and a flag before its own
   replacement is that and not a caller asking twice (ISS-930). Which are single is the shape's. */
const sharedFor = (shared, own, single, verb) => {
  const replaced = new Set(own.filter((token) => single.includes(token)));
  if (!replaced.size) return shared;
  const kept = [];
  for (let index = 0; index < shared.length; index += 1) {
    if (!replaced.has(shared[index])) {
      kept.push(shared[index]);
      continue;
    }
    /* Removing a pair is not skipping it: the occurrence has to be a pair before it can be replaced, or a block's own value would erase a syntax error the parser was going to answer. */
    const value = shared[index + 1];
    if (value === undefined || FLAG_WORD.test(value)) refuse(noValue(verb, shared[index], value));
    index += 1;
  }
  return kept;
};

/* Split by the rule `groupsIn` splits the payload by, so one call writes what the reader hands back
   as several records: one commit and one evidence set over fourteen criteria. */
export const blocksIn = (argv, per, single = [], verb = "record") => {
  const flag = `--${per}`;
  const opens = per ? argv.indexOf(flag) : -1;
  if (opens < 0) return [argv];
  const shared = argv.slice(0, opens);
  const blocks = [];
  for (const token of argv.slice(opens)) {
    if (token === flag) blocks.push([]);
    blocks.at(-1).push(token);
  }
  return blocks.map((own) => [...sharedFor(shared, own, single, verb), ...own]);
};

/* Refused here and by the number the reader keys by, so `01` and `1` are one: the map every check
   keys keeps the last of two blocks naming one, and says so nowhere. */
const blocksOf = (kind, argv) => {
  const shape = SHAPES[kind];
  const single = shape.fields.filter((one) => !one.many).map((one) => `--${one.flag}`);
  const blocks = blocksIn(argv, shape.per, single, `record ${kind}`)
    .map((one) => gather(kind, one, DEFERRED));
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

/* Named by number and quoted as it stood, the field being able to change later. Read off the shape,
   so every kind citing one does it alike and a citation of a criterion the issue lacks is refused. */
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

/* Every refusal a shaped payload can earn, before any write of the call: a second block's bad field costs the first block nothing. */
const shapedPrepared = async (argv, { kind, reference, issue, page, planned }) => {
  const shape = SHAPES[kind];
  const blocks = blocksOf(kind, argv);
  const asks = shape.fields.some((one) => one.evidence || one.commit);
  const { body } = await issue();
  const { comments, cut } = asks ? await page() : { comments: [], cut: null };
  const held = [...attachmentNames(body, comments), ...planned];
  const plan = citeOnce(kind, blocks, { held, cut });
  const names = [...held, ...(plan?.upload ?? []).map((one) => one.name)];
    /* Every block fills from one record; three copies of a line is reading the write spared. */
  const spoken = new Set();
  const say = (line) => {
    if (spoken.has(line)) return;
    spoken.add(line);
    console.error(line);
  };
  for (const got of blocks) {
    if (asks) fromRecord(kind, got, { comments, names, cut }, say);
    checked(kind, got);
    citationChecked(kind, reference, got);
    const bad = got.evidence?.length ? evidenceProblem(got.evidence, names) : null;
    if (bad) refuse(bad);
  }
  await derive(kind, blocks, body, { say, reference });
  await servesChecked(kind, blocks);
  quoteCriteria(kind, blocks, body, reference);
  const stamp = shape.stamp ? String(body[shape.stamp.from ?? "status"] ?? "") : null;
  /* Asked here as well as in `post`, because a record that cannot be posted must not leave its
     evidence up: the two calls are one refusal a caller can act on and one nothing may skip. */
  refuseIfGated("forge_comments");
  return { uploads: plan?.upload ?? [], rendered: render(kind, blocks, stamp) };
};

const PREPARED = { plan: planPrepared, criteria: criteriaPrepared, note: notePrepared, merged: mergedPrepared };

/* `writeFields` refuses where fewer fields reached it than were asked for, and a rung asks for two. */
const askedFor = (reference, fields) =>
  askedInSource(`record for ${reference}`, ...fields.map((one) => one.field));

/* Read at the first prepare that asks and never before it: a flag error must cost no call (ISS-65). */
const once = (make) => {
  let held = null;
  return () => (held ??= make());
};

/* Patched from what each write answered, and read again where an effect is in neither answer: the mark's stamp and audit comment, an upload, which moves the attachment set, and a comment whose author the answer left unnamed.
   Beside that read stands a row of this write it did not hand back, and only where something named the author: an authorless row reads to `answered` as a person's reply to a park,
   so one the tracker has not confirmed is left out and the rung reads short rather than moving on a page nobody owns. */
const kept = (posted, back) => posted.filter((one) =>
  (!one.documentId || !back.has(one.documentId)) && Boolean(one.authorDeviceId));

const afterWrites = async (documentId, reference, { issue, page, again, posted }) => {
  if (!again) return { issue, page };
  const read = await commentPage(documentId);
  const back = new Set(read.comments.map((one) => one.documentId).filter(Boolean));
  return {
    issue: (await issueOf(reference)).body,
    page: { comments: [...read.comments, ...kept(posted, back)], cut: cutIn(read) },
  };
};

/* The one order in which a refusal costs nothing already written: every payload judged, then the
   uploads, whose scan is of bytes and cannot be judged earlier, then the fields in one update, which
   caps them all before either is sent, then the comments and the mark. */
const writeRung = async (reference, blocks, { next, patch }) => {
  const issue = once(() => issueOf(reference));
  const page = once(async () => {
    const read = await commentPage((await issue()).documentId);
    return { comments: read.comments, cut: cutIn(read) };
  });
  const planned = [];
  const prepared = [];
  for (const one of blocks) {
    const at = { kind: one.kind, reference, issue, page, planned, next, patch, usage: kindUsage(one.kind) };
    const ready = { kind: one.kind, ...await (PREPARED[one.kind] ?? shapedPrepared)(one.argv, at) };
    planned.push(...(ready.uploads ?? []).map((two) => two.name));
    prepared.push(ready);
  }
  const { documentId, body } = await issue();
  const read = await page();
  const written = await postRung(prepared, { reference, documentId, body, comments: read.comments, next, patch });
  const after = await afterWrites(documentId, reference, {
    issue: written.issue,
    page: { comments: [...read.comments, ...written.posted], cut: read.cut },
    again: written.again,
    posted: written.posted,
  });
  const { movedByRecord } = await import("../advance.mjs");
  await movedByRecord(documentId, after.issue, reference, blocks.map((one) => one.kind), after.page);
  for (const one of blocks) sayPart(one.kind);
};

const postRung = async (prepared, { reference, documentId, body, comments, next, patch }) => {
  const uploads = prepared.flatMap((one) => one.uploads ?? []);
  const sent = [];
  /* Named from the line before the PUT: a file the tracker took with the answer lost is up all the same. */
  const stranded = (code) => code && sent.length && console.error(strandedLine(sent, reference));
  process.once("exit", stranded);
  await uploadAll("issue", documentId, uploads.map((one) => one.path), {
    renewing: () => renew(documentId, reference),
    sending: sent.push.bind(sent),
  });
  const issue = { ...body, ...await fieldsWritten(prepared, { reference, documentId, next, patch }) };
  const posted = [];
  for (const one of prepared) {
    if (one.rendered === undefined) continue;
    const answer = await post(documentId, one.rendered, { ref: reference, next, patch });
    /* The row as the tracker answered it: a comment carrying no device reads as a person's answer to a park, and an agent's write is no person's. */
    posted.push({ ...(answer ?? {}), documentId: answer?.documentId ?? null, body: one.rendered,
      createdAt: stampedLast([...comments, ...posted], answer) });
  }
  for (const one of prepared) await one.write?.();
  /* Dropped on the way out and never in a `finally`: a thrown failure unwinds through one before the
     exit, and the notice would be gone for every route but `fail()`'s. */
  process.off("exit", stranded);
  return { issue, posted, again: uploads.length > 0 || prepared.some((one) => one.write)
    || posted.some((one) => !one.authorDeviceId) };
};

const fieldsWritten = async (prepared, { reference, documentId, next, patch }) => {
  const fields = prepared.filter((one) => one.field);
  if (!fields.length) return {};
  for (const one of fields) sayStored(one.kind);
  const back = await writeFields(documentId, fields.map((one) => ({ field: one.field, value: one.value })),
    { ref: reference, next, patch, refuse, ask: askedFor(reference, fields) });
  const out = {};
  for (const one of fields) {
    console.log(one.shown);
    out[one.field] = back?.[one.field] ?? one.value;
  }
  return out;
};

const criteriaCount = (body) => {
  try {
    return `${criteriaLines(unwrap(body.acceptanceCriteria)).length} criteria`;
  } catch {
    return "no numbered criteria";
  }
};

export const recordReport = async (reference) => {
  const { documentId, body } = await issueOf(reference);
  let criteria = [];
  try {
    criteria = criteriaLines(unwrap(body.acceptanceCriteria));
  } catch { criteria = []; }
  const page = await commentPage(documentId);
  const { comments } = page;
  if (cutIn(page)) console.error(`${cutLine(page)} This report was assembled from those rows and `
    + "from no others.");
  const { latest, verdicts, owed, repeated, unreadable } = assemble(comments, criteria);
  for (const kind of Object.keys(SHAPES)) {
    if (SHAPES[kind].repeats) {
      const held = repeated[kind] ?? [];
      const said = heldSaid(kind, held.length);
      if (said) console.log(`${said}, oldest first`);
      for (const one of held) printRecord(one);
    } else if (latest[kind]) printRecord(latest[kind]);
  }
  for (const number of [...verdicts.keys()].sort((a, b) => a - b)) printRecord(verdicts.get(number));
  for (const one of unreadable) printRecord(one);
  /* Whole rather than summarised: the plan is what every later phase was built against, and a
     report that names it without carrying it sends its reader back to the issue. */
  const held = unwrap(body.plan);
  if (held) console.log(`Plan  (${planTyped(held) ? "typed" : "untyped"})\n${held}`);
  if (body.releaseNotes?.section) console.log(`Release note  ${body.releaseNotes.section}: ${body.releaseNotes.userFacing}`);
  /* The run's own captures: no payload, and all of what a fold asks for beyond the payloads. */
  /* The pointer with the block, this report opening on no phase line to carry it (ISS-1183). */
  const work = worklogOf(body[SESSION]);
  const lines = [...workLines(workNow(work)), ...worklogLines(work)];
  if (lines.length) console.log(["", "The run, from its own captures:", ...lines.map((one) => `  ${one}`)].join("\n"));
  console.log(pluginFilingLine((repeated.routed ?? []).map((one) => one.record.fields.to)));
  console.log(owed.length ? `\nOwed: a verdict on criterion ${owed.join(", ")}.` : `\nEvery criterion has a verdict.`);
  /* A run's end is `closed`, or this rung where the policy leaves a person the release (ISS-105, ISS-1147). */
  if (body.status === CLOSES_FROM) {
    const owed = personOwedForRelease(await releasePolicy());
    console.log(owed
      ? `Owed: the release, which is a person's. ${owed}, so this run ends at ${CLOSES_FROM} and the `
        + `close is theirs:\n  forge advance ${reference}, once the release is out`
      : `Owed: the close. A run ends at closed, not at ${CLOSES_FROM}:\n  forge advance ${reference}`);
  }
};

const run = async ([kind, reference, ...argv]) => {
  if (!kind || wantsHelp([kind])) return console.log(usage());
  if (!KINDS.includes(kind)) refuse(`record knows no kind \`${kind}\`. Kinds: ${KINDS.join(", ")}.`);
  /* `record` answers its own help, so cli.mjs hands the whole tail over and `-h` in the reference
     position was spent as an issue key — the one flag its own refusal could not answer for. */
  if (wantsHelp([reference])) return console.log(kindHelp(kind, await capsOf(), await briefGoals()));
  if (!reference) refuse(firstLine(USAGE));
  const { next, patch, rest } = pullRun(kindBlocks(kind, argv));
  return writeRung(reference, rest, { next, patch });
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
