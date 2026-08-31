// Call-to-action discipline: a button says the verb, the screen says the noun. See VI-NATURAL.md.

import { stripChars } from "../util.mjs";
import { GENERIC, VI_BARE } from "../vi-text.mjs";

export { GENERIC };

const BARE = new Set(VI_BARE);

// Key paths where a specific label is the correct answer: an aria label has no visible screen to
// supply the noun, and a status names a state rather than an action.
const NOT_A_BUTTON =
  /(status|state|step|switch|loading|title|column|group|target|reason|permission|audit|placeholder|menu|aria|label|heading|badge|tab|nav|empty|hint|notice|error|toast)/i;

const SHARED_NAMESPACE = /^(common|shared|actions?|buttons?|ui|global)\./i;

export function normalize(text) {
  return stripChars(stripChars(stripChars(text.trim(), "…"), ".?!:"), " \t\n\r").toLowerCase();
}

export function isActionKey(label) {
  return !NOT_A_BUTTON.test(label);
}

/** Bare CTAs the file already carries: vi label → the key that owns it. A per-screen key never
 *  teaches the checker its own label, or it would license itself. */
export function genericIndex(pairs) {
  const index = new Map();
  for (const [label, english, vietnamese] of pairs) {
    if (!(normalize(english) in GENERIC) || !vietnamese) continue;
    const vi = normalize(vietnamese);
    if ((BARE.has(vi) || SHARED_NAMESPACE.test(label)) && !index.has(vi)) index.set(vi, label);
  }
  return index;
}

export function isBare(vietnamese, index) {
  const label = normalize(vietnamese);
  // One syllable is always one word, so it cannot be a verb plus an object.
  if (label && !label.includes(" ")) return true;
  return BARE.has(label) || Boolean(index && index.has(label));
}

/** Labels the translation made specific when the source was generic. */
export function inflated(pairs, index) {
  const findings = [];
  for (const [label, english, vietnamese] of pairs) {
    const key = normalize(english);
    if (!(key in GENERIC) || !vietnamese) continue;
    if (!isActionKey(label) || isBare(vietnamese, index)) continue;
    const suggested = GENERIC[key];
    findings.push({
      key: label,
      en: english,
      vi: vietnamese,
      suggested,
      existing: (index && index.get(normalize(suggested))) ?? null,
    });
  }
  return findings;
}

/** Per-screen action keys a shared generic key would already cover. */
export function collapseGroups(pairs, index, minimum = 3) {
  const groups = new Map();
  for (const [label, english, vietnamese] of pairs) {
    const words = normalize(english).split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4 || !(words[0] in GENERIC)) continue;
    if (!isActionKey(label) || vietnamese.includes("{")) continue;
    // A noun phrase is not a button whose verb could be shared.
    if (!normalize(vietnamese).startsWith(normalize(GENERIC[words[0]]))) continue;
    if (!groups.has(words[0])) groups.set(words[0], []);
    groups.get(words[0]).push({ key: label, en: english, vi: vietnamese });
  }

  const out = [];
  for (const [verb, members] of groups) {
    if (members.length < minimum) continue;
    const bare = GENERIC[verb];
    out.push({
      verb,
      bare,
      existing: (index && index.get(normalize(bare))) ?? null,
      members: [...members].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    });
  }
  return out.sort((a, b) => b.members.length - a.members.length);
}
