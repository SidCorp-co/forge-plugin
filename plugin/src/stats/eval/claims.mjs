/* The figure a change says it will move, stated before that change lands and read back by the reading
   that judges it. What a kept claim buys, which is discipline and not evidence —
   docs/cli/stats-the-change.md. */
import { ANGLES, DISPOSITIONS } from "./angles.mjs";
import { CLAIMS, RELEASES, marksOf, writeMark } from "../marks/marks.mjs";
import { fail } from "../../resolve/settings.mjs";

/** The two directions a claim may take, in the sign the angle set already speaks: a claim and an
 *  angle disagreeing about what better means would be two vocabularies for one comparison. */
export const DIRECTIONS = { falls: -1, rises: 1 };

const ANGLE_NAMES = Object.keys(ANGLES);
const DIRECTION_NAMES = Object.keys(DIRECTIONS);

export const KEPT = "kept";
export const BROKEN = "broken";
export const UNDECIDED = "neither kept nor broken";
export const UNJUDGED = "the angle it names returned no verdict";

/** What a kept claim is worth, printed wherever one is reported. Pre-declaration makes a prediction
 *  falsifiable and stops an outcome being written after the figure moved. It supplies no
 *  counterfactual, creates no independence between changes, removes no multiple comparisons and buys
 *  no power: five correct predictions out of five is p = 0.0625 and cannot reach significance at that
 *  size at all. So a run of kept claims is discipline held and never evidence the harness improved. */
export const WHAT_A_CLAIM_BUYS = "A kept claim is a prediction that held. It is no evidence that the "
  + "harness improved: pre-declaration makes a prediction falsifiable, and supplies no counterfactual, "
  + "no independence between changes and no statistical power.";

/** `<angle>:<falls|rises>`, refused by name against the two closed sets it draws on. */
export const claimAsked = (raw, verb = "stats change") => {
  const [angle, direction, ...over] = String(raw ?? "").split(":");
  if (over.length || !angle || !direction) {
    fail(`${verb}: --claim takes <angle>:<direction>, not \`${raw}\`. `
      + `There is: ${ANGLE_NAMES.join(", ")}, each as ${DIRECTION_NAMES.join(" or ")}.`);
  }
  if (!Object.hasOwn(ANGLES, angle)) {
    fail(`${verb}: no angle named ${angle}. There is: ${ANGLE_NAMES.join(", ")}.`);
  }
  if (!Object.hasOwn(DIRECTIONS, direction)) {
    fail(`${verb}: no direction named ${direction}. A figure ${DIRECTION_NAMES.join(" or ")}.`);
  }
  return { angle, direction };
};

const releasesNaming = (scope, issue) =>
  marksOf(RELEASES, scope).filter((one) => (one.issues ?? []).includes(issue));

export const claimsOf = (scope, issue) =>
  marksOf(CLAIMS, scope).filter((one) => one.issue === issue);

/** The newest claim held for an issue, or null. Latest wins: a change that revised what it expected
 *  says so by claiming again, and the reading judges what it last said. */
export const claimFor = (scope, issue) => claimsOf(scope, issue).at(-1) ?? null;

/** Refused where a release reading held here already names that issue, a claim about a change that
 *  has landed being an explanation wearing a prediction's shape.
 *
 *  **That refusal is local and the guarantee is narrowed to match it.** A release whose reading was
 *  never written, a reading held before readings carried keys, and the gap between a landing and its
 *  reading being recorded all look exactly like an issue that has not landed. So a claim the store
 *  could not place carries `landingKnown: false` rather than an implied boundary, and the reading
 *  that judges it checks again against the install moment of the copy that carried the change. That
 *  second check is the one that decides. */
export const writeClaim = (scope, issue, asked, verb = "stats change") => {
  const landed = releasesNaming(scope, issue);
  if (landed.length) {
    fail(`${verb}: ${issue} landed in release ${landed.at(-1).version}, so a claim about it now would `
      + "explain the figure rather than predict it. A claim is written before the change lands.");
  }
  const record = {
    kind: CLAIMS,
    scope,
    issue,
    angle: asked.angle,
    direction: asked.direction,
    at: new Date().toISOString(),
    landingKnown: false,
  };
  return { record, wrote: writeMark(record) };
};

export const claimSaid = (record) => `${record.issue} claims ${record.angle} ${record.direction}. `
  + "No release reading held here names that issue, which is the whole of what this write could "
  + "establish about whether it has landed; the reading that judges it checks again against the "
  + "install moment of the copy that carried it.";

/* The angle the claim named, judged as that angle was already judged: the claim adds no arithmetic of
   its own, so a claim and the block above it can never disagree about which way a figure went. */
const outcomeOf = (angle, direction) => {
  if (!angle || angle.shift === null) return UNJUDGED;
  if (angle.disposition === DISPOSITIONS.same) return UNDECIDED;
  if (angle.disposition === DISPOSITIONS.unevaluable) return UNJUDGED;
  return Math.sign(angle.shift) === DIRECTIONS[direction] ? KEPT : BROKEN;
};

/** The claim read back against the copy that carried the change. `predicted` is false where the claim
 *  was written at or after that install: the figure had begun to move, so the claim explains rather
 *  than predicts, and the outcome is reported without being counted a prediction. */
export const claimJudged = (record, angles, installedAt) => {
  if (!record) return null;
  const written = Date.parse(record.at);
  const angle = angles.find((one) => one.name === record.angle) ?? null;
  return {
    issue: record.issue,
    angle: record.angle,
    direction: record.direction,
    writtenAt: record.at,
    installedAt: installedAt === null ? null : new Date(installedAt).toISOString(),
    predicted: Number.isFinite(written) && installedAt !== null && written < installedAt,
    landingKnown: record.landingKnown ?? false,
    outcome: outcomeOf(angle, record.direction),
  };
};

const ROW = 11;

export const claimLines = (judged) => {
  if (!judged) return ["", "no claim is held for this change: nothing said in advance what it would move"];
  return ["",
    `claim      ${judged.issue} said ${judged.angle} would ${judged.direction}`,
    `  ${"written".padEnd(ROW)}${judged.writtenAt}`,
    `  ${"installed".padEnd(ROW)}${judged.installedAt ?? "no install moment for this change"}`,
    `  ${"counts as".padEnd(ROW)}${judged.predicted
      ? "a prediction: it was written before the copy carrying this change was installed"
      : "no prediction: it was written at or after that install, so it explains rather than predicts"}`,
    `  ${"outcome".padEnd(ROW)}${judged.outcome}`,
    ...(judged.outcome === KEPT ? [`  ${"".padEnd(ROW)}${WHAT_A_CLAIM_BUYS}`] : []),
  ];
};
