/* Whether core holds the move into build on a design, off two reads it decides by: the project's gate
   profile (`GET /projects/:id/gates`), where `design_record` or `design_approved_for_build` on
   `enforce` is the design gate live, and the issue's design (`GET /issues/:id/design`), whose `check`
   says whether one is recorded. `advance --owed` names the gap here so a design hold is read before
   core refuses the move, not only after (FB-33, ISS-28). docs/cli/advance-the-ladder.md. */
import { Refusal, refusing } from "../../resolve/settings.mjs";
import { tried } from "../../tracker/rest.mjs";
import { BUILD_AT, stepAfter } from "../earned.mjs";
import { need } from "../machine/owed.mjs";

/* The gates whose enforce mode means a design is due before build. */
const DESIGN_GATES = ["design_record", "design_approved_for_build"];

/* The graceful read core-verdicts.mjs's own reader documents, reused for the design reads: a failure
   to reach core comes back as `{ refused }` rather than ending a call that only reads it for owed. */
const read = async (name, args) => {
  try {
    return await refusing(() => tried(name, args));
  } catch (error) {
    if (error instanceof Refusal) return { refused: error.message };
    throw error;
  }
};

/** `{ enforced, passed, gaps, detail }` — whether the design gate is live, whether core counts a design
 *  recorded, the parts it still lacks and core's one-line detail — or `{ refused }` naming why a read
 *  failed. Where no design gate is on `enforce` (a standard or yolo project), `enforced` is false and
 *  nothing is owed: a project core does not hold on design is not nagged for one. */
export const coreDesign = async (documentId, status = null) => {
  const none = { enforced: false, passed: true, gaps: [], detail: null, refused: null };
  /* The gate holds only the move into build, which `CHECKS[HELD.build]` owes and nothing else reads,
     so a status that is not about to enter build pays no round to read the gate it cannot owe. */
  if (stepAfter(status) !== BUILD_AT) return none;
  const gates = await read("forge_config.gates", {});
  if (gates?.refused) return { ...none, enforced: null, passed: null, refused: gates.refused };
  const rows = Array.isArray(gates?.gates) ? gates.gates : [];
  if (!rows.some((one) => DESIGN_GATES.includes(one?.id) && one?.mode === "enforce")) return none;
  const design = await read("forge_issues.design", { documentId });
  if (design?.refused) return { enforced: true, passed: null, gaps: null, detail: null, refused: design.refused };
  const check = design?.check ?? {};
  return {
    enforced: true,
    passed: Boolean(check.passed),
    gaps: Array.isArray(check.gaps) ? check.gaps.map((one) => one?.part).filter(Boolean) : [],
    detail: typeof check.detail === "string" ? check.detail.trim() : null,
    refused: null,
  };
};

/** Core's design read folded into the view the way `withCoreVerdicts` folds the verdicts: read by
 *  `designOwed`, and absent — a no-op leaving the owed list the thread's — where the read was not had. */
export const withCoreDesign = (view, design) => ({ ...view, coreDesign: design });

/* Core's detail names the raw PUT route in an aside the CLI's own command replaces, so the owed line
   reads as one route to type and not two. */
const detailSaid = (detail) => (detail ? detail.replace(/\s*\(PUT[^)]*\)\.?/u, "").replace(/[\s.]+$/u, "") : null);

/** What entering build owes where the design gate holds it and no design is recorded: core's own
 *  detail, or the parts it named, and the verb that records one. Nothing where the gate is off, the
 *  design already passes, or the read was refused — the last said by `designReadLines`. */
export const designOwed = (view, ref) => {
  const held = view.coreDesign;
  if (!held || !held.enforced || held.passed || held.refused) return [];
  const said = detailSaid(held.detail)
    ?? (held.gaps?.length
      ? `the design lacks ${held.gaps.join(", ")}`
      : "no design is recorded");
  return [need(
    `${said} — the design gate holds the move into build until one is (DESIGN_RECORD_MISSING)`,
    `forge record design ${ref} --criterion <n> --class observable|server_side|code_property `
      + `--pattern <slug> --proof "<how it is proven>" [--module <m>] [--contract <c>]`,
  )];
};

/** The `coreReadLines` of the design read: where it was refused, the owed list says so outright, so
 *  the absence of a design item there is not mistaken for none being owed. */
export const designReadLines = (view) => (view.coreDesign?.refused
  ? [`  The design read was refused (${view.coreDesign.refused.split("\n")[0]}), so whether a design is owed is not counted in this list.`]
  : []);
