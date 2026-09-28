// A rewrite may reword freely, but not drop the one thing that decides what a sentence claims: a
// contrast between two readings, or a negation. `placeholders.diff` and `markdown.verify` catch a
// structure the rewrite broke; this catches a claim it inverted or dropped while staying fluent and
// well-formed, which is why counting untranslated blocks alone never saw it (ISS-1752).
//
// Presence only, never wording, and presence anywhere in the block rather than attached to the one
// clause the source's construct sat in — a false refusal is worse than a missed one, so this stays
// a narrow claim: no counterpart at all is caught; one earned by some other sentence in the same
// block, while the negated or contrasted clause itself loses its own, is not (ISS-1752's decision
// record names the fix: a back-translation verifier behind this same `diff` shape).

const CONTRAST_EN = /\brather than\b|\binstead of\b|\bas opposed to\b|\bwhereas\b/iu;
const CONTRAST_VI = /thay vì|hơn là|chứ không|mà không|trái lại|ngược lại|trong khi/u;

const NEGATION_EN = /\bnot\b|n't\b|\bnever\b|\bno longer\b|\bwithout\b|\bnothing\b|\bnobody\b|\bneither\b|\bcannot\b/iu;
const NEGATION_VI = /không|chẳng|chưa|đừng|chớ/u;

const FAMILIES = [
  {
    inSource: CONTRAST_EN,
    inRewrite: CONTRAST_VI,
    said: "the source contrasts one reading against another (\"rather than\"/\"instead of\"/\"as opposed to\"/\"whereas\"), and the rewrite carries none of its Vietnamese counterparts (thay vì, hơn là, chứ không, mà không, trái lại, ngược lại, trong khi)",
  },
  {
    inSource: NEGATION_EN,
    inRewrite: NEGATION_VI,
    said: "the source negates a claim (\"not\"/\"never\"/\"without\"/\"no longer\"/\"cannot\"/\"nothing\"/\"nobody\"/\"neither\"), and the rewrite carries no Vietnamese negation (không, chẳng, chưa, đừng, chớ)",
  },
];

/** What a rewrite dropped that changes the source's claim, or null. Checked one family at a time so
 *  the message names the family that fired rather than a merge of every rule this module knows. */
export function diff(source, candidate) {
  if (typeof source !== "string" || typeof candidate !== "string") return null;
  const found = [];
  for (const family of FAMILIES) {
    if (family.inSource.test(source) && !family.inRewrite.test(candidate)) found.push(family.said);
  }
  return found.length ? found.join("; ") : null;
}
