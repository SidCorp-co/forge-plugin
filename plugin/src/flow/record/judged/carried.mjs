/* What a verdict's write says about the landing. Where the commit judged is not the merged commit,
   the record names the merged commit it carries, read off git here and never typed: the rung that
   reads it reads no repository, and a later commit carrying the landing is how a criterion another
   change made true is judged honestly (ISS-1302). */
import { commitCarries } from "../../../git/carries.mjs";
import { isCommit, sameCommit, shortSha } from "../../../tracker/evidence.mjs";
import { CARRIES, CARRIES_DEPLOYMENT } from "../../machine.mjs";
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

/** Fills `got["carries-deployment"]` where git reads a commit the verdict cites as carrying the deployment
 *  the landing checkpoint names, which is how a judge citing the commit staging served, a later one
 *  than the merge the checkpoint names, is read as having judged that deployment (ISS-2587). The
 *  commits the evidence cites are asked in turn and the first that carries it is enough; one citing the
 *  deployment itself, or a checkpoint naming none, asks nothing. What it read is said on `say`,
 *  including the two routes where the checkout could not settle it. */
export const deploymentOnto = (got, landing, say, cwd = process.cwd()) => {
  const deployment = landing?.deployment;
  const cited = (got.evidence ?? []).filter((one) => isCommit(one));
  /* A runtime is the verdict's identity and `testing` reads it alone, so a stamp beside it would be a second reading of the deployment. */
  if (got.runtime !== undefined) return;
  if (!deployment || !cited.length || cited.some((one) => sameCommit(one, deployment))) return;
  /* Only the failure's sentences read every answer, and they are reached only where none carries it. */
  const reads = [];
  let carrier = null;
  for (const one of cited) {
    const read = carriesOnce(deployment, one, cwd);
    reads.push({ one, read });
    if (read.carries) {
      carrier = { one, read };
      break;
    }
  }
  const at = `the deployment ${shortSha(deployment)} the landing checkpoint names`;
  if (carrier) {
    got[CARRIES_DEPLOYMENT] = deployment;
    say(`--evidence ${shortSha(carrier.one)} carries ${at}, as this checkout's git reads it, and the `
      + "verdict says so: `testing` reads it as citing that deployment.");
    return;
  }
  const unsettled = reads.find((each) => each.read.carries === null);
  say(unsettled
    ? `This checkout cannot say whether --evidence ${shortSha(unsettled.one)} carries ${at}: `
      + `${unsettled.read.why}. The verdict says nothing of it, so \`testing\` refuses it unless it cites `
      + `${shortSha(deployment)} itself: add \`--evidence ${shortSha(deployment)}\`, or write it from a `
      + "checkout holding both commits."
    : `No commit this verdict cites carries ${at} (${reads.map((each) => each.read.why).join("; ")}), `
      + `so \`testing\` refuses it unless it cites ${shortSha(deployment)} itself.`);
};
