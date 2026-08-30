// A translation that loses `{{count}}` breaks the app at runtime, silently, in a locale most of the
// team cannot read. Every translated string is compared against its source before it may be written.

// Order matters: the longest, most specific forms are matched first.
const PATTERNS = [
  /\$t\([^)]*\)/g,
  /%\{[^}]*\}/g,
  /%\([^)]*\)[a-zA-Z]/g,
  /%\d+\$[a-zA-Z]/g,
  // No space in the flag class on purpose: it would make "50% off" look like a token.
  /%[-+#0]*\d*(?:\.\d+)?[a-zA-Z%]/g,
  /<\/?[A-Za-z][A-Za-z0-9._:-]*(?:\s[^<>]*)?\/?>/g,
  /<\/?\d+>/g,
  /(?<![:\w]):[a-zA-Z_][a-zA-Z0-9_]*/g,
  /\\[nt]/g,
];

const BRACE = /^\{\{?\s*([A-Za-z0-9_.\-]*)/;

/** Every balanced {...} or {{...}} run, so ICU blocks count as one unit. */
function braceSpans(text) {
  const spans = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (text[index] === '}' && depth) {
      depth -= 1;
      if (depth === 0) spans.push([start, index + 1]);
    }
  }
  return spans;
}

function add(counts, token) {
  counts.set(token, (counts.get(token) ?? 0) + 1);
}

/** The multiset of placeholders in `text`. Braced forms reduce to their variable name, so a
 *  translator may reshape an ICU plural block but not rename its variable. */
export function extract(text) {
  const counts = new Map();
  if (typeof text !== 'string') return counts;
  const masked = [...text];
  for (const [start, end] of braceSpans(text)) {
    const chunk = text.slice(start, end);
    const match = BRACE.exec(chunk);
    const name = (match ? match[1] : '').trim();
    // Swapping `{{name}}` for `{name}` breaks the app as surely as dropping it.
    add(counts, chunk.startsWith('{{') ? `{{${name}}}` : `{${name}}`);
    for (let index = start; index < end; index += 1) masked[index] = '\0';
  }
  let rest = masked.join('');
  for (const pattern of PATTERNS) {
    for (const match of [...rest.matchAll(pattern)]) {
      add(counts, match[0]);
      rest = rest.slice(0, match.index) + '\0'.repeat(match[0].length) + rest.slice(match.index + match[0].length);
    }
  }
  return counts;
}

function subtract(left, right) {
  const out = new Map();
  for (const [token, count] of left) {
    const remaining = count - (right.get(token) ?? 0);
    if (remaining > 0) out.set(token, remaining);
  }
  return out;
}

function expand(counts) {
  return [...counts].map(([token, count]) => (count === 1 ? token : `${token} x${count}`)).sort();
}

/** Human-readable description of what changed, or null when the two agree. */
export function diff(source, translated) {
  const want = extract(source);
  const got = extract(translated);
  const missing = subtract(want, got);
  const added = subtract(got, want);
  if (missing.size === 0 && added.size === 0) return null;
  const parts = [];
  if (missing.size) parts.push(`missing ${expand(missing).join(', ')}`);
  if (added.size) parts.push(`invented ${expand(added).join(', ')}`);
  return parts.join('; ');
}
