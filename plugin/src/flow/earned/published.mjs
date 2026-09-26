/* The whole-tree gate result a release published for the head it pushed, which is the one authority a baseline citation rests on. Keyed on the project and the commit, because a commit is the only thing here that says the tree is the same tree: no ancestry walk and no newest-published fallback answers for a head nothing was published for. A release writes it — this repository's ship directly, any other project's through `forge baseline publish`, which refuses every commit but the one its remote's default branch holds — and the citing write reads it, and settling the authority at the write is what leaves every entry check judging the record alone. One machine's file, and said to be: docs/cli/the-published-baseline.md. */
import { join } from "node:path";

import { appendJsonl, jsonlAt } from "../../hooks/log/hook-log-file.mjs";
import { ASKED, WORKTREE, configDir, sessionSourced } from "../../resolve/config.mjs";
import { RUN_ID_VAR } from "../../resolve/session/run-id.mjs";
import { declaredCommands, declaredIn } from "../../stats/corpus/declared.mjs";
import { typedBack } from "../../refusal.mjs";
import { citedHead, freshForm } from "./baseline.mjs";

const WHOLE = "whole";

export const publishedPath = () => join(configDir("forge"), "gate-baselines.jsonl");

const ofProject = (project) => (one) => (one.project ?? null) === (project ?? null);

export const publishedFor = (project, commit) => jsonlAt(publishedPath())
  .findLast((one) => ofProject(project)(one) && one.commit === commit) ?? null;

/** Whether anything was ever published for the project on this machine: an empty answer for one head is a route not yet populated, and one for every head is a route no release here takes. */
export const everPublished = (project) => jsonlAt(publishedPath()).some(ofProject(project));

const UNDECLARED_GATE = "<the project's gate>";

/** Never inferred from the tree (ISS-1093). */
export const declaredGates = (directory = process.cwd()) => declaredCommands("gate", declaredIn(directory));

/** The command a baseline form is filled with: the first the project declared, or the placeholder where it declared none. */
export const declaredGate = (directory = process.cwd()) => declaredGates(directory)[0] ?? UNDECLARED_GATE;

export const WROTE = "wrote";
export const HELD = "held";
export const PART = "part";
export const FAILED = "failed";

/** A ship's publish, and the one word saying what became of it. A scope the ship cannot call whole is a defect in its own reading of the gate's record and not a green a later run may lean on, so it is not published at all. */
export const publishBaseline = ({ project, commit, gate, result, scope, version = null }) => {
  if (scope !== WHOLE) return PART;
  try {
    if (publishedFor(project, commit)) return HELD;
    appendJsonl(
      publishedPath(),
      { project: project ?? null, commit, gate, result, scope, version, at: new Date().toISOString() },
      configDir("forge"),
    );
    return WROTE;
  } catch (error) {
    console.error(`published baseline: ${publishedPath()} could not be written (${error.message}).`);
    return FAILED;
  }
};

export const publishedSaid = (outcome, commit) => ({
  [WROTE]: `the gate's whole-tree result is published for ${commit}, so a branch cut here cites it `
    + `rather than running one — \`forge advance <ref> --owed\` prints the write. It is readable on this `
    + `machine only, in ${publishedPath()}`,
  [HELD]: `${commit} already holds a published result, so nothing was written`,
  [PART]: `nothing is published for ${commit}: the gate's record does not hold every step of the `
    + `whole table green at it, and a result that cannot say \`whole\` is no result to cite`,
  [FAILED]: `nothing is published for ${commit}, so a branch cut here runs its own gate`,
}[outcome]);

/* The two sources of a run's id the route below loses on its way into a fresh tree: that tree's git directory holds no id of its own, and a variable the refused call was prefixed with is gone from the shell the route is pasted into. The rest are read there alike, and carrying them would only rename where they came from (ISS-2556). */
const LOST_IN_A_NEW_TREE = [ASKED, WORKTREE];

/* The same write, run from a checkout that stands at the cited commit and holds nothing else: the one tree the cited result answers for, and the one route that clears either head refusal below without measuring a tree somebody already measured. Every value goes back as typed, the run's id among them, so the line runs as printed and the lease takes it for the run that was refused. */
const atCitedForm = (ref, got, held) => {
  const carried = held?.id && LOST_IN_A_NEW_TREE.includes(held.source) ? [`${RUN_ID_VAR}=${typedBack(held.id)}`] : [];
  const write = [...carried, ...["forge", "record", "baseline", ref, "--gate", got.gate, "--result", got.result,
    "--commit", got.commit, "--scope", got.scope, "--cited", got.cited].map(typedBack)].join(" ");
  return `dir=$(mktemp -d) && git worktree add --detach "$dir" ${typedBack(got.commit)} `
    + `&& (cd "$dir" && ${write}); git worktree remove "$dir"`;
};

const HEAD_SAID = {
  headless: (got) => `this checkout stamps no head: it holds uncommitted work, or it is no checkout at `
    + `all, so nothing would say the result at ${got.commit} answers for the tree this record is written in`,
  moved: (got) => `this checkout stands at ${got.head}, and the result at ${got.commit} answers for that `
    + `commit's tree and not this one`,
};

/** What refuses a citing write: a commit nothing published, or a published one that is not the clean head of the checkout the write stands in, read by the entry check's own predicate so the write never takes a record `in_progress` refuses (ISS-2530). A write citing nothing is judged by neither. */
export const citationProblem = (ref, project, got, held = sessionSourced()) => {
  if (!got.cited) return null;
  if (!publishedFor(project, got.commit)) {
    return `--commit to name a commit some ship published a whole-tree result for. Nothing is `
      + `published for ${got.commit}, and only a ship publishes one — \`forge baseline publish\`, run by `
      + `a release for the head it pushed — so a citation naming it is a green from nowhere. Measure `
      + `this tree instead:\n  ${freshForm(ref, got.gate)}`;
  }
  const head = citedHead(got);
  if (!head) return null;
  return `--commit to be the clean head of the checkout the write stands in, since a cited result `
    + `answers for one tree. ${HEAD_SAID[head](got)}. Nothing was sent. Write it from a detached `
    + `worktree at the cited commit:\n  ${atCitedForm(ref, got, held)}`;
};

/** The write that cites what is published for one head, or null. A head this cannot be given at all — no checkout, or one with uncommitted work in it — answers null too, that being the head the write would fail to stamp. */
export const citeForm = (ref, project, head) => {
  const found = head ? publishedFor(project, head) : null;
  if (!found) return null;
  const source = found.version ? `the ship's gate at release ${found.version}` : "the ship's gate";
  return `forge record baseline ${ref} --gate "${found.gate}" --result "${found.result}" `
    + `--commit ${found.commit} --scope ${found.scope} --cited "${source}"`;
};
