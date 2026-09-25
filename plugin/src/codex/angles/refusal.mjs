/* Which names a list of angles may hold, judged where a consult reads the list and where `forge doctor
   --set` writes it. Apart from codex.mjs so the project file's writer can import the judgement without
   the verb. */
import { didYouMean } from "../../suggest.mjs";
import { ANGLES } from "../codex-api.mjs";
import { DEFAULT_ANGLES } from "../codex-plan.mjs";

/** Why a list of angles cannot review a consult, or null. One judgement for the consult that reads the
 *  list and the `--set` that writes it, so a write never stores what the next consult refuses, and
 *  the names are the shipped table's keys, so an angle added to it needs no second list. */
export const anglesRefusal = (angles, from) => {
  const names = Object.keys(ANGLES);
  if (!angles.length) return `${from} names no angle. Name some of ${names.join(", ")}, or drop the key for the default, ${DEFAULT_ANGLES.join(", ")}.`;
  const unknown = angles.find((one) => !Object.hasOwn(ANGLES, one));
  return unknown === undefined ? null : didYouMean("angle", unknown, names);
};
