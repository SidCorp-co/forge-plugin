/* The one park a landing writes on its own account: `mergeStep` in tools/run/land-ready.mjs, over a
   branch that does not merge onto the pin. Composed here, and not read off two copies of one
   sentence, since the writer and the readers that recognize it again — `claim --pushed --ready`'s
   lift, and the landing's own refusal to start over a park still standing — sit apart (ISS-2832). */
import { sameCommit } from "../../tracker/evidence.mjs";

/* The phrase this park's reason always carries. Read beside the evidence below and never alone: a
   person's own `blocked` park is free text, and only the checkpoint's own head, nobody's to hold by
   hand, proves where a park came from. */
export const CONFLICT_MARK = "The landing repairs no conflict";

export const CONFLICT_PARK_KIND = "blocked";

/* Whether a park record found on the page is this landing's own conflict park, and not a person's or
   the triage's `blocked` park (route.mjs's own), either of which could carry this phrase by
   coincidence or by copying the words. What neither of those writes is the checkpoint's own head as
   this park's evidence: `mergeStep` parks with `[landing.head, at.pin]` (ISS-2449), and `landing.head`
   there is the head the checkpoint still names, untouched by the park itself. `fields` is a park's own
   fields, off the record `parkThatSet` returns; `checkpointHead` is that checkpoint's `head` as the
   caller holds it, read before this call could have moved it on. */
export const isConflictPark = (fields, checkpointHead) =>
  Boolean(fields) && fields.kind === CONFLICT_PARK_KIND
  && String(fields.why ?? "").includes(CONFLICT_MARK)
  && (fields.evidence ?? []).some((one) => sameCommit(one, checkpointHead));
