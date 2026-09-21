/* Whether an issue's verdicts were judged by somebody other than the run that built the change. `earned.mjs` spends the first reading at `testing`, a promotion the second; why each is the shape it is: docs/cli/the-entry-checks.md. */
import { INHERITED, INHERITED_MEANS, OWN_ID } from "../../resolve/config.mjs";
import { JUDGE_FROM } from "../machine.mjs";
import { QA_MODES, judgementOf } from "../../tracker/project-config.mjs";
import { isCommit, sameCommit, shortSha as short } from "../../tracker/evidence.mjs";
import { builderProblem } from "../landing/reconstruction.mjs";

export const [INDEPENDENT] = QA_MODES;

const asksIndependent = (release) => judgementOf(release) === INDEPENDENT;

/* Off the evidence and never off the commit: after a merge the deployment identity is the merged head every verdict already carries, so a commit read passes an ordinary builder verdict by accident. Commit-shaped first, or a forty-digit attachment name prefixes its way past the comparison. */
const citesDeployment = (held, deployment) =>
  (held.evidence ?? []).some((one) => isCommit(one) && sameCommit(one, deployment));

/* An id a run inherited is the dispatching session's: it differs from the builder's and proves nothing, which is the reading `takeRefusal` gives an inherited builder take. Absent is not inherited — the field is `newer`, so a verdict written before it is judged as it was written (ISS-705). */
const inheritedJudge = (held) => held[JUDGE_FROM] === INHERITED;

const judgedApart = (held, landing) =>
  Boolean(held.judge) && !inheritedJudge(held) && held.judge !== landing?.builder;

/** Why this verdict earns nothing where the project asks for a second judge, or null where it stands.
 *  The two halves are two sentences: one refusal naming both buries whichever of them is satisfied,
 *  and the builder half is the one a declared reconstruction can answer (ISS-2045). */
export const judgeProblem = (held, landing, holders = []) => {
  if (!landing?.deployment) {
    return "has no landing checkpoint naming a deployment identity to judge it against";
  }
  const builder = builderProblem(landing, holders);
  if (builder) return builder;
  if (!held.judge) return "carries no judge, so nothing on it says which session wrote it";
  if (inheritedJudge(held)) {
    return `carries the judge id \`${held.judge}\`, which the record says the run inherited: `
      + `${INHERITED_MEANS}. ${OWN_ID}`;
  }
  if (!judgedApart(held, landing)) return `carries the builder's own id \`${held.judge}\``;
  /* The comparison above answers nothing where there is nothing to compare with. What the record
     still settles is the one case it settles certainly: a history naming this judge and nobody else
     names the builder, whatever the checkpoint could not recover (ISS-2045). */
  if (!landing.builder && holders.includes(held.judge)) {
    return `carries the judge id \`${held.judge}\`, which the claim history on this issue names as `
      + `a run that held it while the change was being built: the checkpoint's builder is `
      + `unrecoverable, so nothing here shows this judge apart from whoever built the change`;
  }
  if (!citesDeployment(held, landing.deployment)) {
    return `cites nothing at ${short(landing.deployment)}, which is what the deployment reported running`;
  }
  return null;
};

export const numbered = (verdicts) => [...verdicts].sort((one, two) => one[0] - two[0]);

export const judgeProblems = (view) => (asksIndependent(view.release)
  ? numbered(view.verdicts).flatMap(([number, { record }]) => {
    const why = judgeProblem(record.fields, view.landing, view.holders ?? []);
    return why ? [{ number, why, held: record.fields }] : [];
  })
  : []);

/* The grant goes in front of the write where the id is what the problem was: a role handed the bare command sends it again under the same inherited id, and reads the refusal as one it cannot act on. */
export const judgeAsk = (ref, number, landing, held = null) => (landing?.deployment
  ? `${inheritedJudge(held ?? {}) ? "FORGE_SESSION_ID=<an-id-of-its-own> " : ""}forge record verdict ${ref} `
    + `--criterion ${number} --verdict pass --commit ${short(landing.head) || "<sha>"} `
    + `--evidence ${short(landing.deployment)}`
  : `forge resume ${ref}`);

/* What a void gives up, for a landing that has to name it: judged by somebody other than the checkpoint's builder, and citing the identity the landing is about to stop holding. Whether a verdict still standing cites what is running now is the same citation read per verdict, which is `judgeProblem`'s and is spent at `testing`, and a successor builder's verdicts are neither's on a project that asked for no judge. It asks that predicate rather than keeping two of its filters: a landing counting a verdict the transition then refuses spends a promotion on a judgement that earns nothing (ISS-2045). */
export const judgedAt = (landing, verdicts, release, holders = []) => (asksIndependent(release)
  ? numbered(verdicts)
    .filter(([, one]) => judgeProblem(one.record.fields, landing, holders) === null)
    .map(([number]) => number)
  : []);
