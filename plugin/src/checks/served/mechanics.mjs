/* The served text may point at a verb and may not say what the verb does (CLAUDE.md; ISS-1569).
   Co-occurrence is refused as the test — "Capture it — `forge claim <ref> --pushed` — before the
   status moves" names a verb and an action in one breath and is correct — so what decides is the
   subject of the claim, and the unit is the segment because one sentence carries both. */

import { lineAt } from "../../markdown.mjs";

const CLI_SPAN = /^`(?:forge|vi-natural|node|npm|git)\b/u;

/** A help text, a guide or a hook's explanation: saying what one holds is pointing at it. */
const DOC_SPAN = /(?:-h|--help|--how|--why)`$|^`forge (?:guide|spec|hooks|doctor --credentials)\b/u;

/** Closed, because an open list reaches "the run" and "the record", which are not calls. */
const ANAPHOR = /^(?:the|a|an|one|both|each|its|that|this|those|these)\s+(?:writes?|verbs?|calls?|refusals?|rechecks?|consults?|landings?|captures?)\b/u;

/* Effect verbs only. Whether a saying verb's complement defers to the verb or supplies the verb's
   own answer is not decidable from the text, and a rule that guessed would be refused here. */
const EFFECT = [
  "refuses", "refuse", "accepts", "accept", "takes", "take", "requires", "require",
  "allows", "allow", "rejects", "reject", "ignores", "ignore", "renews", "renew",
  "removes", "remove", "clears", "clear", "verifies", "verify", "spends", "spend",
  "defaults", "returns", "return", "leaves", "leave", "blocks", "overwrites", "overwrite",
  "writes", "write", "reads", "read",
].join("|");
const PREDICATE = new RegExp(`^(?:${EFFECT})\\b`, "u");

const CONNECTIVE = /^(?:\s|,|\band\b|\bor\b|\bboth\b|\beach\b|\balone\b|\bthen\b|\balso\b|\bstill\b|\bonly\b|\bitself\b|\bnever\b|\balways\b|\bhere\b|\bthere\b|`[^`\n]+`)+/u;

const RELATIVE = /^\s*(?:which|that)\b/u;

/** Emphasis, then one introductory adverbial: "Normally, `forge record plan` refuses" is still the subject. */
const LEADING = /^[\s*_>-]*(?:(?:and|but|or|nor|so|then)\s+)?(?:[A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*){0,3},\s*)?[\s*_"']*/u;

/* A bare comma is no boundary, so one sentence punctuated either way reads the same. */
const BOUNDARY = new RegExp([
  String.raw`(?<![A-Z])[.!?;:](?=[*_"')\]]*(?:\s|$))`,
  String.raw`\s[—–]\s`,
  String.raw`,\s+(?=(?:and|but|or|nor|so|which|that|where|because|unless|while|since)\s)`,
  String.raw`\n\s*\n`,
  String.raw`\n\s*(?=[-*+]\s|\d+\.\s|\|)`,
].join("|"), "gu");

const prose = (text) => String(text)
  .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gmu, (hit) => hit.replace(/[^\n]/gu, " "))
  .replace(/<!--[\s\S]*?-->/gu, (hit) => hit.replace(/[^\n]/gu, " "))
  .replace(/^[ \t]*#[^\n]*$/gmu, (hit) => " ".repeat(hit.length));

const segments = (text) => {
  const out = [];
  let at = 0;
  for (const hit of text.matchAll(BOUNDARY)) {
    out.push({ text: text.slice(at, hit.index), at, to: hit.index });
    at = hit.index + hit[0].length;
  }
  out.push({ text: text.slice(at), at, to: text.length });
  return out.filter((one) => one.text.trim());
};

const opensWith = (segment) => {
  const lead = LEADING.exec(segment)?.[0].length ?? 0;
  const rest = segment.slice(lead);
  const span = /^`[^`\n]+`/u.exec(rest);
  if (span) return CLI_SPAN.test(span[0]) && !DOC_SPAN.test(span[0]) ? { at: lead, to: lead + span[0].length } : null;
  const noun = ANAPHOR.exec(rest);
  return noun ? { at: lead, to: lead + noun[0].length } : null;
};

const endsOn = (segment) => {
  const last = [...segment.matchAll(/`[^`\n]+`/gu)].at(-1);
  if (!last || last.index + last[0].length !== segment.trimEnd().length) return null;
  return CLI_SPAN.test(last[0]) && !DOC_SPAN.test(last[0]) ? last[0] : null;
};

const joined = (found) => {
  const out = [];
  for (let at = 0; at < found.length; at += 1) {
    const one = found[at];
    const bare = opensWith(one.text);
    const alone = bare && !one.text.slice(bare.to).trim().replace(/^[\s,*_]+/u, "");
    if (alone && at < found.length - 1) {
      out.push({ text: `${one.text.trimEnd()} ${found[at + 1].text.trimStart()}`, at: one.at, to: found[at + 1].to });
      at += 1;
      continue;
    }
    out.push(one);
  }
  return out;
};

const tidy = (text) => text.trim().replace(/\s+/gu, " ");

const remainder = (text) => tidy(text)
  .replace(/\*\*/gu, "")
  .replace(/^[\s*_>-]+/u, "")
  .replace(/[\s*_]+$/u, "")
  .replace(/,?\s+(?:and|or|but|so|then)\s*(?=[.;:,]|$)/gu, "")
  .replace(/\s+([.,;:])/gu, "$1")
  .replace(/^[.,;:\s]+/u, "")
  .replace(/^(?:and|or|but|so|then)\s+/u, "");

const STOP = /(?<![A-Z])[.!?](?=[*_"')\]]*(?:\s|$))|\n\s*\n/gu;
const stops = (text) => [...text.matchAll(STOP)].map((one) => one.index + one[0].length);
const sentenceOpens = (text, at) => stops(text.slice(0, at)).at(-1) ?? 0;
const sentenceShuts = (text, at) => stops(text.slice(at)).map((one) => one + at)[0] ?? text.length;

const says = (rel, line, cut, left) =>
  `${rel}:${line} describes what a verb does rather than pointing at it: "${cut}". `
  + "The verb's own behaviour belongs to its `-h` and to the source, and a second copy here goes "
  + "stale without failing anything. Delete that clause; what remains is "
  + (left ? `"${left}"` : "nothing of the sentence, which goes whole")
  + ". A sentence that names the verb and says when to call it is not this and passes.";

/** Every clause of one served text making a verb's behaviour its subject, each naming the cut. */
export const mechanicsIn = (text, rel) => {
  const body = prose(text);
  const found = [];
  let carried = null;
  for (const part of joined(segments(body))) {
    const here = opensWith(part.text);
    const relative = RELATIVE.exec(part.text);
    const ref = here ?? (relative && carried ? { at: 0, to: relative[0].length } : null);
    carried = endsOn(part.text);
    if (!ref) continue;
    const rest = part.text.slice(ref.to);
    const skip = CONNECTIVE.exec(rest)?.[0] ?? "";
    if (!PREDICATE.test(rest.slice(skip.length))) continue;
    const from = part.at + ref.at;
    const to = body.slice(0, part.to).replace(/\s+$/u, "").length;
    const opens = sentenceOpens(body, from);
    const shuts = sentenceShuts(body, to);
    const kept = `${body.slice(opens, from).replace(/[\s,;:—–]+$/u, "")} ${body.slice(to, shuts)}`;
    found.push(says(rel, lineAt(body, from), tidy(body.slice(from, to)), remainder(kept)));
  }
  return found;
};
