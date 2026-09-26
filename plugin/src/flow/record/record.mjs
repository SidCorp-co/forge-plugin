/* The contract's payloads, each written in one shape a reader and a checker find alike, and read
   back by kind: docs/cli/record.md. The verb owns the shape; the tracker owns the fields. */
import { fail, slugIfAny } from "../../resolve/settings.mjs";
import { Refused, refuse } from "../../refusal.mjs";
import { citationProblem } from "../earned/published.mjs";
import { answersByComment } from "../earned/park-status.mjs";

export { KINDS, USAGE, kindHelp, usage } from "./record-rows.mjs";
export { compoundRefused, criteriaLines, noteFrom } from "./fields.mjs";
import { SHAPES, criterionNumber, handleOf, unwrap } from "../machine.mjs";
import { parseAll } from "./page.mjs";
import { renderedWithin } from "../../tracker/comment-cap.mjs";
import { markedCommit, mergedPrepared } from "./merged.mjs";
import { commitProblem, eachProblem } from "./content.mjs";
import { KINDS, SERVES_KINDS, USAGE, kindHelp, kindUsage, onePerRoutes, usage } from "./record-rows.mjs";
import { criteriaLines, criteriaPrepared, notePrepared, planPrepared } from "./fields.mjs";
import { RUN_FLAGS, kindBlocks, pullRun } from "./rung.mjs";
import { fieldChecked } from "./prose-route.mjs";
import { FLAG_WORD, firstLine, noValue, pullRepeated, flags, wantsHelp } from "../../resolve/flags.mjs";
import { commentPage, cutIn } from "../../tracker/comments.mjs";
import {
  attachPlan, attachmentNames, evidenceHeld, evidenceProblem, isCommit, shortSha, strandedLine, unreadNames,
  uploadAll,
} from "../../tracker/evidence.mjs";
import { releaseLine, releasePolicy } from "../../tracker/project-config.mjs";
import { briefGoals } from "../../tracker/knowledge/brief.mjs";
import { NONE_STATED, servesRefusal } from "../../goals.mjs";
import { belowTop, climbForm, rungClaimed } from "../../ladder.mjs";
import { capsOf, writeFields } from "../../tracker/field-write.mjs";
import { refuseIfGated } from "../../resolve/visibility.mjs";
import { partForRecord } from "../../guides/served.mjs";
import { scopeFrom, scopePath } from "./plan-scope.mjs";
import { repoRoot } from "../../git/repo-root.mjs";
import { askedInSource } from "../../resolve/flags.mjs";
import { renew, writtenBy } from "../lease.mjs";
import { issueOf, post, sayStored } from "./thread/posting.mjs";
import { foldProblem } from "./wave.mjs";
import { DECLINED, declinedProblem } from "../earned/findings.mjs";
import { stampedNow, uncommittedOver } from "../worklog.mjs";

/* Filled from the record where the flag is absent (ISS-65): a verdict loop typed both twenty times.
   Deferred and not defaulted, the values arriving with the issue and a flag error costing no call. */
const DEFERRED = ["commit", "evidence"];

