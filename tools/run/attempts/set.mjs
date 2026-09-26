/* Each member's attempt in one pass of a set: opened before its first step and ended once the pass is
   over, whichever way it ended. The cause is the one the stop that ended it carried, kept on the member
   where the member left the set alone and on the set where the pass stopped with it in. What the
   records are and who reads them: docs/cli/stats-the-landing.md. */
import { BACK, LANDED, attemptEnded, attemptOpened } from "../../../plugin/src/stats/marks/attempts.mjs";

const VERB = "land-ready";

/** One opening per member, `pastGate` where the pass resumes after its gate, so the candidate the
 *  checkpoint holds is the one a landed ending would already carry. */
export const attemptsOpened = (members, root, pastGate) => members.map((member) => {
  member.cause = null;
  const candidate = pastGate ? member.landing.candidate || null : null;
  return [member, attemptOpened({ root, issue: member.key, verb: VERB, candidate })];
});

/** Landed where the pass was whole or its push went out, for the members still in the set; every
 *  other member back, with its own cause, or the set's where it stopped with the set. */
export const attemptsEnded = (opened, at, whole) => {
  const landed = whole || Boolean(at.pushed);
  for (const [member, handle] of opened) {
    const kept = at.members.includes(member);
    if (landed && kept) {
      attemptEnded(handle, { outcome: LANDED, candidate: at.candidate ?? member.landing.candidate ?? null });
      continue;
    }
    attemptEnded(handle, { outcome: BACK, cause: member.cause ?? (kept ? at.cause : null) ?? null });
  }
};
