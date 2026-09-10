/* What the baseline record earns at `in_progress`, apart from earned.mjs because that answers for eight statuses and this for one record. Both refusals judge what the run said of itself, never a ledger this plugin cannot see and never a store one machine holds: the citation's authority is settled at the write (published.mjs), which is what leaves this reading the record's alone and two checkouts advancing one issue one answer. */
import { sameCommit } from "../../tracker/evidence.mjs";
import { need } from "../machine.mjs";

export const freshForm = (ref, gate) =>
  `forge record baseline ${ref} --gate "${gate}" --result "<what already fails>" `
  + "--commit <sha> --scope whole";

/* A baseline naming no scope predates the field and is excused, which is why this asks for `part`. */
export const wholeOwed = (view, ref) => {
  const held = view.latest.baseline?.record.fields;
  if (held?.scope !== "part") return [];
  return [need(
    `the baseline says \`${held.gate}\` measured part of the tree, so what it did not run has no `
      + "answer and a green after it stands on nothing",
    freshForm(ref, held.gate),
  )];
};

/* One leg and it is off the record: the commit against the head the write stamped from its own checkout, which is the point the branch was cut at because the baseline is recorded before the first edit. A scope of `part` is the refusal above, not repeated. The rung is no leg of it — a tree's state is no property of the issue reading it, so a `feature` cut from a published head is owed the same answer as a `trivial` (ISS-1101).
   The gate is compared with nothing. The project's gate is on no record this reads, and reading its shape out of a checkout is what a plugin running in repositories it cannot see may not do (ISS-1093). */
export const citedOwed = (view, ref) => {
  const held = view.latest.baseline?.record.fields;
  if (!held?.cited) return [];
  const fresh = freshForm(ref, held.gate);
  if (held.scope !== "whole") {
    if (held.scope === "part") return [];
    return [need("the baseline cites a recorded result and names no scope, so nothing says that run "
      + "measured the whole tree; an absent scope is excused for a run of one's own and not for a "
      + "citation, which is taken on the strength of that word", fresh)];
  }
  if (!held.head) {
    return [need(
      "the baseline cites a recorded result and carries no head, so nothing on the record says which "
        + "tree that result answered for; a baseline written off a checkout carries none, and so does "
        + "one written in a checkout with uncommitted work in it",
      `re-record it from the checkout the branch was cut in, with that work committed or gone: `
        + `${fresh} --cited "${held.cited}"`,
    )];
  }
  if (!sameCommit(held.commit, held.head)) {
    return [need(
      `the baseline cites a result at ${held.commit} and was written at ${held.head}, so the branch `
        + "had already moved off the tree that result answered for",
      fresh,
    )];
  }
  return [];
};
