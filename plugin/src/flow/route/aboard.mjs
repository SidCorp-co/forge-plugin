/* The route from `draft` onto the ladder, and why it turns on the mode the project declares for its
   `open` state: docs/cli/record-the-rung.md (ISS-3093). */
import { openStarts } from "../../tracker/project-config.mjs";
import { DRAFT } from "../../rank/weights.mjs";
import { BASELINE_AT, CHECKS, ORDER, dispositionOf } from "../earned.mjs";

const OPENING = ORDER[0];

/* Every rung between the opening one and the rung a build is entered at, that rung included: the
   records each is entered on are what the route past them owes, the statuses being the only thing
   it skips. */
export const PASSED = ORDER.slice(1, ORDER.indexOf(BASELINE_AT) + 1);

/** The sentence under the owed line, read off the view rather than carried beside the target, so
 *  every printer of that line says it whatever it was handed. */
export const draftSaid = (view) => {
  const { starts, said } = openStarts(view.release);
  return starts
    ? `\`${DRAFT}\` is before the ladder, and \`${OPENING}\` is passed over: ${said}.`
    : `\`${DRAFT}\` is before the ladder, and \`${OPENING}\` is the way onto it: ${said}.`;
};

/** `targetOf`'s answer for an issue at `draft`. */
export const draftTarget = (view, ref) => {
  if (!openStarts(view.release).starts) return { next: OPENING, missing: [], resumed: false };
  if (dispositionOf(view)) return { next: "dropped", missing: [], resumed: false };
  return { next: BASELINE_AT, missing: PASSED.flatMap((rung) => CHECKS[rung](view, ref)), resumed: false };
};
