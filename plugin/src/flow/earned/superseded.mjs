/* A verdict judged at a runtime the checkpoint no longer names as serving stops standing, and the
   rungs say which criterion and why rather than dropping the issue back with nothing named. Read at
   `testing` and at every rung after it, whatever the project's judgement: forge-core's release sweep
   counts such a verdict unearned on every project alike. */
import { need } from "../machine.mjs";
import { judgeAsk, numbered, owesRuntime, supersededProblem } from "../qa/verdicts.mjs";
import { markedCommit } from "../record/merged.mjs";
import { landsOutsideGit } from "../record/judged/landing.mjs";
import { identityOf } from "./asks.mjs";
import { shapeGaps } from "./shape-gaps.mjs";

/** One item per reason, its criteria named together, and the ask a fresh judgement at what serves. */
export const supersededOwed = (view, ref, exclude = new Set()) => {
  if (landsOutsideGit(view.issue)) return [];
  const each = new Map();
  for (const [number, { record }] of numbered(view.verdicts)) {
    if (exclude.has(number) || shapeGaps("verdict", record, view.names).length) continue;
    const why = supersededProblem(record.fields, view.landing);
    if (why) each.set(why, [...each.get(why) ?? [], [number, record.fields]]);
  }
  return [...each].map(([why, held]) => {
    const numbers = held.map(([number]) => number);
    const at = numbers.length > 1 ? `criteria ${numbers.join(", ")}` : `criterion ${numbers[0]}`;
    return need(`the verdict on ${at} ${why}`,
      judgeAsk(ref, numbers, view.landing, held[0][1], markedCommit(view.comments), identityOf(view), view.holders ?? [], null,
        owesRuntime(view.release, view.issue, view.landing)));
  });
};
