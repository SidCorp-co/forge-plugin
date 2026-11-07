/* What goes up once `record.mjs` has prepared and judged every payload of a rung, sent in the order
   its `writeRung` states: apart because the verb's own file is the judging. docs/cli/record.md. */
import { fail } from "../../../resolve/settings.mjs";
import { Refused, refuse } from "../../../refusal.mjs";
import { SHAPES } from "../../machine.mjs";
import { askedInSource } from "../../../resolve/flags.mjs";
import { batchRefusal, strandedLine, uploadAll } from "../../../tracker/evidence.mjs";
import { write } from "../../../tracker/rest.mjs";
import { writeFields } from "../../../tracker/field-write.mjs";
import { repoRoot } from "../../../git/repo-root.mjs";
import { scopeFrom, scopePath } from "../plan-scope.mjs";
import { FIELD, expiryOf, leaseOf, renew } from "../../lease.mjs";
import { post, sayStored } from "./posting.mjs";
import { judgeHinted } from "../verdict/door.mjs";

/* Stamped by the tracker or no earlier than the newest row it sorts under, so the ladder read at the end of a call counts the record that call made (ISS-285). */
const stampedLast = (comments, written) => String(written?.createdAt
  ?? [new Date().toISOString(), ...comments.map((one) => String(one.createdAt ?? ""))].sort().at(-1));

/* `writeFields` refuses where fewer fields reached it than were asked for, and a rung asks for two. */
const askedFor = (reference, fields) =>
  askedInSource(`record for ${reference}`, ...fields.map((one) => one.field));

/* Taken as each write lands rather than once this call returns: a correction the tracker holds whose call failed after it would otherwise leave a cache that still refuses the retry (ISS-411). A scope this cannot read is a gate that says nothing, never a record write that failed, so the catch is empty. A write outside a repository has no scope to keep and says nothing, and a false from `plan-scope.mjs` is a write or a removal the filesystem refused, the one state that module cannot leave on its own: the run is told rather than left to meet it. */
const scopeNoted = async (documentId, reference, issue, comments) => {
  const tree = repoRoot(process.cwd());
  if (!tree) return;
  try {
    const { namedIn, viewFrom } = await import("../../earned.mjs");
    const named = namedIn(viewFrom(documentId, issue, comments));
    if (scopeFrom(issue.status, issue.issueId ?? reference, named, { tree, leaseUntil: expiryOf(leaseOf(issue[FIELD])) || undefined })) return;
    console.error(`this record landed and ${scopePath(tree, issue.issueId ?? reference)} could not be written or removed, so a `
      + `write it clears may still be refused: \`forge hooks --off plan-scope\``);
  } catch {}
};

/* What a verdict recorded through the door says on stderr, stdout carrying the record itself: that it
   kept its probe, and core's reading of a duplicate or a verdict that will not count (ISS-7, ISS-475). */
const verdictDoorSaid = (reference, draft, answer) => {
  const dup = answer?.duplicate
    ? "; this run's latest verdict on it, sent again word for word, so nothing was written" : "";
  const notCounted = answer?.notCounted
    ? `\n  ${typeof answer.notCounted === "string" ? answer.notCounted : JSON.stringify(answer.notCounted)}` : "";
  return `criterion ${draft.criterion} ${draft.verdict} recorded on ${reference} through the verdict `
    + `door, keeping its probe${dup}.${notCounted}`;
};

