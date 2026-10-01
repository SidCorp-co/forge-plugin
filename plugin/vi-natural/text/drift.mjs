// A rewrite may reword freely, but not drop the one thing that decides what a sentence claims: a
// contrast between two readings, or a negation. `placeholders.diff` and `markdown.verify` catch a
// structure the rewrite broke; this catches a claim it inverted or dropped while staying fluent and
// well-formed, which is why counting untranslated blocks alone never saw it (ISS-1752).
//
// Two readings, because a source arrives in either language. An English source is held by presence:
// its construct has to have some Vietnamese counterpart somewhere in the block, since English and
// Vietnamese markers do not pair one to one. A Vietnamese source is held by count: the rewrite may
// not carry fewer Vietnamese markers than the block it was given, which is what dropping "chưa" from
// one clause while another keeps its own does (ISS-2098). Negations and contrasts are one count
// there because Vietnamese trades one for the other faithfully ("thay vì A, B" is "không A mà B").
// An English source carries none, so the count never fires on it.
//
// A drop only, never an addition, and presence rather than attachment for an English source: a false
// refusal is worse than a missed one, and a token count cannot tell an inversion by addition from a
// faithful "thiếu" written "không có". Both need a verifier that reads meaning (ISS-2844).
//
// Every Vietnamese word here comes from vi-text.mjs, the one file this tree lets carry Vietnamese
// literals (tools/check-vi-text.mjs), so the two readings cannot disagree about what a marker is.

import {
  ABSENCE_VI_WORDS,
  CONTRAST_VI_WORDS,
  COORDINATOR_VI_WORDS,
  NEGATION_VI_WORDS,
  NOT_NEGATING_VI_PAIRS,
  NOT_NEGATING_VI_WORDS,
  QUESTION_VI_WORDS,
  UNCOUNTED_CONTRAST_VI_WORDS,
} from "../vi-text.mjs";
import { escaped } from "../../src/markdown.mjs";

const CONTRAST_EN = /\brather than\b|\binstead of\b|\bas opposed to\b|\bwhereas\b/iu;
const NEGATION_EN = /\bnot\b|n't\b|\bnever\b|\bno longer\b|\bwithout\b|\bnothing\b|\bnobody\b|\bneither\b|\bcannot\b/iu;

/* `\b` is ASCII-only even under `u`, so a syllable ending in "à" or "ư" has no boundary after it. */
const LETTER = String.raw`[\p{L}\p{M}\p{N}]`;
const listed = (words) => words.split(", ");
const spelled = (word) => escaped(word).replace(/ /gu, String.raw`\s+`);
const whole = (word) => `(?<!${LETTER})${spelled(word)}(?!${LETTER})`;
/* Longest first, so "chứ không" is one marker rather than a contrast and then a negation. */
const anyOf = (words) => [...words].sort((a, b) => b.length - a.length).map(whole).join("|");

const CONTRAST_VI = listed(CONTRAST_VI_WORDS);
const NEGATION_VI = listed(NEGATION_VI_WORDS);
const UNCOUNTED = new Set(listed(UNCOUNTED_CONTRAST_VI_WORDS));
const COUNTED_VI = [...NEGATION_VI, ...CONTRAST_VI.filter((word) => !UNCOUNTED.has(word))];

/* What opens with a negation word and negates nothing — a compound, a question's closing particle —
   is never a marker on either side. */
const NOT_NEGATING = new RegExp([
  anyOf(listed(NOT_NEGATING_VI_WORDS)),
  `(?:${anyOf(listed(QUESTION_VI_WORDS))})(?=\\s*\\?)`,
].join("|"), "giu");

/* What a source carries that a faithful rewrite may still drop, so it is not demanded of the rewrite
   and is still credited to one that keeps it: an opener the style contract tells the rewrite to remove
   where the word pairing it follows in the same sentence ("không phải A mà là B" is "là B"), and a
   negation repeated after a coordinator, which Vietnamese folds into the first ("không A và không B"
   is "không A hay B") — the same word only, since "không A và chưa B" cannot share one. */
const SENTENCE = String.raw`[^.!?;\n]*?`;
const pairedOpener = (pair) => {
  const [opener, follower] = pair.split(" … ");
  return `${whole(opener)}(?=${SENTENCE}${whole(follower)})`;
};
const UNDEMANDED = new RegExp([
  ...listed(NOT_NEGATING_VI_PAIRS).map(pairedOpener),
  `(?<=(?<first>${anyOf(NEGATION_VI)})${SENTENCE})(?:,\\s*|(?:${anyOf(listed(COORDINATOR_VI_WORDS))})\\s+)\\k<first>(?!${LETTER})`,
].join("|"), "giu");

/* A word that states an absence carries a negation's claim in a rewrite ("không có" is "thiếu"), so a
   rewrite is credited for one; a source is never held to it, being no marker of its own. */
const ABSENT = new RegExp(anyOf(listed(ABSENCE_VI_WORDS)), "giu");

const carries = (text, words) => new RegExp(anyOf(words), "iu").test(text.normalize("NFC"));
const COUNTED = new RegExp(anyOf(COUNTED_VI), "giu");
const counted = (text) => text.match(COUNTED)?.length ?? 0;
const kept = (text) => text.normalize("NFC").replace(NOT_NEGATING, " ");
const demanded = (text) => kept(text).replace(UNDEMANDED, " ");

const PRESENCE = [
  {
    inSource: CONTRAST_EN,
    inRewrite: CONTRAST_VI,
    said: `the source contrasts one reading against another ("rather than"/"instead of"/"as opposed to"/"whereas"), and the rewrite carries none of its Vietnamese counterparts (${CONTRAST_VI_WORDS})`,
  },
  {
    inSource: NEGATION_EN,
    inRewrite: NEGATION_VI,
    said: `the source negates a claim ("not"/"never"/"without"/"no longer"/"cannot"/"nothing"/"nobody"/"neither"), and the rewrite carries no Vietnamese negation (${NEGATION_VI_WORDS})`,
  },
];

const lostMarkers = (source, candidate) => {
  const had = counted(demanded(source));
  const rewrite = kept(candidate);
  const left = counted(rewrite) + (rewrite.match(ABSENT)?.length ?? 0);
  return left < had
    ? `the source carries ${had} Vietnamese negation or contrast marker(s) (${COUNTED_VI.join(", ")}) and the rewrite carries ${left}, so a clause lost the negation or contrast it was written with`
    : null;
};

/** What a rewrite dropped that changes the source's claim, or null. Each reading is named on its own
 *  so the message says which one fired rather than a merge of every rule this module knows. */
export function diff(source, candidate) {
  if (typeof source !== "string" || typeof candidate !== "string") return null;
  const found = PRESENCE
    .filter((family) => family.inSource.test(source) && !carries(candidate, family.inRewrite))
    .map((family) => family.said);
  const lost = lostMarkers(source, candidate);
  if (lost) found.push(lost);
  return found.length ? found.join("; ") : null;
}

