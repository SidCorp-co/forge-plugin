/* Whether a record read back off the page is a whole payload for its kind: every field the shape
   declares, the stamp, the evidence a field naming one owes, and the shape's own check. `parse`
   resolves the keys and applies none of the shape's rules, so a comment carrying the tag and little
   else — by hand, or through a client no gate sits before — is measured against the write's own
   rules here. A commit that is not one compares equal to a short sha by prefix, which is why the
   form counts. Apart from earned.mjs, which answers for eight statuses and would otherwise carry
   this reading too, and route.mjs imports it the same way earned.mjs itself does. */
import { SHAPES_AT, contractGap, shapesAt } from "../machine/contracts.mjs";
import { evidenceHeld, isCommit } from "../../tracker/evidence.mjs";
import { eachProblem } from "../record/content.mjs";
import { landingProblem } from "../record/landing.mjs";

export const shapeGaps = (kind, record, names = [], table = SHAPES_AT) => {
  const shapes = shapesAt(record.contract, table);
  if (!shapes) return [contractGap(record.contract, table)];
  const shape = shapes[kind];
  if (!shape) return [`a ${kind} record, which contract ${record.contract} has no shape for`];
  const got = Object.fromEntries(shape.fields.map((field) =>
    [field.flag, field.many ? record.fields[field.flag] ?? [] : record.fields[field.flag]]));
  const gaps = shape.fields
    .filter((field) => {
      const held = got[field.flag];
      if (field.many) return held.length < (field.least ?? 1);
      if (held === undefined) return !field.optional && !field.newer;
      return Boolean(field.oneOf) && !field.oneOf.includes(held);
    })
    .map((field) => `--${field.flag}`);
  for (const field of shape.fields) {
    const held = got[field.flag];
    if (field.many) {
      const said = eachProblem(field, held);
      if (said) gaps.push(`--${field.flag}, which ${said}`);
      continue;
    }
    if (held === undefined) continue;
    if (field.commit && !isCommit(held)) gaps.push(`--${field.flag} \`${held}\`, which is no commit`);
    if (field.landing && landingProblem(held)) gaps.push(`--${field.flag} \`${held}\`, which ${landingProblem(held)}`);
    if (field.criterion && !/^\d+\b/u.test(held)) gaps.push(`--${field.flag} \`${held}\`, which opens with no number`);
  }
  if (shape.stamp && record.fields[shape.stamp.flag] === undefined) gaps.push(`its ${shape.stamp.label} stamp`);
  for (const field of shape.fields.filter((one) => one.evidence)) {
    for (const ref of got[field.flag]) {
      if (!evidenceHeld(ref, names)) gaps.push(`--${field.flag} \`${ref}\`, which is no attachment here, no URL and no commit`);
    }
  }
  const said = shape.check?.(got);
  return said ? [...gaps, said] : gaps;
};
