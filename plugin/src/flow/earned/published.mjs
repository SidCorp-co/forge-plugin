/* The whole-tree gate result a ship published for the head it released, which is the one authority a baseline citation rests on. Keyed on the project and the commit, because a commit is the only thing here that says the tree is the same tree: no ancestry walk and no newest-published fallback answers for a head nothing was published for. A ship writes it and the citing write reads it — no verb of this CLI writes one, or one run's own gate would become the next run's authority, and settling the authority at the write is what leaves every entry check judging the record alone. */
import { join } from "node:path";

import { appendJsonl, jsonlAt } from "../../hooks/hook-log-file.mjs";
import { configDir } from "../../resolve/config.mjs";
import { freshForm } from "./baseline.mjs";

const WHOLE = "whole";

export const publishedPath = () => join(configDir("forge"), "gate-baselines.jsonl");

export const publishedFor = (project, commit) => jsonlAt(publishedPath())
  .findLast((one) => (one.project ?? null) === (project ?? null) && one.commit === commit) ?? null;

export const WROTE = "wrote";
export const HELD = "held";
export const PART = "part";
const FAILED = "failed";

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
    + `rather than running one — \`forge advance <ref> --owed\` prints the write`,
  [HELD]: `${commit} already holds a published result, so nothing was written`,
  [PART]: `nothing is published for ${commit}: the gate's record does not hold every step of the `
    + `whole table green at it, and a result that cannot say \`whole\` is no result to cite`,
  [FAILED]: `nothing is published for ${commit}, so a branch cut here runs its own gate`,
}[outcome]);

export const citationProblem = (ref, project, got) => {
  if (!got.cited || publishedFor(project, got.commit)) return null;
  return `--commit to name a commit some ship published a whole-tree result for. Nothing is `
    + `published for ${got.commit}, and only a ship publishes one, so a citation naming it is a `
    + `green from nowhere. Measure this tree instead:\n  ${freshForm(ref, got.gate)}`;
};

/** The write that cites what is published for one head, or null. A head this cannot be given at all — no checkout, or one with uncommitted work in it — answers null too, that being the head the write would fail to stamp. */
export const citeForm = (ref, project, head) => {
  const found = head ? publishedFor(project, head) : null;
  if (!found) return null;
  const source = found.version ? `the ship's gate at release ${found.version}` : "the ship's gate";
  return `forge record baseline ${ref} --gate "${found.gate}" --result "${found.result}" `
    + `--commit ${found.commit} --scope ${found.scope} --cited "${source}"`;
};
