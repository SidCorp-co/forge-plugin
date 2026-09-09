/* The columns this rule holds, stated as patterns and read by property access, so neither the rule nor its reader is a quoted span and neither needs an exemption. Whose word each of these is, and why: `rest.mjs`, which names the document. A column this CLI has no second word for is not here — `complexity` is spoken as the tracker spells it, which is docs/cli/the-kinds.md's decision, and `ALIASES` below is what holds that true. */
import { lineAt } from "../markdown.mjs";

export const COLUMNS = [/baseBranch/u, /previewDeploy/u];

const COLUMN_ROWS = COLUMNS.map((pattern) => ({ pattern }));

const COMPLEXITY = "the tracker's complexity";
const RUNG = "the contract's rung";

/* A third word for one of the two nouns, one row per shape it takes: `band` and `tier` mean nothing else in this CLI and are refused whole, while `size` measures bytes, windows and diffs here, so it is refused by the grammar of the retired mark and the retired flag, and by the word only where the same string already names what it would be a second word for. docs/cli/the-kinds.md. */
export const ALIASES = [
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
 *  is a span of its own rather than the delimiter the scanner mistook for this template's last. */
export const quoted = (text) => {
  const out = [];
  let at = 0;
  const past = (end) => {
    const found = text.indexOf(end, at + end.length);
    at = found === -1 ? text.length : found + end.length;
  };
  const plain = (quote) => {
    const from = at + 1;
    at = from;
    while (at < text.length && text[at] !== quote) at += text[at] === "\\" ? 2 : 1;
    out.push({ from, held: text.slice(from, at) });
    at += 1;
  };
  const template = () => {
    const from = at + 1;
    at = from;
    let held = "";
    while (at < text.length && text[at] !== "`") {
      if (text[at] === "\\") {
        held += text.slice(at, at + 2);
        at += 2;
        continue;
      }
      if (text.slice(at, at + 2) === "${") {
        at += 2;
        code("}");
        continue;
      }
      held += text[at];
      at += 1;
    }
    out.push({ from, held });
    at += 1;
  };
  /* Braces are counted so a hole holding an object or a block ends where its own `}` does. */
  function code(stop) {
    let depth = 0;
    while (at < text.length) {
      const two = text.slice(at, at + 2);
      if (two === "//") {
        past("\n");
        continue;
      }
      if (two === "/*") {
        past("*/");
        continue;
      }
      const one = text[at];
      if (one === '"' || one === "'") {
        plain(one);
        continue;
      }
      if (one === "`") {
        template();
        continue;
      }
      if (stop && one === "{") depth += 1;
      if (stop && one === stop) {
        at += 1;
        if (depth === 0) return;
        depth -= 1;
        continue;
      }
      at += 1;
    }
  }
  code(null);
  return out;
};

const rowsIn = (held, rows) =>
  rows.filter((row) => row.pattern.test(held) && (!row.needs || row.needs.test(held)));

const holdsRetired = (text, from) =>
  RETIRED_HOLDER.test(text.slice(text.lastIndexOf("\n", from) + 1, from - 1));

/** Where a source holds one of those names in a string, named by line so the finding is actionable. */
export const printedColumns = (text, where) =>
  quoted(text).flatMap(({ from, held }) =>
    rowsIn(held, COLUMN_ROWS).map(
      (row) => `${where}:${lineAt(text, from)} prints ${row.pattern.source}`,
    ));

/** Where a source says a third word for one of the two nouns, with the word it refused and which
 *  noun was meant, so the line says what to write instead of it. */
export const printedAliases = (text, where) =>
  quoted(text).flatMap(({ from, held }) =>
    (holdsRetired(text, from) ? [] : rowsIn(held, ALIASES)).map(
      (row) => `${where}:${lineAt(text, from)} says \`${row.pattern.exec(held)[0]}\`, where the word`
        + ` is ${row.meant}`,
    ));
