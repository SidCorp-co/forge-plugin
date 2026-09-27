/* The parts arm of the filing shape: a line whose phrase governs two issue keys claims them as this
   filing's parts. A key is read under the prefixes the project holds and never under a widened
   pattern, because `[A-Z]+-\d+` reads `RFC-2119` and `UTF-8` in an ordinary body and this arm
   refuses a filing. The tracker's own reader of the same body builds its keys the same way. */

/* The prefix every project still answers to, whether or not it set one of its own. */
const LEGACY = "ISS";
const ROW_KEY = /^([A-Za-z][A-Za-z0-9]{1,5})-\d+$/u;

const PARTS_PHRASE = /\b(?:parts?|children|sub-?issues?|split into|consists of|made up of)\b/giu;
const BARE = /^parts?$/iu;
const LABEL = /\([^()]*\)/gu;

const alternates = (prefixes) => [...new Set([LEGACY, ...prefixes]
  .map((one) => String(one).toUpperCase().replace(/[^A-Z0-9]/gu, ""))
  .filter(Boolean))].join("|");

/* Forward only, a bare "part" through a connective or not at all, and a label only between a key
   and its separator: without those the arm catches "ISS-a and ISS-b split into the halves", "a
   guide part ISS-a (the lesson) and ISS-b", and a citation inside a label read as a part. */
const readers = (prefixes) => {
  const key = `(?:${alternates(prefixes)})-\\d+`;
  const between = String.raw`[\s\x60*_]*(?:\([^()]{0,40}\))?[\s\x60*_]*(?:,\s*and|,|;|and|&)[\s\x60*_]*`;
  const link = String.raw`(?<link>(?:[\s\x60*_]*[:=]|\s+(?:are|is|both|these|the following)\b)*)`;
  return {
    governed: new RegExp(String.raw`^${link}[\s\x60*_]*(?<keys>${key}\b(?:${between}${key}\b)+)`, "iu"),
    key: new RegExp(String.raw`\b${key}\b`, "giu"),
  };
};

/** The prefixes a project's keys are spelled in, read off rows the tracker already spelled: every
 *  row renders under the project's one active prefix, so a reading that fetched rows names it with
 *  no request of its own. A prefix the project held before and renders nowhere is not among them. */
export const prefixesOf = (rows = []) => [...new Set((rows ?? [])
  .map((row) => ROW_KEY.exec(String(row?.issueId ?? ""))?.[1]?.toUpperCase())
  .filter(Boolean))];

/** Two keys the phrase governs, never a line that merely holds both — that is a cross-reference
 *  (ISS-336); two because one may cite the issue this body sits beside. Every occurrence is tried.
 *  With no prefixes given, only the legacy one is read. */
export const partsIn = (body, prefixes = []) => {
  const { governed, key } = readers(prefixes);
  for (const line of String(body).split("\n")) {
    for (const phrase of line.matchAll(PARTS_PHRASE)) {
      const found = governed.exec(line.slice(phrase.index + phrase[0].length));
      if (!found || (BARE.test(phrase[0]) && !found.groups.link)) continue;
      const claimed = found.groups.keys.replace(LABEL, " ").match(key) ?? [];
      const keys = [...new Set(claimed.map((one) => one.toUpperCase()))];
      if (keys.length >= 2) return { line: line.trim(), keys, phrase: phrase[0] };
    }
  }
  return null;
};