export const postRung = async (prepared, { reference, documentId, body, comments, next, patch, judged = null }) => {
  const uploads = prepared.flatMap((one) => one.uploads ?? []);
  const verdicts = prepared.flatMap((one) => one.verdicts ?? []);
  const sent = [];
  /* Named from the line before the PUT: a file the tracker took with the answer lost is up all the same. */
  const stranded = (code) => code && sent.length && console.error(strandedLine(sent, reference));
  process.once("exit", stranded);
  const batch = await uploadAll("issue", documentId, uploads.map((one) => one.path), {
    renewing: judged ? undefined : () => renew(documentId, reference),
    sending: sent.push.bind(sent),
    said: [...new Set(prepared.map((one) => one.said).filter(Boolean))].join("\n") || null,
  });
  /* The batch's account names each file, the one whose answer was lost among them, so the stranded
     line would say the same thing a second time. */
  if (batch.refused.length) {
    process.off("exit", stranded);
    fail(`${batchRefusal(reference, batch)}\n\nNo record was written: nothing of it reached ${reference}.`);
  }
  const issue = { ...body, ...await fieldsWritten(prepared, { reference, documentId, next, patch }) };
  const posted = [];
  /* A finder's kind is written alone and touches nothing of the run holding the issue, its plan scope included, and a judge's verdict touches as little. */
  const finder = prepared.every((one) => SHAPES[one.kind]?.finder);
  const noted = finder || judged ? async () => {} : scopeNoted;
  await noted(documentId, reference, issue, comments);
  /* A question is asked before its record goes up, so an ask the tracker refuses leaves no comment
     claiming it; and the lease is renewed before the ask, so a run the record would be refused for
     asks nobody either (ISS-3101). That renewal stands for the first comment's own. */
  let renewed = false;
  if ((prepared.some((one) => one.ask) || verdicts.length) && !finder && !judged) {
    await renew(documentId, reference, next, patch);
    renewed = true;
  }
  for (const one of prepared) await one.ask?.();
  /* The verdicts that keep a probe, recorded through the door after the uploads so the clip they cite is
     up: a refusal there leads with the names already up rather than letting core's "nothing written"
     stand alone (ISS-7). No comment is posted for one, so none joins `posted`; core's criteria read is
     where the status move below counts it. */
  for (const draft of verdicts) {
    const answer = await write("forge_issues.verdicts", { documentId, data: draft.payload }, undefined, true);
    if (answer?.refused) {
      process.off("exit", stranded);
      fail(judgeHinted(sent.length ? `${strandedLine(sent, reference)}\n\n${answer.refused}` : answer.refused));
    }
    console.log(draft.rendered);
    console.error(verdictDoorSaid(reference, draft, answer));
  }
  /* A payload's record, then its note — a comment of its own, which no record's parse has to read past. */
  for (const body of prepared.flatMap((one) => [one.rendered, one.noted]).filter((said) => said !== undefined)) {
    /* Soft where files are up, so core's refusal of the comment comes back here to lead with their
       names rather than exiting bare beneath the stranded line (ISS-7). */
    const answer = await post(documentId, body, { ref: reference, next, patch, finder, judged: Boolean(judged), renewed, soft: sent.length > 0 });
    if (answer?.refused) {
      process.off("exit", stranded);
      fail(judgeHinted(`${strandedLine(sent, reference)}\n\n${answer.refused}`));
    }
    renewed = false;
    /* The row as the tracker answered it: a comment carrying no device reads as a person's answer to a park, and an agent's write is no person's. */
    posted.push({ ...(answer ?? {}), documentId: answer?.documentId ?? null, body,
      createdAt: stampedLast([...comments, ...posted], answer) });
    await noted(documentId, reference, issue, [...comments, ...posted]);
  }
  for (const one of prepared) await one.write?.();
  /* Loaded here alone: a transcript read belongs to the one write that owes it, not to every record. */
  if (prepared.some((one) => one.kind === "fold")) {
    const due = (await import("../../../stats/waves/trigger.mjs")).foldDue(process.cwd());
    if (due) console.error(`\n${due}`);
  }
  /* Dropped on the way out and never in a `finally`: a thrown failure unwinds through one before the
     exit, and the notice would be gone for every route but `fail()`'s. */
  process.off("exit", stranded);
  return { issue, posted, again: uploads.length > 0 || verdicts.length > 0 || prepared.some((one) => one.write)
    || posted.some((one) => !one.authorDeviceId) };
};

const UNTITLED = /\breleaseNotes\.title is not (?:one this call takes|a field the tracker's update route takes)/u;

/* A tracker whose note takes no title refuses the whole write over it (FB-59, ISS-83), so the note goes up once more without one and the run is told; any other refusal stands as the tracker worded it. */
const untitled = (fields, error) => {
  const note = fields.find((one) => one.field === "releaseNotes" && one.value?.title);
  if (!note || !(error instanceof Refused) || !UNTITLED.test(error.message)) throw error;
  const { title, ...rest } = note.value;
  console.error(`This tracker takes no releaseNotes.title, so the note was written without its title "${title}".`);
  return fields.map((one) => (one === note ? { ...one, value: rest, shown: JSON.stringify(rest, null, 2) } : one));
};

const fieldsWritten = async (prepared, { reference, documentId, next, patch }) => {
  let fields = prepared.filter((one) => one.field);
  if (!fields.length) return {};
  for (const one of fields) sayStored(one.kind);
  const sent = (soft) => writeFields(documentId, fields.map((one) => ({ field: one.field, value: one.value })),
    { ref: reference, next, patch, refuse, soft, ask: askedFor(reference, fields) });
  let back;
  try {
    back = await sent(true);
  } catch (error) {
    fields = untitled(fields, error);
    back = await sent(false);
  }
  const out = {};
  for (const one of fields) {
    console.log(one.shown);
    if (one.changed) console.error(one.changed);
    out[one.field] = back?.[one.field] ?? one.value;
  }
  return out;
};
