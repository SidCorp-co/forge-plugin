/* The branch beside the head the landing merges. What lands is the judged head whatever this reads:
   a branch that moved is refused here, never followed. docs/cli/the-checkpoint.md. */
import { git, gitOut, lines, REMOTE } from "../../checkout.mjs";
import { remoteHeadOf, shortly } from "../install.mjs";
import {
  LANDING_HEAD_OWED, LANDING_STATES, RECAPTURE,
} from "../../../plugin/src/flow/landing/checkpoint.mjs";

const NAMED = 5;

const subjects = (ahead) => [
  ...ahead.slice(0, NAMED).map((one) => `    ${one}`),
  ...(ahead.length > NAMED ? [`    ... and ${ahead.length - NAMED} more`] : []),
].join("\n");

/* The whole sha and not the short one: this push is run from whichever tree holds the judged head,
   and a tree that has not fetched the tip cannot resolve an abbreviation of it. */
const putBack = (branch, tip, judged) =>
  `    git push --force-with-lease=${branch}:${tip} ${REMOTE} ${judged}:refs/heads/${branch}`;

/* The states a moved branch is handed back from, the ones the table leads to `head-owed`: past them
   the candidate was judged or promoted, and a head the builder moved is no longer this landing's to
   send back. */
const HANDS_BACK = new Set(Object.entries(LANDING_STATES)
  .filter(([, row]) => row.next.includes(LANDING_HEAD_OWED)).map(([name]) => name));

/* The re-capture first, the branch being the builder's to answer for, and the push second, for
   commits that are no answer of this change's: either way the builder writes the checkpoint again. */
const handBack = (key, branch, tip, judged, which) =>
  `The branch goes back to the run that built it at \`${LANDING_HEAD_OWED}\`, and this landing writes `
  + `no ref of it. Where ${which} this change's answer, that run captures ${shortly(tip)}:\n`
  + `${RECAPTURE(key, "    ")}\n`
  + `Where ${which} not, it puts the judged head back, from whichever tree holds it, and captures `
  + `that head the same way:\n${putBack(branch, tip, judged)}`;

/* Three answers and not two, as `landedAlready` has: unreadable is the question unanswered, not a no. */
const unread = (key, self, why) =>
  `${why} Nothing is merged on a reading this uncertain — run this landing again, which fetches `
  + `that branch before it reads anything:\n    ${self} land-ready ${key}`;

/** The refusal a branch not standing at the judged head earns, or null; `back` where the checkpoint
 *  goes to the builder with it, which only a branch this checkout read standing elsewhere earns. */
export const tipSaid = (tree, key, landing, self) => {
  const { branch, head } = landing;
  const judged = gitOut(["rev-parse", "--verify", `${head}^{commit}`], tree);
  const tip = remoteHeadOf(tree, branch);
  const back = HANDS_BACK.has(landing.state);
  if (!judged) {
    return { back: false, said: `${key} was judged at ${shortly(head)}, a commit this checkout cannot read even after `
      + `fetching ${branch}. ${tip ? `That branch stands at ${shortly(tip)} and this landing merges `
        + `the judged head and no other, so put it back from whichever tree still holds it:\n`
        + `${putBack(branch, tip, head)}`
        : `The build's own tree holds it — push that branch again.`}` };
  }
  if (!tip) {
    return { back: false, said: unread(key, self, `${REMOTE} named nothing for ${branch}, which it answered for a moment `
      + `ago when this landing fetched that branch, so where the branch stands cannot be read here.`) };
  }
  if (tip === judged) return null;
  const asked = git(["merge-base", "--is-ancestor", judged, tip], tree).status;
  if (asked > 1) {
    return { back: false, said: unread(key, self, `${key} was judged at ${shortly(judged)} and ${branch} stands at `
      + `${shortly(tip)}, a commit this checkout does not hold: it was pushed after this landing `
      + `fetched the branch, so what is between the two cannot be read here.`) };
  }
  if (asked === 1) {
    return { back, said: `${key} was judged at ${shortly(judged)} and ${branch} stands at ${shortly(tip)}, which `
      + `does not reach it: the branch was rewritten and the head this landing merges is on no ref `
      + `of it. Nothing of the rewrite would be released and the landing after this one would fetch `
      + `a commit nobody holds. ${back ? handBack(key, branch, tip, judged, "the rewrite is")
        : `Put the judged head back:\n${putBack(branch, tip, judged)}`}` };
  }
  const ahead = lines(gitOut(["log", "--format=%h %s", `${judged}..${tip}`], tree) ?? "");
  return { back, said: `${key} was judged at ${shortly(judged)} and ${branch} stands at ${shortly(tip)}, `
    + `${ahead.length} commit(s) past it:\n${subjects(ahead)}\n`
    + `What lands is the judged head, so those commits would stay on the branch with the release out `
    + `and nothing said of them. ${back ? handBack(key, branch, tip, judged, "they are")
      : `Take them off the branch, where whatever tree wrote them still holds them:\n`
        + putBack(branch, tip, judged)}` };
};
