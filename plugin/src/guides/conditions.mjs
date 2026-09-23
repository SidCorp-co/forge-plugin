/* What a fence in a served text resolves against, each key with the domain it takes. A `tool.` key is a third level beside the project's and the call's — the machine's — so two checkouts of one project are served different text where one saved nothing: docs/cli/the-parts.md, docs/cli/an-unconfigured-tool.md. */
import { FEEDBACK_CHANNELS, SHIP_MODES, feedbackScope, shipMode } from "../resolve/settings.mjs";
import { RUNGS } from "../ladder.mjs";
import { toolConditions } from "../tools/services/tool-config.mjs";

const RUNG = "rung";

export const conditionsAt = (rung) => ({
  "feedback.plugin": { value: feedbackScope().plugin.value, allowed: FEEDBACK_CHANNELS },
  ship: { value: shipMode().value, allowed: SHIP_MODES },
  [RUNG]: { value: rung, allowed: RUNGS },
  ...toolConditions(),
});
