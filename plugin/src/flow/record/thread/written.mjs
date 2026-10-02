/* What goes up once `record.mjs` has prepared and judged every payload of a rung, sent in the order
   its `writeRung` states: apart because the verb's own file is the judging. docs/cli/record.md. */
import { fail } from "../../../resolve/settings.mjs";
import { refuse } from "../../../refusal.mjs";
import { SHAPES } from "../../machine.mjs";
import { askedInSource } from "../../../resolve/flags.mjs";
import { batchRefusal, strandedLine, uploadAll } from "../../../tracker/evidence.mjs";
import { writeFields } from "../../../tracker/field-write.mjs";
import { repoRoot } from "../../../git/repo-root.mjs";
import { scopeFrom, scopePath } from "../plan-scope.mjs";
import { renew } from "../../lease.mjs";
import { post, sayStored } from "./posting.mjs";

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
    if (scopeFrom(issue.status, issue.issueId ?? reference, named, { tree })) return;
    console.error(`this record landed and ${scopePath(tree, issue.issueId ?? reference)} could not be written or removed, so a `
      + `write it clears may still be refused: \`forge hooks --off plan-scope\``);
  } catch {}
};

export const postRung = async (prepared, { reference, documentId, body, comments, next, patch, judged = null }) => {
  const uploads = prepared.flatMap((one) => one.uploads ?? []);
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
  if (prepared.some((one) => one.ask) && !finder && !judged) {
    await renew(documentId, reference, next, patch);
    renewed = true;
  }
  for (const one of prepared) await one.ask?.();
  /* A payload's record, then its note — a comment of its own, which no record's parse has to read past. */
  for (const body of prepared.flatMap((one) => [one.rendered, one.noted]).filter((said) => said !== undefined)) {
    const answer = await post(documentId, body, { ref: reference, next, patch, finder, judged: Boolean(judged), renewed });
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
    if (one.changed) console.error(one.changed);
    out[one.field] = back?.[one.field] ?? one.value;
  }
  return out;
};
