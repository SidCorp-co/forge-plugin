/* The close from `awaiting_release`, the holder's once its criteria are met in scope (forge ISS-1062):
   the shape of --unmet judged before a credential is spent, and the flag a refusal of it names. */
import { refuse } from "../refusal.mjs";
import { UNMET_FORM, pastJudgingOwed } from "./earned.mjs";
import { CLOSES_FROM } from "./machine.mjs";

/* The shape a close can be judged on before a credential is spent; where each criterion may go is core's. */
export const unmetOf = (raw) => {
  if (raw === undefined) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    refuse(`--unmet takes a JSON list, and \`${raw}\` does not parse (${error.message}). Nothing was sent:\n  ${UNMET_FORM}`);
  }
  const bad = !Array.isArray(parsed) || !parsed.length
    || parsed.some((one) => !one || typeof one !== "object" || one.criterion === undefined || one.to === undefined);
  if (bad) refuse(`--unmet takes a list of { criterion, to } with at least one entry, so nothing was sent:\n  ${UNMET_FORM}`);
  return parsed;
};

/* What a plain close still owes: each criterion core's release sweep counts unearned, judged again or moved out in --unmet. */
export const closeHeld = (view, ref) => pastJudgingOwed(view, ref).map((one) => ({ ...one,
  command: `${one.command}\n  or, where it stays unmet past this close: forge advance ${ref} ${UNMET_FORM}` }));

/* Core's refusal of a close names the criterion it could not place and no flag, so the flag is said here. */
export const closeIsPlaced = (view, status, ref) => (status !== "closed" || view.issue.status !== CLOSES_FROM ? ""
  : ` A close names where each unmet or failing criterion goes (CLOSE_CRITERION_UNPLACED otherwise):\n  `
    + `forge advance ${ref} ${UNMET_FORM}`);
