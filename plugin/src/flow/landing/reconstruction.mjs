/* A landing checkpoint nobody captured, written afterwards and saying so. The capture is derived
   from a branch-against-base diff and a merge makes that diff empty, so the window it can be taken
   in closes at the landing and what is written after it is a reconstruction rather than a record
   (ISS-2045). Nothing here reaches git or the tracker: it reads the block and the holders it is
   handed, which is what lets both the gate and the write call it. docs/cli/the-reconstruction.md. */

export const HAND_WRITTEN = "handWritten";

/* `builder` is the block's statement about the builder and `why` its statement about itself: the
   first is what lets an unknown builder stand, so the two are not one key. */
const SAID = ["by", "at", "why", "builder"];

/** The block as a record, or null where there is none. A block saying nobody wrote it says nothing:
 *  what makes a reconstruction admissible is that somebody is on it, not that the key is present. */
export const handWrittenOf = (held) => {
  const block = held?.[HAND_WRITTEN];
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const out = {};
  for (const name of SAID) if (block[name]) out[name] = String(block[name]);
  const lost = (Array.isArray(block.lost) ? block.lost : []).map((one) => String(one).trim());
  const kept = lost.filter(Boolean);
  if (kept.length) out.lost = kept;
  return out.by ? out : null;
};

/** Every distinct holder the issue's claim history names as having held it while the change was
 *  still being built. One of them is the builder; several is a choice no record here can make.
 *  `builds` reads a claim's own recorded status and comes from the caller, the order of the statuses
 *  being the flow's and not this file's — every run that reaches this claimed the issue to do so, so
 *  a set counting the judging claims alongside the building ones names a holder that nothing on the
 *  record proposes as the builder. A status this predicate cannot place counts as a build, which
 *  leaves the declaration standing rather than deriving a builder off a reading nobody made. */
export const holdersOf = (context, builds = () => true) => [...new Set(
  (Array.isArray(context?.lease?.history) ? context.lease.history : [])
    .filter((one) => builds(one?.status))
    .map((one) => String(one?.holder ?? "").trim())
    .filter(Boolean),
)];

export const RECOVER_THE_BUILDER = (holder) =>
  `Write the checkpoint naming \`${holder}\` as the builder rather than declaring it unrecoverable.`;

/** Why a checkpoint's builder does not stand, or null where it does — whether it was captured or
 *  declared unrecoverable. The one statement of the rule, read by the gate and by the write.
 *  The holders are the ones a build could have been done under, which `holdersOf` is what decides. */
export const builderProblem = (landing, holders = []) => {
  if (landing?.builder) return null;
  const hand = landing?.[HAND_WRITTEN] ?? null;
  if (!hand) {
    return "has no landing checkpoint naming a builder, and nothing on it says a builder could not "
      + "be recovered: a record nobody made reads here exactly like one nobody can make";
  }
  if (!hand.builder) {
    return `carries a checkpoint ${hand.by} rebuilt by hand that says nothing about the builder, so `
      + "the builder reads as one nobody wrote down rather than as one nobody can";
  }
  /* The declaration is refused where the record answers the question itself: a builder derivable
     from one holder and declared unrecoverable is a guess in the other direction, and a guessed
     builder is the fabrication this key exists to stop (ISS-2045). */
  if (holders.length === 1) {
    return `carries a checkpoint ${hand.by} rebuilt by hand calling the builder unrecoverable, and `
      + `the claim history on this issue names exactly one run that held it while the change was `
      + `being built, \`${holders[0]}\`: a builder the record answers for is derived and not `
      + `declared. ${RECOVER_THE_BUILDER(holders[0])}`;
  }
  return null;
};

/** What every reader of the checkpoint appends, so a verdict read back against a reconstruction is
 *  never mistaken for one read back against a capture. Empty where the checkpoint was captured. */
export const rebuiltSaid = (landing) => {
  const hand = landing?.[HAND_WRITTEN] ?? null;
  if (!hand) return "";
  return ` — rebuilt by hand by ${hand.by}${hand.at ? ` on ${hand.at}` : ""}`
    + `${hand.lost ? `, which recovered no ${hand.lost.join(", ")}` : ""}`;
};
