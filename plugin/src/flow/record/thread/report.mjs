/* `forge resume --report`: every record on an issue, printed by kind, with the plan, the note, the
   run's own captures and what is still owed. Apart from `record.mjs` because the report is resume's and
   writes nothing, and a verb reading it out of the record verb's module would load that verb's tree.
   docs/cli/record.md. */
import { commentPage, cutIn, cutLine } from "../../../tracker/comments.mjs";
import { personOwedForRelease, releaseAnswer, releasePolicy } from "../../../tracker/project-config.mjs";
import { pluginFilingLine } from "../../../tracker/filing/plugin-defect.mjs";
import { workLines } from "../../../guides/phases.mjs";
import { CLOSES_FROM, SHAPES, heldSaid, planTyped, unwrap } from "../../machine.mjs";
import { FIELD as SESSION } from "../../lease.mjs";
import { worklogLines, worklogOf, workNow } from "../../worklog.mjs";
import { CLOSES_AT, setForm } from "../../earned.mjs";
import { assemble, printRecord } from "../page.mjs";
import { criteriaLines } from "../fields.mjs";
import { issueOf } from "./posting.mjs";

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
  /* Wherever the issue stands, because this report is where the method sends a run for the policy's answer, and one that first reads it at the rung it is already standing on has read it a phase late. Printed in the answer that owes nobody too: a run told only that the close is owed cannot tell a policy this CLI read from one it never consulted, and a run holding this line beside `forge doctor`'s own rows can settle which of them moved (ISS-1656). */
  const policy = await releasePolicy();
  console.log(`\nRelease policy  ${releaseAnswer(policy)}`);
  /* Where a run stops, and the route it leaves for whoever picks the issue up from here: a set, which is the only move out of this rung the entry check `earned.mjs` holds for `closed` admits (ISS-105, ISS-1147, ISS-1918). The act itself is named once, on the line above, and this one says only whose the next move is. */
  if (body.status === CLOSES_FROM) {
    console.log(personOwedForRelease(policy)
      ? `Owed: the release, which is a person's. The line above says whose act it is and what would `
        + `end the rung, so this run ends at ${CLOSES_FROM} and the close is theirs, made once it is `
        + `out and with the release named:\n  ${setForm(reference, CLOSES_AT)}`
      : `Owed: the close. A run ends at closed, not at ${CLOSES_FROM}:\n  forge advance ${reference}`);
  }
};