/* One pass over the shape: every flag read, every rule applied, before anything is written. */
const gather = (kind, argv, defer = [], reference = undefined) => {
  const shape = SHAPES[kind];
  let rest = argv;
  const got = {};
  const usage = kindUsage(kind);
  for (const field of shape.fields.filter((one) => one.many)) {
    const pulled = pullRepeated(rest, `--${field.flag}`, `record ${kind}`, { usage });
    got[field.flag] = pulled.values;
    rest = pulled.rest;
  }
  const single = flags(rest, `record ${kind}`, [], { usage, again: onePerRoutes(kind, reference) });
  Object.assign(got, single, writtenBy(shape), stampedNow(shape));
  /* Its own pass and first, so a route typed at one field is named before whichever field is missing. */
  for (const field of shape.fields) fieldChecked(kind, field, got[field.flag]);
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

/* An answer is read only by the resume from a status a comment answers, so one written anywhere else
   is an input nothing reads; `on_hold` is lifted by a person's set or by its blockers, never by one. */
const answerChecked = (kind, reference, body) => {
  if (kind !== "answer" || answersByComment(body.status)) return;
  refuse(`record answer: ${reference} is ${body.status}, and an answer is read only where a park waits `
    + "on a person — waiting or needs_info — so nothing would read this one. Nothing was sent. What "
    + `it does wait on:\n  forge advance ${reference} --owed`);
};

/* A verdict or a review names the head it judged, and a run judges the tree it has open: where that tree holds work its head lacks, the record says the head was judged when the tree was (ISS-381). Only the head is asked about, so an older commit cited on purpose and a checkout other than the one holding the commit are never refused here. */
const judgedTreeChecked = (kind, got) => {
  const field = SHAPES[kind].fields.find((one) => one.judged);
  const commit = field ? got[field.flag] : undefined;
  const loose = commit === undefined ? null : uncommittedOver(commit);
  if (!loose) return;
  const shown = loose.slice(0, 5).join(", ") + (loose.length > 5 ? `, and ${loose.length - 5} more` : "");
  refuse(`record ${kind}: --${field.flag} ${shortSha(commit)} is the head of this checkout, and the `
    + `checkout holds work that head does not carry: ${shown}. What was judged is then not what the `
    + "record says was. Nothing was sent. Commit that work, and cite the head that carries it:\n"
    + `  git add -A && git commit, then --${field.flag} $(git rev-parse HEAD)`);
};

/* A finder's kind is its own call: `--also` rides a rung that moves a status and every run flag
   writes the lease, and a write that takes no lease can carry neither (ISS-818). */
const aloneChecked = (kind, reference, argv) => {
  const beside = argv.find((one) => one === "--also" || RUN_FLAGS.includes(one));
  if (!beside) return;
  refuse(`record ${kind} is written alone and takes no lease, so ${beside} has nothing here to act on: `
    + `${beside === "--also" ? "it adds a kind to a rung that moves the status" : "it writes onto the lease"}. `
    + `Send the ${kind} by itself:\n  forge record ${kind} ${reference} ${kindUsage(kind).split("\n")[1].trim().replace(/^\S+\s+/u, "")}`);
};

/* At waiting or needs_info the tracker reads any comment as the reply to the park and reopens the
   issue, so a finder's record there would move a status nothing earned. */
const finderChecked = (kind, reference, body, read) => {
  if (!SHAPES[kind].finder) return;
  if (answersByComment(body.status)) {
    refuse(`record ${kind}: ${reference} is ${body.status}, where the tracker reads a comment as the `
      + "reply to its park and reopens the issue, so this record would move a status no record earned. "
      + `Nothing was sent. Head the wave on an issue no park holds, or write this once the park is answered:\n  forge advance ${reference} --owed`);
  }
  const said = foldProblem(kind, reference, read);
  if (said) refuse(said);
};

/* A declining names a finding this issue carries, read off the page before anything is posted; the
   handle is what every reader keys by, so a whole comment id given for it is cut to one. */
const declinedChecked = (kind, reference, blocks, read) => {
  if (kind !== DECLINED) return;
  for (const got of blocks) {
    checked(kind, got);
    const said = declinedProblem(reference, got.finding, read);
    if (said) refuse(said);
    got.finding = handleOf(got.finding);
  }
};

/* Stamped by the tracker or no earlier than the newest row it sorts under, so the ladder read at the end of a call counts the record that call made (ISS-285). */
const stampedLast = (comments, written) => String(written?.createdAt
  ?? [new Date().toISOString(), ...comments.map((one) => String(one.createdAt ?? ""))].sort().at(-1));

/* On stderr, beside what the write owes and not on the stream carrying the record: a caller reading a payload back is not reading the method. A record ends its phase's work, so the part is that phase's. */
const sayPart = (kind, rung) => partForRecord(kind, (part) => console.error(`\n${part}`), rung);

/* Off the record and not the issue: whoever wrote the first of the kind cited it, and the rest of a
   loop inherit that rather than a guess. Not per criterion — one document answers twenty. */
const citedBy = (comments, kind) =>
  comments.flatMap((one) => parseAll(one.body ?? "")).filter((one) => one.kind === kind).at(-1)?.fields.evidence ?? [];

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
const blocksOf = (kind, argv, reference) => {
  const shape = SHAPES[kind];
  const single = shape.fields.filter((one) => !one.many).map((one) => `--${one.flag}`);
  const blocks = blocksIn(argv, shape.per, single, `record ${kind}`)
    .map((one) => gather(kind, one, DEFERRED, reference));
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
   name all three carry, so the collision `attachPlan` refuses is never this write citing its own.
   A cut walk is carried as the line `forge attach` says for it, and said only where the uploads go. */
const citeOnce = (blocks, { held, read, cut, reference }) => {
  const refs = [...new Set(blocks.flatMap((one) => one.evidence ?? []))];
  if (!refs.length) return null;
  const plan = attachPlan(refs, held, (ref) => evidenceHeld(ref, held));
  if (plan.refusal) refuse(plan.refusal);
  plan.said = plan.upload.length ? unreadNames(reference, read, cut) : null;
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
  const blocks = blocksOf(kind, argv, reference);
  const asks = shape.fields.some((one) => one.evidence || one.commit);
  const { body } = await issue();
  answerChecked(kind, reference, body);
  const { comments, cut } = asks || shape.closes || kind === DECLINED ? await page() : { comments: [], cut: null };
  finderChecked(kind, reference, body, { comments, cut });
  const onIssue = attachmentNames(body, comments);
  const held = [...onIssue, ...planned];
  /* The count is of names read off the issue, as `forge attach` gives it; a rung's earlier kind's pending upload is no name read. */
  const plan = citeOnce(blocks, { held, read: onIssue.length, cut, reference });
  const names = [...held, ...(plan?.upload ?? []).map((one) => one.name)];
    /* Every block fills from one record; three copies of a line is reading the write spared. */
  const spoken = new Set();
  const say = (line) => {
    if (spoken.has(line)) return;
    spoken.add(line);
    console.error(line);
  };
  declinedChecked(kind, reference, blocks, { comments, cut });
  for (const got of blocks) {
    /* `held` and never `names`: a refusal reports what the issue already carries, and this call's
       own pending upload is not that until the whole call clears — which the refusal is the proof
       it did not (ISS-1935). `evidenceProblem` below is the one reader that legitimately wants the
       fuller set, since it validates this call's own citations against what will exist once it lands. */
    if (asks) fromRecord(kind, got, { comments, names: held, cut }, say);
    checked(kind, got);
    judgedTreeChecked(kind, got);
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
  return { uploads: plan?.upload ?? [], said: plan?.said ?? null, rendered: renderedWithin(kind, blocks, stamp, { reference, uploads: plan?.upload }) };
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
  const { rung } = await movedByRecord(documentId, after.issue, reference, blocks.map((one) => one.kind), after.page,
    body.status);
  for (const one of blocks) sayPart(one.kind, rung);
};

/* Taken as each write lands rather than once this call returns: a correction the tracker holds whose call failed after it would otherwise leave a cache that still refuses the retry (ISS-411). A scope this cannot read is a gate that says nothing, never a record write that failed, so the catch is empty. A write outside a repository has no scope to keep and says nothing, and a false from `plan-scope.mjs` is a write or a removal the filesystem refused, the one state that module cannot leave on its own: the run is told rather than left to meet it. */
const scopeNoted = async (documentId, reference, issue, comments) => {
  const tree = repoRoot(process.cwd());
  if (!tree) return;
  try {
    const { namedIn, viewFrom } = await import("../earned.mjs");
    const named = namedIn(viewFrom(documentId, issue, comments));
    if (scopeFrom(issue.status, issue.issueId ?? reference, named, { tree })) return;
    console.error(`this record landed and ${scopePath(tree, issue.issueId ?? reference)} could not be written or removed, so a `
      + `write it clears may still be refused: \`forge hooks --off plan-scope\``);
  } catch {}
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
    said: [...new Set(prepared.map((one) => one.said).filter(Boolean))].join("\n") || null,
  });
  const issue = { ...body, ...await fieldsWritten(prepared, { reference, documentId, next, patch }) };
  const posted = [];
  /* A finder's kind is written alone and touches nothing of the run holding the issue, its plan scope included. */
  const finder = prepared.every((one) => SHAPES[one.kind]?.finder);
  const noted = finder ? async () => {} : scopeNoted;
  await noted(documentId, reference, issue, comments);
  for (const one of prepared) {
    if (one.rendered === undefined) continue;
    const answer = await post(documentId, one.rendered, { ref: reference, next, patch, finder });
    /* The row as the tracker answered it: a comment carrying no device reads as a person's answer to a park, and an agent's write is no person's. */
    posted.push({ ...(answer ?? {}), documentId: answer?.documentId ?? null, body: one.rendered,
      createdAt: stampedLast([...comments, ...posted], answer) });
    await noted(documentId, reference, issue, [...comments, ...posted]);
  }
  for (const one of prepared) await one.write?.();
  /* Loaded here alone: a transcript read belongs to the one write that owes it, not to every record. */
  if (prepared.some((one) => one.kind === "fold")) {
    const due = (await import("../../stats/waves/trigger.mjs")).foldDue(process.cwd());
    if (due) console.error(`\n${due}`);
  }
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

const run = async ([kind, reference, ...argv]) => {
  if (!kind || wantsHelp([kind])) return console.log(usage());
  if (!KINDS.includes(kind)) refuse(`record knows no kind \`${kind}\`. Kinds: ${KINDS.join(", ")}.`);
  /* `record` answers its own help, so cli.mjs hands the whole tail over and `-h` in the reference
     position was spent as an issue key — the one flag its own refusal could not answer for. */
  if (wantsHelp([reference])) return console.log(kindHelp(kind, await capsOf(), await briefGoals()));
  if (!reference) refuse(firstLine(USAGE));
  const blocks = kindBlocks(kind, argv);
  const finder = blocks.find((one) => SHAPES[one.kind]?.finder);
  if (finder) aloneChecked(finder.kind, reference, argv);
  const { next, patch, rest } = await pullRun(blocks);
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
