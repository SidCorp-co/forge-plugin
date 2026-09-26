/* The two readings a release leaves the harness, taken by every route that installs one — the ship
   and the landing alike — so a release is readable by `stats eval --since-release` and `stats change`
   whichever route took it (ISS-2435). */
import { corpusOf } from "../../../plugin/src/stats/corpus/read.mjs";
import { WINDOW, releaseMark, runsMark } from "../../../plugin/src/stats/eval/eval.mjs";

/** The count reading where the corpus crossed a window, and the release reading whatever the count:
 *  the version, the head and the keys it landed are what a reading taken later cannot work out for
 *  itself, and the keys are what resolves a change to the copy that carried it. A reading that could
 *  not be taken is said and carried past, since the release it describes has already gone out.
 *  Both are taken off one read of the corpus: the release reading needs the whole of it every time,
 *  so a second read to judge the crossing costs a release the corpus's whole parse again and buys a
 *  count taken a moment later than the one the release reading holds (ISS-495). */
export const releaseReadings = async (root, { version, head, issues }, say = console.log) => {
  try {
    const corpus = await corpusOf(root);
    const mark = await runsMark(root, WINDOW, corpus);
    if (mark) say(`  ${mark}`);
    const held = await releaseMark(root, { version, head, issues }, WINDOW, corpus);
    if (held) say(`  ${held}`);
  } catch (error) {
    say(`  stats: no reading of this release was taken (${error.message}); the release itself stands.`);
  }
};
