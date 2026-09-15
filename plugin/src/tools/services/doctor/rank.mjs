/* A refused `rank` object leaves no ceiling in force at all, so a number beside that refusal would be one nothing is ranking by. */
import { ageCeiling } from "../../../rank/weights.mjs";

export const rankLines = () => {
  const held = ageCeiling();
  if (held.refusal) {
    return [{ level: "miss", label: "age ceiling",
      detail: `${held.refusal} Until that is fixed \`forge next\` refuses to rank at all.` }];
  }
  const worth = held.value === null
    ? "none, so age accrues for as long as an issue is open"
    : `${held.value} points, past which two filing dates rank alike`;
  return [{ label: "age ceiling", detail: `${worth}  ← ${held.from}` }];
};
