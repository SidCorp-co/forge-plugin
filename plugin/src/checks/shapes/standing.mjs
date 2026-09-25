/* A shape checker landing on a tree that already holds the shape cannot refuse it outright, and a
   list of the standing instances is a licence every one of them keeps. A count is neither: the tree
   may hold that many and no more, a change that removes one writes the lower number, and nothing
   writes a higher one (ISS-2502). The counts live in this repository's `package.json`, one key per
   checker under `standing`, so the number a change lowered travels with the change. */

export const CONFIG = "package.json";
export const STANDING = "standing";

/** The count one checker stands at, read off the parsed configuration, or a thrown refusal naming
 *  the key to write: a checker with no count has no number to hold the tree to. */
export const standingOf = (config, key) => {
  const held = config?.[STANDING]?.[key];
  if (Number.isInteger(held) && held >= 0) return held;
  throw new Error(`${CONFIG} holds no count at \`${STANDING}.${key}\` (it reads ${JSON.stringify(held)}), `
    + "so this checker has nothing to hold the tree to. Write the number of findings the tree holds "
    + "today there, as a whole number.");
};

/** What the tree owes against its count: nothing where the two agree; the findings themselves where
 *  it holds more; the lower number to write where it holds fewer, so a count once lowered stays. */
export const standingProblems = ({ key, problems, standing }) => {
  const found = problems.length;
  const at = `\`${STANDING}.${key}\` in ${CONFIG}`;
  if (found > standing) {
    return [`${found} finding(s) where ${at} stands at ${standing}. The count may only fall, so fix the `
      + `finding this change added rather than raising it; every one the tree holds follows:`, ...problems];
  }
  if (found < standing) {
    return [`${found} finding(s) where ${at} stands at ${standing}: this tree holds fewer, so write ${found} `
      + "there, which keeps the one removed from coming back under the old number."];
  }
  return [];
};

/** Each count `now` holds above the one `base` held. A key the base does not hold is a checker the
 *  change introduces, whose count starts at what the tree holds. */
export const raisedCounts = (now, base) => Object.entries(now?.[STANDING] ?? {})
  .filter(([key, held]) => Number.isInteger(base?.[STANDING]?.[key]) && held > base[STANDING][key])
  .map(([key, held]) => `\`${STANDING}.${key}\` in ${CONFIG} is ${held} where the default branch holds `
    + `${base[STANDING][key]}. A change can lower a standing count and never raise it: put back `
    + `${base[STANDING][key]} and fix the finding the checker names instead.`);
