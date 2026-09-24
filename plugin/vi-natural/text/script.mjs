// A rendering is Vietnamese in one script. A sampled decode can slip into a second language for one
// word — `факt` for "facts", Cyrillic with a Latin tail — and a reader who does not know Vietnamese
// sees a word-shaped token in a sentence that parses, so nothing but a check on the characters
// catches it (ISS-412).

// Common and Inherited are in because precomposed Vietnamese is Latin but the NFD spelling of the same
// word is a Latin letter plus Inherited combining marks; a range over the precomposed letters passes
// one spelling and refuses the other.
const STORABLE = /[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

// Only to name what was found; a script missing here is still refused, under the generic name.
const NAMED = [
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Hebrew", /\p{Script=Hebrew}/u],
  ["Arabic", /\p{Script=Arabic}/u],
  ["Han", /\p{Script=Han}/u],
  ["Hiragana", /\p{Script=Hiragana}/u],
  ["Katakana", /\p{Script=Katakana}/u],
  ["Hangul", /\p{Script=Hangul}/u],
  ["Thai", /\p{Script=Thai}/u],
  ["Devanagari", /\p{Script=Devanagari}/u],
];

const SHOWN = 5;

const scriptOf = (character) => NAMED.find(([, pattern]) => pattern.test(character))?.[0] ?? "non-Latin";

/** Each whitespace-delimited word of `rendered` holding a character neither storable nor in `source`. */
export function strays(source, rendered) {
  const carried = new Set(source);
  const found = [];
  for (const { 0: word, index } of rendered.matchAll(/\S+/gu)) {
    const foreign = [...word].find((character) => !STORABLE.test(character) && !carried.has(character));
    if (foreign) found.push({ word, index, script: scriptOf(foreign) });
  }
  return found;
}

/** Human-readable description of the foreign-script words, or null when there are none. Same shape
 *  as `placeholders.diff`, so the engine holds every key to it beside the caller's own verifier. */
export function diff(source, rendered) {
  const found = strays(source, rendered);
  if (!found.length) return null;
  const named = found.slice(0, SHOWN).map(({ word, index, script }) => `${JSON.stringify(word)} (${script}) at offset ${index}`);
  const more = found.length > SHOWN ? `, and ${found.length - SHOWN} more` : "";
  return `a script the source does not carry: ${named.join(", ")}${more}`;
}
