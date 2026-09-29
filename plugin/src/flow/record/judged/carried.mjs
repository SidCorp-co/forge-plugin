/* What a verdict's write says about the landing. Where the commit judged is not the merged commit,
   the record names the merged commit it carries, read off git here and never typed: the rung that
   reads it reads no repository, and a later commit carrying the landing is how a criterion another
   change made true is judged honestly (ISS-1302). */
import { commitCarries } from "../../../git/carries.mjs";
import { sameCommit, shortSha } from "../../../tracker/evidence.mjs";
import { CARRIES } from "../../machine.mjs";
import { markedCommit } from "../merged.mjs";

/* Per commit pair and checkout, since one write's verdicts usually name one commit and git's answer
   is the same for each of them: five spawns a criterion otherwise. */
const asked = new Map();
const carriesOnce = (merged, judged, cwd) => {
  const key = JSON.stringify([merged, judged, cwd]);
  if (!asked.has(key)) asked.set(key, commitCarries(merged, judged, cwd));
  return asked.get(key);
};

/** Fills `got.carries` where git reads the commit judged as carrying the merged commit, and says on
 *  `say` what it read either way; a verdict at the merged commit, or before any mark, asks nothing. */
export const carriedOnto = (got, comments, say, cwd = process.cwd()) => {
  const merged = markedCommit(comments);
  const judged = got.commit;
  if (!merged || !judged || sameCommit(judged, merged)) return;
  const read = carriesOnce(merged, judged, cwd);
  const at = `--commit ${shortSha(judged)}`;
  if (read.carries) {
    got[CARRIES] = merged;
    say(`${at} carries the merged commit ${shortSha(merged)}, as this checkout's git reads it, and the `
      + "verdict says so: `testing` reads it as judged at the landing.");
    return;
  }
  say(read.carries === false
    ? `${at} does not carry the merged commit ${shortSha(merged)}: ${read.why}. The verdict says `
      + "nothing of it, and earns `testing` only at the head the mark names as judged."
    : `This checkout cannot say whether ${at} carries the merged commit ${shortSha(merged)}: `
      + `${read.why}. The verdict says nothing of it; written from a checkout holding both, it would.`);
};
