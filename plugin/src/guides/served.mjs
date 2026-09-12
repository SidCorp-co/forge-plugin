/* The part the verb that acts carries: which phase the record says the act is in, the text the guide
   verb would print for it, and the ledger deciding what a second act of the same kind gets. Nothing here writes a word of the method, and nothing here prints: the caller hands in its own printer, so the credit follows the delivery at every call site rather than at whichever ones remembered to. Why a part is the whole text or nothing, why each phase holds a surface of its own, and what a run with no id is served: docs/cli/addressing-a-part.md. */
import { localGuide } from "./guides.mjs";
import { phaseAtLanding, phaseForRecord, phaseNumber } from "./phases.mjs";
import { noteShown, owedOf, sessionKey } from "../shown/ledger.mjs";

export const SLUG = "issue-flow";

export const surfaceFor = (phase) => `served-${SLUG}-${phase}`;

export const phasePart = (phase, print, { rung = null, session = sessionKey() } = {}) => {
  if (!Number.isInteger(phase)) return;
  const answer = localGuide(SLUG)?.({ part: String(phase), rung });
  if (!answer || answer.refusal) return;
  const text = answer.lines.join("\n");
  const surface = surfaceFor(phase);
  if (session && !owedOf(session, surface, text).owed) return;
  print(text);
  if (session) noteShown(session, surface, text);
};

export const partForStatus = (status, print, rung = null) => phasePart(phaseNumber(status), print, { rung });

export const partForRecord = (kind, print, rung = null) => phasePart(phaseForRecord(kind), print, { rung });

export const partForLanding = (print, rung = null) => phasePart(phaseAtLanding(), print, { rung });
