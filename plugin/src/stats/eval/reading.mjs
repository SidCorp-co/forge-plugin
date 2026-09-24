/* What a reading says about itself rather than about the runs: the rules its figures were taken
   under, and what each of its top-level counts was counted over. */

/* The rule set that produced a reading's figures, bumped when one of them moves. Two readings whose
   field names match can measure different populations — on this repository two admission tests over
   one transcript set disagreed by a third — so a held reading says what it was taken under rather
   than leaving a reader to assume the answer is today's (ISS-1984). Rev 2 added `served` and
   `populations`; a rev 1 reading's `copies` is the same machine-wide count and it holds no `served`. */
const CONTRACT = 2;

/* Each count at the top of a reading beside what it was counted over: `copies` and `total` read as a
   numerator and a denominator and are two populations, which two readings of this project divided. */
export const POPULATIONS = {
  total: "this project's admitted issue-flow run(s)",
  copies: "installed copies under this machine's plugin cache root, whichever project each served",
  served: "installed copies at least one of this project's admitted runs began under, the count a per-copy rate is taken against",
};

/* Read off the profile rather than worked out again here, so a reading says what its own figures
   were computed with and cannot disagree with them. */
export const contractOf = (profile) => ({
  rev: CONTRACT,
  act: profile?.release ?? null,
  said: profile?.releaseSaid ?? null,
  table: profile?.table ?? null,
  declares: profile?.declares ?? null,
});
