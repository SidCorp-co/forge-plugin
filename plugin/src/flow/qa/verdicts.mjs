/* Whether an issue's verdicts were judged by somebody other than the run that built the change. `earned.mjs` spends the first reading at `testing`, a promotion the second; why each is the shape it is: docs/cli/the-judge-and-the-deploy.md. */
import { INHERITED, INHERITED_MEANS, OWN_ID } from "../../resolve/config.mjs";
import { CARRIES_DEPLOYMENT, JUDGE_FROM, valuesOf } from "../machine.mjs";
import { QA_MODES, judgementOf } from "../../tracker/project-config.mjs";
import { isCommit, sameCommit, shortSha as short } from "../../tracker/evidence.mjs";
import { HAND_WRITTEN, REBUILT_FORM, builderProblem } from "../landing/reconstruction.mjs";
import { identityAsk, landsOutsideGit } from "../record/judged/landing.mjs";

export const [INDEPENDENT] = QA_MODES;

export const asksIndependent = (release) => judgementOf(release) === INDEPENDENT;

/* Off the evidence and never off the commit: after a merge the deployment identity is the merged head every verdict already carries, so a commit read passes an ordinary builder verdict by accident. Commit-shaped first, or a forty-digit attachment name prefixes its way past the comparison. A served commit carrying the deployment is the deployment judged, and whether it carries it is read by the verdict's write and stamped there, this rung reading no repository (ISS-2587). */
const citesDeployment = (held, deployment) =>
  (held.evidence ?? []).some((one) => isCommit(one) && sameCommit(one, deployment))
  || (isCommit(held[CARRIES_DEPLOYMENT] ?? "") && sameCommit(held[CARRIES_DEPLOYMENT], deployment));

/* An id a run inherited is the dispatching session's: it differs from the builder's and proves nothing, which is the reading `takeRefusal` gives an inherited builder take. Absent is not inherited — the field is `newer`, so a verdict written before it is judged as it was written (ISS-705). */
const inheritedJudge = (held) => held[JUDGE_FROM] === INHERITED;

/* The half of who judged that is the writer's own, so no later write to the issue makes such a
   verdict count: the rung asks it of a standing verdict and the write asks it before sending one,
   since the page keeps the latest verdict per criterion and this one would replace a judge's
   (ISS-2206). Outside git the builder is the build-time holders as a set (ISS-2402). */
const writerProblem = (held, landing, holders, outside) => {
  if (inheritedJudge(held)) {
    return `carries the judge id \`${held.judge}\`, which the record says the run inherited: `
      + `${INHERITED_MEANS}. ${OWN_ID}`;
  }
  const built = outside ? holders.includes(held.judge) : held.judge === landing?.builder;
  return held.judge && built ? `carries the builder's own id \`${held.judge}\`` : null;
};

/** The writer half on its own, for `writerChecked`, whose caller has read `asksIndependent` first. */
export const writerRefusal = (view, held) =>
  writerProblem(held, view.landing, view.holders ?? [], landsOutsideGit(view.issue));

/** Why this verdict earns nothing where the project asks for a second judge, or null where it stands.
 *  The two halves are two sentences: one refusal naming both buries whichever of them is satisfied,
 *  and the builder half is the one a declared reconstruction can answer (ISS-2045).
 *
 *  It asks nothing about whether a deployment was reported. That is the verification's at
 *  `awaiting_release`, and demanded here it closed the ladder above `developed` for every project
 *  asking for a judge, no ordinary landing writing the field (ISS-1788). Independence needs no
 *  reading of one. */
export const judgeProblem = (held, landing, holders = []) =>
  whoProblem(held, landing, holders) ?? citedProblem(held, landing);

/* Who wrote the verdict, which a fresh judgement answers and a re-citation cannot. */
const whoProblem = (held, landing, holders) => {
  const builder = builderProblem(landing, holders);
  if (builder) return builder;
  if (!held.judge) return "carries no judge, so nothing on it says which session wrote it";
  const writer = writerProblem(held, landing, holders, false);
  if (writer) return writer;
  /* The comparison above answers nothing where there is nothing to compare with. What the record
     still settles is the one case it settles certainly: a history naming this judge and nobody else
     names the builder, whatever the checkpoint could not recover (ISS-2045). */
  if (!landing.builder && holders.includes(held.judge)) {
    return `carries the judge id \`${held.judge}\`, which the claim history on this issue names as `
      + `a run that held it while the change was being built: the checkpoint's builder is `
      + `unrecoverable, so nothing here shows this judge apart from whoever built the change`;
  }
  return null;
};

