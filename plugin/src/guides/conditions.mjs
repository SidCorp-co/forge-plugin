/* What a fence in a served text resolves against, each key with the domain it takes: docs/cli/the-parts.md. */
import { FEEDBACK_CHANNELS, SHIP_MODES, feedbackScope, shipMode } from "../resolve/settings.mjs";
import { RUNGS } from "../ladder.mjs";

export const RUNG = "rung";

export const conditionsAt = (rung) => ({
  "feedback.plugin": { value: feedbackScope().plugin.value, allowed: FEEDBACK_CHANNELS },
  ship: { value: shipMode().value, allowed: SHIP_MODES },
  [RUNG]: { value: rung, allowed: RUNGS },
});
