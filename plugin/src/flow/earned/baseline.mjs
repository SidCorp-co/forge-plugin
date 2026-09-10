/* What the baseline record earns at `in_progress`, apart from earned.mjs because that answers for eight statuses and this for one record. The rung arrives as an argument so nothing here imports back into its caller. Both refusals judge what the run said of itself, never a ledger this plugin cannot see. */
import { belowTop } from "../../ladder.mjs";
import { sameCommit } from "../../tracker/evidence.mjs";
import { need } from "../machine.mjs";

const freshForm = (ref, gate) =>
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

/* Two legs and both off the record: the rung, and the commit against the head the write stamped from its own checkout, which is the point the branch was cut at because the baseline is recorded before the first edit. A scope of `part` is the refusal above, not repeated.
   The gate is compared with nothing. The project's gate is on no record this reads, and reading its shape out of a checkout is what a plugin running in repositories it cannot see may not do (ISS-1093). */
export const citedOwed = (view, ref, rung) => {
  const held = view.latest.baseline?.record.fields;
  if (!held?.cited) return [];
  const fresh = freshForm(ref, held.gate);
  if (!belowTop(rung)) {
    return [need(`the baseline cites ${held.cited} rather than a run of its own, and a \`${rung}\` `
      + "spends the whole run: only the two rungs below it may cite one", fresh)];
  }
  if (!held.head) {
    return [need(
      "the baseline cites a recorded result and carries no head, so nothing on the record says which "
        + "tree that result answered for; a baseline written outside a checkout carries none",
      `${fresh} --cited "${held.cited}"`,
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
