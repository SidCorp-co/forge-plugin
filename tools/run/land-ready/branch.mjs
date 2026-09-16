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

/* Leased on the tip this landing read, so a branch moved again between the two is refused by git. */
const putBack = (branch, tip, judged) =>
  `    git push --force-with-lease=${branch}:${shortly(tip)} ${REMOTE} ${judged}:refs/heads/${branch}`;

/* Only from the state that has it: past `ready` the capture is refused, which is ISS-1652's shape. */
const readAgain = (key, landing, tip) =>
  (landing.state === LANDING_READY
    ? `\n  or have this change read again at ${shortly(tip)} and write the checkpoint there:\n`
      + `    forge claim ${key} --pushed --ready`
    : "");

/** The refusal a branch not standing at the judged head earns, or null. A tip the remote will not
 *  name is the question going unanswered rather than a branch that moved, so it reads as clean. */
export const tipSaid = (tree, key, landing) => {
  const { branch, head } = landing;
  const judged = gitOut(["rev-parse", "--verify", `${head}^{commit}`], tree);
  const tip = remoteHeadOf(tree, branch);
  if (judged && (!tip || tip === judged)) return null;
  if (!judged) {
    return `${key} was judged at ${shortly(head)}, a commit this checkout cannot read even after `
      + `fetching ${branch}. ${tip ? `That branch stands at ${shortly(tip)} and this landing merges `
        + `the judged head and no other, so put it back from whichever tree still holds it:\n`
        + `${putBack(branch, tip, head)}`
        : `The build's own tree holds it — push that branch again.`}`;
  }
  if (git(["merge-base", "--is-ancestor", judged, tip], tree).status !== 0) {
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
