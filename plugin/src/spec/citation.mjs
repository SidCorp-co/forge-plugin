/* A citation written outside the tree — in a plan, in a criterion — resolved against it. The
   notation is `parse.mjs`'s and the ways a reference fails are `index.mjs`'s; what a citation
   claims, and why it carries a revision at all, is R-10 in `docs/requirements/README.md`. No file
   is read here: the caller hands in the index, so a fixture proves every sentence below. */
import { didYouMean } from "../suggest.mjs";
import { FORMS, identifiersIn } from "./parse.mjs";
import { lookup, nearest } from "./index.mjs";

const TWO_DOCUMENTS = "so the citation names two clauses. Retire one of them: a retired clause keeps"
  + " its number and is never reused, so the other stands.";

/* `verbs.mjs` says *stale* to a reader who asked for one clause and stops there; this says it to an
   author holding the file, so it carries the revision to write instead. Folding the two would give
   the `spec` verb a refusal's wording for a question nobody refused. */
const revisionProblem = (clause, one) => {
  if (clause.rev === null) {
    return `The citation ${one.id}~${one.rev} names a revision and ${one.id} carries none: its table`
      + ` has no Rev column. Cite it as ${one.id}.`;
  }
  if (clause.rev === one.rev) return null;
  return `The citation ${one.id}~${one.rev} is stale: ${one.id} is at revision ${clause.rev}, not`
    + ` ${one.rev}. Read it with \`forge spec ${one.id}\` and cite ${one.id}~${clause.rev} if it`
    + " still says what you meant.";
};

const problemOf = (index, one) => {
  const found = lookup(index, one.id);
  if (found.ambiguous) {
    const what = found.via ? `${one.id} sits under ${found.via}, which is` : `${one.id} is`;
    return `${what} defined in ${found.ambiguous.join(" and ")}, ${TWO_DOCUMENTS}`;
  }
  if (found.foreign) {
    return `${one.id} names ${found.foreign}, which is not a clause of the specification. Cite one`
      + ` of ${FORMS}.`;
  }
  if (!found.clause) return didYouMean("clause", one.id, nearest(index, one.id), `The forms are ${FORMS}.`);
  return revisionProblem(found.clause, one);
};

const once = (entries, key) => [...new Map(entries.map((one) => [key(one), one])).values()];

/** One sentence per citation of `text` that does not resolve against `index`, each naming the
 *  identifier, what is wrong with it and what clears it. A citation is `<id>~<rev>`: an identifier
 *  written without one makes no checkable claim, and `unrevisionedIn` answers those instead. */
export const citationProblems = (index, text) =>
  once(identifiersIn(text).filter((one) => one.rev !== null), (one) => `${one.id}~${one.rev}`)
    .map((one) => problemOf(index, one))
    .filter(Boolean);

/** The identifiers of `text` that name a clause and carry no revision. R-10 wants one on every
 *  citation so a clause that moves takes its citations with it; nothing compares the recorded hash
 *  until the spec gate ships (ISS-27), so this is said and never refused. */
export const unrevisionedIn = (index, text) =>
  once(
    identifiersIn(text).filter((one) => one.rev === null && lookup(index, one.id).clause),
    (one) => one.id,
  ).map((one) => one.id);

/** The refusal a writer prints for what `citationProblems` found, or `null` where it found nothing. */
export const citationRefusal = (problems) => {
  if (!problems.length) return null;
  return ["This citation does not resolve against this project's requirements tree, so nothing was written:",
    ...problems.map((one) => `  ${one}`)].join("\n");
};

/** The line a writer prints for what `unrevisionedIn` found, or `null` where it found nothing. */
export const revisionSaid = (ids) => {
  if (!ids.length) return null;
  const names = ids.length > 1 ? `${ids.join(", ")} name clauses and carry` : `${ids[0]} names a clause and carries`;
  return `${names} no revision. R-10 asks for \`<id>~<rev>\`, so a clause that is reworded takes its`
    + " citations with it; nothing compares the hash yet (ISS-27) and this was written as given.";
};
