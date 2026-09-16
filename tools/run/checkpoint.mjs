/* The landing checkpoint a release finishes. A ship wrote no landing state at all, so a branch its own
   run released stayed on the record as waiting to be landed and the next empty `land-ready` found it
   (ISS-1654). It reports and refuses nothing. docs/cli/the-checkpoint.md. */
import { gitOut } from "../checkout.mjs";
import { unshippedSays } from "./publish.mjs";
import { landingOf, LANDING_DONE, LANDING_READY } from "../../plugin/src/flow/landing/checkpoint.mjs";
import { landingSaved, readContext } from "../../plugin/src/flow/lease.mjs";
import { runIdAt, runsFor } from "../../plugin/src/resolve/session/run-id.mjs";
import { Refusal, refusing } from "../../plugin/src/resolve/settings.mjs";
import { Refused } from "../../plugin/src/refusal.mjs";
import { documentIdOf } from "../../plugin/src/tracker/issues.mjs";

/** The issues this tree was started for, off the id `start` minted into its git directory rather than
 *  off the branch name: a batch is one tree under one id, and the branch is named for its first key alone. */
export const keysHere = (tree) => runsFor(runIdAt(tree)).map((one) => one.toUpperCase());

const said = (why) => (why instanceof Refusal || why instanceof Refused ? why.message : why.message ?? String(why));

const held = async (key) => {
  const documentId = await documentIdOf(key);
  return { documentId, landing: landingOf(await readContext(documentId)) };
};

/* Why it was left standing and not only that it was: a refusal and another branch's are different things. */
const finished = async (key, branch, resume, { say, groan }) => {
  let read = null;
  try {
    read = await refusing(() => held(key));
  } catch (error) {
    return groan(`  ${key}: its landing checkpoint could not be read, so nothing of it moved — ${said(error)}\n`
      + `    read where it is:  forge resume ${key}\n`
      + `    and finish it:     ${resume}`);
  }
  const { documentId, landing } = read;
  if (!landing) return say(`  ${key} carries no landing checkpoint, so this release leaves none behind`);
  if (landing.state !== LANDING_READY) {
    return say(`  ${key} stays \`${landing.state}\`: this release finishes a checkpoint reading `
      + `\`${LANDING_READY}\` and no other state. Read where it is: forge resume ${key}`);
  }
  if (landing.branch !== branch) {
    return say(`  ${key} stays \`${landing.state}\`: its checkpoint names ${landing.branch ?? "no branch"} `
      + `and this release landed ${branch}. Read where it is: forge resume ${key}`);
  }
  try {
    await refusing(() => landingSaved(documentId, key, { state: LANDING_DONE }, { was: landing }));
  } catch (error) {
    return groan(`  ${key} stays \`${landing.state}\`, which is the branch this release landed, and the `
      + `write was refused — ${said(error)}\n    finish it: ${resume}`);
  }
  return say(`  ${key} reads \`${LANDING_DONE}\`: ${branch} is landed and released, so no turn of this `
    + `landing is left for anybody to take`);
};

/** Called from the release's last step, so a `--from` resume onto that step runs it again — which is
 *  why this proves the release rather than taking the step's place in the table for it. */
export const checkpointsFinished = async ({ tree, base, copy, resume, installs, ships },
  { say = console.log, groan = console.error } = {}) => {
  const keys = keysHere(tree);
  if (!keys.length) {
    return say(`  no landing checkpoint is finished here: this tree's git directory names no run, so `
      + `this release answers for no issue key`);
  }
  if (!copy || copy.stale) {
    return groan(`  no landing checkpoint is finished here: ${copy
      ? `the install record holds ${copy.installed} and this tree ships ${copy.running}`
      : "no install record answers for this plugin"}, so nothing says this release was installed.\n`
      + `    install it, and the checkpoints follow: ${installs}`);
  }
  /* The install answers for a version and this for the content: a resume reaches this step over a tree
     grown a commit since the push, under the version already installed. */
  const unshipped = unshippedSays(tree, base, gitOut(["rev-parse", "HEAD"], tree));
  if (unshipped) {
    return groan(`  no landing checkpoint is finished here: ${unshipped}, so nothing says what stands `
      + `here is what was released.\n    release this tree, and the checkpoints follow: ${ships}`);
  }
  const branch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"], tree);
  if (!branch) {
    return groan(`  no landing checkpoint is finished here: this tree could not be asked which branch `
      + `it is on, and a checkpoint is finished only for the branch this release landed`);
  }
  for (const key of keys) await finished(key, branch, resume, { say, groan });
};
