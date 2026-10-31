/* The route from `draft` onto the ladder. The tracker's one forward edge out of `draft` is `open`,
   admitted through its issue-ready checklist, so a draft is never carried past `open` however the
   project's `open` state is configured: docs/cli/record-the-rung.md. */
import { DRAFT } from "../../rank/weights.mjs";
import { CITED } from "../../guides/phases.mjs";
import { LADDER, dispositionOf } from "../earned.mjs";

const OPENING = LADDER[0];

/** The sentence under the owed line, read off the view rather than carried beside the target, so
 *  every printer of that line says it whatever it was handed. */
export const draftSaid = () =>
  `\`${DRAFT}\` is before the ladder, and \`${OPENING}\` is the way onto it: the tracker admits a `
  + `draft to \`${OPENING}\` and to no rung past it.`;

/** `targetOf`'s answer for an issue at `draft`. */
export const draftTarget = (view) => ({
  next: dispositionOf(view) ? "dropped" : OPENING, missing: [], resumed: false,
});

/** The record kinds a move into `next` is earned on: the kinds `next` alone cites, a draft passing
 *  no rung on its way to `open` or `dropped`. */
export const citedOn = (status, next) => CITED[next] ?? [];
