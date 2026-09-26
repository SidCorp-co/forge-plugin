/* The columns this rule holds, stated as patterns and read by property access, so neither the rule nor its reader is a quoted span and neither needs an exemption. Whose word each of these is, and why: `rest.mjs`, which names the document. A column this CLI has no second word for is not here — `complexity` is spoken as the tracker spells it, which is docs/cli/the-kinds.md's decision, and `ALIASES` below is what holds that true. */
import { lineAt } from "../markdown.mjs";
import { COMMENTS, KINDS, LITERALS, literalsIn, maskOf } from "./lexical.mjs";

/* A row may name where its word is not the tracker's. The deploy bindings are the case: another
   service this CLI speaks answers a field of its own under the same word, and that surface prints
   its provider's vocabulary by design, so the rule holds the column everywhere but there rather than
   giving the column up for the collision. */
export const COLUMNS = [
  { pattern: /baseBranch/u },
  { pattern: /environments/u, elsewhere: /^plugin\/src\/tools\/services\//u },
];

const COMPLEXITY = "the tracker's complexity";
const RUNG = "the contract's rung";

/* A third word for one of the two nouns, one row per shape it takes: `band` and `tier` mean nothing else in this CLI and are refused whole, while `size` measures bytes, windows and diffs here, so it is refused by the grammar of the retired mark and the retired flag, and by the word only where the same string already names what it would be a second word for. docs/cli/the-kinds.md. This walk reads sources and not `docs/`, and stays that way: the two documents naming a retired spelling name it as the history a reader needs, and the one rename that did reach a document — `bandFor` — is refused by the identifier rule in `doc-shape.mjs` instead, which asks whether the name exists rather than whether the word is retired (ISS-897). */
const ALIASES = [
  { pattern: /\bbands?\b/iu, meant: COMPLEXITY },
  { pattern: /\btiers?\b|\buntiered\b/iu, meant: RUNG },
  { pattern: /\bsize:\s*(?:trivial|fix|feature)\b/iu, meant: RUNG },
  { pattern: /\bsize:\s*(?:xs|s|m|l|xl)\b/iu, meant: COMPLEXITY },
  { pattern: /--size[ =]*<?(?:trivial|fix|feature|xs|s|m|l|xl)\b/iu, meant: COMPLEXITY },
  { pattern: /\b(?:trivial|fix|feature)[- ]sized?\b/iu, meant: RUNG },
  {
    pattern: /(?<![.\w])(?:sizes?|sized|sizing)\b/iu,
    needs: /\b(?:complexity|rung|ladder)\b/iu,
    meant: "one of the two the same string already names",
  },
];

/* The one shape an alias may stand in: the initializer of a declaration whose own name says the spelling is retired, so a reader of a historical record keeps the old word under a name that says so. A second string on that line is refused as any other is, and no path is exempt. */
const RETIRED_HOLDER = /^\s*(?:export\s+)?const\s+RETIRED[A-Z_]*\s*=\s*$/u;

/** Every quoted span, comments dropped: a pattern over the file cannot tell a read from a print. A
 *  template is one span with the text of its `${…}` holes taken out, so a sentence broken by a hole
 *  is still read whole, and what stands in a hole is read as the code it is — a string nested there
 *  is a span of its own. */
export const quoted = (text) => {
  const spans = [];
  const templates = new Map();
  for (const one of literalsIn(text)) {
    const held = text.slice(one.from, one.to);
    if (one.kind === KINDS.SINGLE || one.kind === KINDS.DOUBLE) spans.push({ from: one.from, held });
    if (one.kind !== KINDS.TEMPLATE) continue;
    const open = templates.get(one.template);
    if (open) open.held += held;
    else {
      templates.set(one.template, { from: one.from, held });
      spans.push(templates.get(one.template));
    }
  }
  return spans;
};

/** The same source with every comment, string and regex blanked, quotes and all, and every offset
 *  kept, so a name a rename left behind in prose is not evidence the binding survived. What a string
 *  may still stand as evidence of is `doc-shape.mjs`'s to say, off the spans above. */
export const codeOf = (text) => maskOf(text, { blank: [...COMMENTS, ...LITERALS], quotes: "blank" });

const rowsIn = (held, rows) =>
  rows.filter((row) => row.pattern.test(held) && (!row.needs || row.needs.test(held)));

const holdsRetired = (text, from) =>
  RETIRED_HOLDER.test(text.slice(text.lastIndexOf("\n", from) + 1, from - 1));

/** Where a source holds one of those names in a string, named by line so the finding is actionable. */
export const printedColumns = (text, where) => {
  const rows = COLUMNS.filter((row) => !row.elsewhere?.test(where));
  return quoted(text).flatMap(({ from, held }) =>
    rowsIn(held, rows).map(
      (row) => `${where}:${lineAt(text, from)} prints ${row.pattern.source}`,
    ));
};

/** Where a source says a third word for one of the two nouns, with the word it refused and which
 *  noun was meant, so the line says what to write instead of it. */
export const printedAliases = (text, where) =>
  quoted(text).flatMap(({ from, held }) =>
    (holdsRetired(text, from) ? [] : rowsIn(held, ALIASES)).map(
      (row) => `${where}:${lineAt(text, from)} says \`${row.pattern.exec(held)[0]}\`, where the word`
        + ` is ${row.meant}`,
    ));
