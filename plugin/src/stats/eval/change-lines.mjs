/* The screen `forge stats change` prints: the populations, what each comparison found, what held one
   back, and the verdict. What each block may be read as — docs/cli/stats-the-change.md. */
import { angleBlock } from "./angles.mjs";
import { mixLines } from "./mix.mjs";
import { claimLines } from "./claims.mjs";

const stamp = (iso) => iso.slice(0, 16).replace("T", " ");

const ROW = 11;

const clockLines = (held) => [
  "",
  `${held.version} — the copy carrying this change`,
  `  ${"installed".padEnd(ROW)}${stamp(held.copy.at)}, by ${held.copy.born
    ? "the directory's birth time"
    : "the directory's modification time, the filesystem reporting no birth time"}`,
  held.next
    ? `  ${"next".padEnd(ROW)}${held.next.version} at ${stamp(held.next.at)}, by ${held.next.born
      ? "the directory's birth time"
      : "the directory's modification time, the filesystem reporting no birth time"}`
    : `  ${"next".padEnd(ROW)}no copy was installed after it, so the population that ran this change `
      + "and no other is open-ended and bounded by nothing",
];

/** Each release named for what is known of it: its keys, or its version said to carry none. A set
 *  printing only the keys it had would leave a release inside the span unnamed while still counting
 *  it, which is the disclosure this reading exists to make. */
export const namedSet = (exposure) => exposure.releases
  .map((one) => (one.issues.length ? one.issues.join(", ") : `${one.version} (no issue on its reading)`))
  .join(", ");

const setLine = (exposure) => `${exposure.changes} change(s) over ${exposure.releases.length} `
  + `release(s): ${namedSet(exposure)}`;

const exposureLines = (held) => ["", "what each population ran",
  ...Object.entries(held.exposures).map(([name, exposure]) => `  ${name}\n    ${setLine(exposure)}`)];

const whyLines = (one) => (one.eligible
  ? [`  ${"eligible".padEnd(ROW)}nothing holds this comparison back from carrying the association`]
  : [`  ${"holds".padEnd(ROW)}${one.why[0]}`,
    ...one.why.slice(1).map((line) => `  ${"".padEnd(ROW)}${line}`)]);

const comparisonLines = (one) => [
  "",
  `${one.name}`,
  `  ${"before".padEnd(ROW)}${one.before.runs} run(s)`,
  `  ${"now".padEnd(ROW)}${one.now.runs} run(s)`,
  `  ${"judged".padEnd(ROW)}${one.judged} of ${one.angles.length} angle(s) returned a verdict; `
    + `${one.moved.length ? `${one.moved.join(", ")} moved past ${one.moved.length === 1 ? "its" : "their"} reference` : "none moved past its own reference"}`,
  ...whyLines(one),
  ...one.angles.flatMap(angleBlock),
  ...mixLines(one.mix),
];

const verdictLines = (held) => {
  const lines = ["", `verdict    ${held.verdict}`];
  if (held.deciding) lines.push(`  ${"deciding".padEnd(ROW)}${held.deciding}`);
  if (held.associated) {
    lines.push(`  ${"over".padEnd(ROW)}${held.associated.angles.join(", ")}`);
    lines.push(`  ${"set".padEnd(ROW)}${setLine(held.associated)}`);
    if (!held.associated.single) {
      lines.push(`  ${"".padEnd(ROW)}That population ran all of them, so none of them singly carries `
        + "this movement.");
    }
  }
  for (const one of held.why) {
    lines.push(`  ${"why".padEnd(ROW)}${one.comparison} is not eligible:`);
    for (const line of one.why) lines.push(`  ${"".padEnd(ROW)}  ${line}`);
  }
  return lines;
};

/** The whole screen. The verdict stands last, under everything it was read off, and the two sentences
 *  under it are what nothing above them says: that no comparison here supplies a counterfactual, and
 *  that every figure in it is a price. */
export const changeLines = (held) => [
  `${held.version} against this project's corpus of ${held.total} run(s)`,
  ...clockLines(held),
  ...exposureLines(held),
  ...held.comparisons.flatMap(comparisonLines),
  ...claimLines(held.claim),
  ...verdictLines(held),
  "",
  held.counterfactual,
  "",
  held.notMeasured,
];
