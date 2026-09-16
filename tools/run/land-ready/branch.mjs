/* The branch beside the head the landing merges. What lands is the judged head whatever this reads:
   a branch that moved is refused here, never followed. docs/cli/the-checkpoint.md. */
import { git, gitOut, lines, REMOTE } from "../../checkout.mjs";
import { remoteHeadOf, shortly } from "../install.mjs";
import { LANDING_READY } from "../../../plugin/src/flow/landing/checkpoint.mjs";

const NAMED = 5;

const subjects = (ahead) => [
  ...ahead.slice(0, NAMED).map((one) => `    ${one}`),
  ...(ahead.length > NAMED ? [`    ... and ${ahead.length - NAMED} more`] : []),
].join("\n");

/* The whole sha and not the short one: this push is run from whichever tree holds the judged head,
   and a tree that has not fetched the tip cannot resolve an abbreviation of it. */
const putBack = (branch, tip, judged) =>
  `    git push --force-with-lease=${branch}:${tip} ${REMOTE} ${judged}:refs/heads/${branch}`;

/* Only from the state that has it: past `ready` the capture is refused, which is ISS-1652's shape. */
const readAgain = (key, landing, tip) =>
  (landing.state === LANDING_READY
    ? `\n  or have this change read again at ${shortly(tip)} and write the checkpoint there:\n`
      + `    forge claim ${key} --pushed --ready`
    : "");

/* Three answers and not two, as `landedAlready` has: unreadable is the question unanswered, not a no. */
const unread = (key, self, why) =>
  `${why} Nothing is merged on a reading this uncertain — run this landing again, which fetches `
  + `that branch before it reads anything:\n    ${self} land-ready ${key}`;

/** The refusal a branch not standing at the judged head earns, or null. */
export const tipSaid = (tree, key, landing, self) => {
  const { branch, head } = landing;
  const judged = gitOut(["rev-parse", "--verify", `${head}^{commit}`], tree);
  const tip = remoteHeadOf(tree, branch);
  if (!judged) {
    return `${key} was judged at ${shortly(head)}, a commit this checkout cannot read even after `
      + `fetching ${branch}. ${tip ? `That branch stands at ${shortly(tip)} and this landing merges `
        + `the judged head and no other, so put it back from whichever tree still holds it:\n`
        + `${putBack(branch, tip, head)}`
        : `The build's own tree holds it — push that branch again.`}`;
  }
  if (!tip) {
    return unread(key, self, `${REMOTE} named nothing for ${branch}, which it answered for a moment `
      + `ago when this landing fetched that branch, so where the branch stands cannot be read here.`);
  }
  if (tip === judged) return null;
  const asked = git(["merge-base", "--is-ancestor", judged, tip], tree).status;
  if (asked > 1) {
    return unread(key, self, `${key} was judged at ${shortly(judged)} and ${branch} stands at `
      + `${shortly(tip)}, a commit this checkout does not hold: it was pushed after this landing `
      + `fetched the branch, so what is between the two cannot be read here.`);
  }
  if (asked === 1) {
    return `${key} was judged at ${shortly(judged)} and ${branch} stands at ${shortly(tip)}, which `
      + `does not reach it: the branch was rewritten and the head this landing merges is on no ref `
      + `of it. Nothing of the rewrite would be released and the landing after this one would fetch `
      + `a commit nobody holds. Put the judged head back:\n${putBack(branch, tip, judged)}`;
  }
  const ahead = lines(gitOut(["log", "--format=%h %s", `${judged}..${tip}`], tree) ?? "");
  return `${key} was judged at ${shortly(judged)} and ${branch} stands at ${shortly(tip)}, `
    + `${ahead.length} commit(s) past it:\n${subjects(ahead)}\n`
    + `What lands is the judged head, so those commits would stay on the branch with the release out `
    + `and nothing said of them. Take them off the branch, where whatever tree wrote them still `
    + `holds them:\n${putBack(branch, tip, judged)}${readAgain(key, landing, tip)}`;
};
