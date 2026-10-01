/* What a release-batch subcommand says when the tracker turns it down. The tracker lists every reason
   standing beside the first under `details.alsoBlocking`, which the transport's own refusal line does
   not carry, so a run told only the first would clear it and meet the second on its next call
   (ISS-1127 in the tracker's repository, ISS-1992 here). */
import { fail } from "../../resolve/settings.mjs";

const READINESS = "forge release-batch readiness";

const reasonLine = (one) => `  ${one?.code ?? "UNNAMED"}: ${one?.message ?? "(the tracker gave no sentence)"}`;

/** The refusal whole: the tracker's first reason as it said it, every other one it listed, and the
 *  read that lists them all. A call nobody answered is not a refusal and is said as it came. */
const refusedRelease = (verb, answer) => {
  if (answer?.status === undefined) fail(`release-batch ${verb}: ${answer.refused}`);
  const also = answer.details?.alsoBlocking ?? [];
  const beside = also.length
    ? `\nAlso standing, by the tracker's own list:\n${also.map(reasonLine).join("\n")}`
    : "";
  fail(`release-batch ${verb}: the tracker refused it.\n${answer.refused}${beside}\n`
    + `Every reason a release would be refused now: ${READINESS}`);
};

/** One soft call's answer, or the refusal above. */
export const answeredOr = (verb, answer) => (answer?.refused ? refusedRelease(verb, answer) : answer);

export const reasonLines = (list) => (list ?? []).map(reasonLine);