/* What the verdict cites, once its judge stands: the judgement is the judge's and only the citation
   is owed, so the ask re-cites the value held rather than asking for it again (ISS-2252).
   Conditioned on the field and never demanding it: a checkpoint that names an identity was written
   by a route that read it off the deployment, so a verdict answering to some other head judged
   something else and the reading is worth having. A checkpoint that names none leaves nothing to
   compare, and a rung refusing a comparison it cannot make is the defect above (ISS-1788). */
const citedProblem = (held, landing) => {
  if (landing.deployment && !citesDeployment(held, landing.deployment)) {
    return `cites nothing at ${short(landing.deployment)}, which is what the deployment reported running, `
      + "nor a commit its write read as carrying it";
  }
  return null;
};

export const numbered = (verdicts) => [...verdicts].sort((one, two) => one[0] - two[0]);

/* Outside git there is no checkpoint to name a builder, so `holdersOf`'s whole set stands in for one,
   and a judge is apart only from all of it: a build a second run finished has two (ISS-2402). */
const NO_OUTSIDE_BUILDER = "lands outside git, where no landing checkpoint is written, so the builder is "
  + "read off the claim history, and it names no run that held the issue while it was being built: "
  + "nothing on the record shows this judge apart from whoever built it";

const outsideProblem = (held, holders) => {
  if (!holders.length) return NO_OUTSIDE_BUILDER;
  if (!held.judge) return "carries no judge, so nothing on it says which session wrote it";
  return writerProblem(held, null, holders, true);
};

export const judgeProblems = (view) => {
  if (!asksIndependent(view.release)) return [];
  const holders = view.holders ?? [];
  const outside = landsOutsideGit(view.issue);
  return numbered(view.verdicts).flatMap(([number, { record }]) => {
    const who = outside ? outsideProblem(record.fields, holders) : whoProblem(record.fields, view.landing, holders);
    const why = who ?? (outside ? null : citedProblem(record.fields, view.landing));
    return why ? [{ number, why, held: record.fields, recite: !who }] : [];
  });
};

/* The grant goes in front of the write where the id is what the problem was: a role handed the bare command sends it again under the same inherited id, and reads the refusal as one it cannot act on.
   Where there is no checkpoint the ask is not another verdict but the write that puts one there: a
   route that only reports where the landing is leaves the reader following it nowhere (ISS-1784).
   Two answers and not three: a checkpoint that stands is answerable by a verdict whatever it holds,
   and the branch that stood between handed back a command reprinting the refusal (ISS-1788).
   Shared flags lead: `blocksIn` gives a block only what precedes the first --criterion (ISS-2371).
   `blocks`, where given, is each criterion's own tail in place of the shared placeholder (ISS-2252). */
export const judgeAsk = (ref, at, landing, held = null, merged = null, identity = null, holders = [], blocks = null) => {
  const numbers = Array.isArray(at) ? at : [at];
  const outside = identity?.flag === "landing";
  if (!landing && !outside) return REBUILT_FORM(ref, short(merged) || "<the sha the default branch carries>");
  /* A reconstruction whose builder does not stand is answered by writing it again, which names the
     builder the history does (ISS-2608). */
  if (landing?.[HAND_WRITTEN] && builderProblem(landing, holders)) {
    return REBUILT_FORM(ref, short(landing.head) || short(merged) || "<the sha the default branch carries>");
  }
  return `${inheritedJudge(held ?? {}) ? "FORGE_SESSION_ID=<an-id-of-its-own> " : ""}`
    + `forge record verdict ${ref} ${outside ? identityAsk(identity) : `--commit ${short(landing.head) || "<sha>"}`} `
    + `--evidence ${(!outside && short(landing.deployment)) || "<what you exercised>"}`
    + (blocks ?? ` --verdict ${valuesOf("verdict", "verdict")}${numbers.map((number) => ` --criterion ${number}`).join("")}`);
};

/* What a void gives up, for a landing that has to name it: judged by somebody other than the checkpoint's builder, and citing the identity the landing is about to stop holding. Whether a verdict still standing cites what is running now is the same citation read per verdict, which is `judgeProblem`'s and is spent at `testing`, and a successor builder's verdicts are neither's on a project that asked for no judge. It asks that predicate rather than keeping two of its filters: a landing counting a verdict the transition then refuses spends a promotion on a judgement that earns nothing (ISS-2045). */
export const judgedAt = (landing, verdicts, release, holders = []) => (asksIndependent(release)
  ? numbered(verdicts)
    .filter(([, one]) => judgeProblem(one.record.fields, landing, holders) === null)
    .map(([number]) => number)
  : []);
