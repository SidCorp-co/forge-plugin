/* A field write that would replace a payload its status was already earned on: refused until a
   correction naming the kind stands, and, once one does, the replaced value put up before the field
   is written and named by a record after it. Only the three kinds written into a field of the issue
   are here, because a second record of any other kind leaves the first on the page; the argument
   and the one route out: docs/cli/record-corrections.md. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { refuse } from "../../refusal.mjs";
import { correctedKind, handleOf, unwrap } from "../machine.mjs";
import { render } from "./page.mjs";
import { bodyCap } from "../../tracker/comment-cap.mjs";
import { lengthOf } from "../../tracker/field-write.mjs";
import { attachmentNames } from "../../tracker/evidence.mjs";
import { lightens } from "../../ladder.mjs";

const noteText = (note) => [`Section: ${note.section}`, `User-facing: ${note.userFacing}`,
  ...(note.technical ? [`Technical: ${note.technical}`] : [])].join("\n");

/* Each field kind and the issue's field it writes. The status its payload is earned at is read off
   the table of what each entry check cites, never named here beside the kind. */
export const EARNED = {
  plan: { field: "plan", said: "plan", text: unwrap },
  criteria: { field: "acceptanceCriteria", said: "criteria", text: unwrap },
  note: { field: "releaseNotes", said: "release note", text: (value) => (value?.section ? noteText(value) : "") },
};

/* A side status says nothing about the lane by itself, so the one the latest park left is read
   instead; neither in the lane nor left by a park, nothing says what was earned, and nothing is. */
const standingOf = (view, { ORDER, parkRecord }) => {
  const { status } = view.issue;
  if (ORDER.includes(status)) return status;
  const left = parkRecord(view)?.record.fields.left;
  return ORDER.includes(left) ? left : null;
};

/* Presence and recency, never whether the words match what moved: a whole correction naming the
   kind, written after the last replacement of that kind, which is the one it would spend. */
const unspent = (view, kind, shapeGaps) => {
  const last = (view.repeated.superseded ?? [])
    .filter((one) => one.record.fields.kind === kind).at(-1)?.at ?? "";
  return (view.repeated.correction ?? [])
    .filter((one) => correctedKind(one.record.fields.corrects) === kind && one.at > last)
    .filter((one) => !shapeGaps("correction", one.record, view.names).length)
    .at(-1) ?? null;
};

const refusal = (kind, reference, { standing, at }, cut) => {
  const { said } = EARNED[kind];
  return `record ${kind}: ${reference} stands at ${standing}, and the ${said} it holds was read at `
    + `${at} and is replaced by this write with a different one. A payload a status was earned on is `
    + "corrected in the open, never overwritten in silence, so nothing was sent."
    /* The page line is `cutIn`'s, already a sentence: `page()` in record.mjs hands it over whole. */
    + (cut ? ` ${cut} A correction behind the cut is not one this write could see.` : "")
    + ` Say what moved and why, naming the kind, then send this write again:\n`
    + `  forge record correction ${reference} --corrects ${kind} --moved "<what moved in the ${said}>" `
    + `--why "<why it moved>"`;
};

/* Named for the kind and the second it was put up, and never a name the issue already carries. */
const fileFor = (kind, text, taken) => {
  const stamp = new Date().toISOString().replace(/[:.]/gu, "").slice(0, 17);
  let name = `${kind}-as-it-stood-${stamp}.md`;
  for (let count = 2; taken.includes(name); count += 1) name = `${kind}-as-it-stood-${stamp}-${count}.md`;
  const path = join(mkdtempSync(join(tmpdir(), "forge-superseded-")), name);
  writeFileSync(path, `${text}\n`);
  return { path, name };
};

/* The value inline only where the record still fits one comment; the attachment carries it either way. */
const recordFor = (fields) => {
  const whole = render("superseded", fields);
  const cap = bodyCap();
  return cap === null || lengthOf(whole) <= cap ? whole : render("superseded", { ...fields, was: undefined });
};

/**
 * What a field write owes before it replaces a value: nothing where it replaces nothing a status
 * was earned on, a refusal where no correction names the kind, and otherwise the upload and the
 * record the write sends around the field.
 */
export const supersedingOf = async (kind, value, { reference, issue, page, planned = [] }) => {
  const entry = EARNED[kind];
  const { documentId, body } = await issue();
  const held = entry.text(body[entry.field]);
  if (!held || held === entry.text(value)) return {};
  const { comments, cut } = await page();
  const earned = await import("../earned.mjs");
  const { CITED } = await import("../../guides/phases.mjs");
  const at = Object.keys(CITED).find((status) => CITED[status].includes(kind));
  const view = earned.viewFrom(documentId, body, comments, cut);
  const standing = standingOf(view, earned);
  if (!standing || !earned.atLeast(standing, at)) return {};
  if (lightens(at, kind, earned.rungFieldsOf(view))) return {};
  const correction = unspent(view, kind, earned.shapeGaps);
  if (!correction) refuse(refusal(kind, reference, { standing, at }, cut));
  const file = fileFor(kind, held, [...attachmentNames(body, comments), ...planned]);
  const by = handleOf(correction.id);
  console.error(`The ${entry.said} this replaces goes up as ${file.name} before the field is written, `
    + `and a Superseded payload record names it, spending the correction ${by}.`);
  return { uploads: [file], rendered: recordFor({ kind, by, attached: file.name, was: held }) };
};
