/* The one term an issue's own fields cannot give: what the batch reading at the review mark owes,
   read off the same reckoning the ship and `forge doctor` print, so the three cannot disagree about
   how far past its threshold a range has grown. Why a reading ranks by its debt rather than by the
   fields it was filed with: docs/cli/next-weights.md. */
import { readingCovers, reviewStanding } from "../git/reviewed.mjs";

const SHORT = 7;

/** The multiple of the threshold a range holds, to one decimal, as every surface prints it. */
export const multipleOf = (changed, lines) => Math.round((changed / lines) * 10) / 10;

/** The term off a standing already read: `termOf(row)` answers `{ said, points }` for the takeable
 *  row whose title opens the batch at the mark, and null for every other row and every standing that
 *  owes nothing. A project that declared no volume has a null standing and weighs nobody. */
export const readingTermFrom = (standing, weights) => {
  if (!standing || standing.refusal || standing.uncountable || !standing.mark || !standing.owed) {
    return { termOf: () => null, refusal: standing?.refusal ?? null };
  }
  const threshold = standing.lines.value;
  const multiple = standing.changed / threshold;
  const term = {
    said: `${standing.mark.slice(0, SHORT)}..HEAD ${multipleOf(standing.changed, threshold)}x ${threshold}`,
    points: Math.round(weights.reading * multiple),
  };
  return { termOf: (row) => (readingCovers(row?.title, standing.mark) ? term : null), refusal: null };
};

/** The term for the checkout `tree` names, or none where no checkout is named. */
export const readingTerm = (tree, weights) => readingTermFrom(tree ? reviewStanding(tree) : null, weights);
