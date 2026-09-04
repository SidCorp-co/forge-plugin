/* The tracker's own column names, which this CLI reads and never shows: a name an agent has to
   translate costs a round — docs/cli/the-project.md. Stated as patterns, and read by property access, so
   neither the rule nor its reader is a quoted span and neither needs an exemption. */
export const COLUMNS = [/baseBranch/u, /previewDeploy/u, /complexity/u];

/** Every quoted span, comments dropped: a pattern over the file cannot tell a read from a print. */
export const quoted = (text) => {
  const out = [];
  let at = 0;
  const past = (end) => {
    const found = text.indexOf(end, at + end.length);
    at = found === -1 ? text.length : found + end.length;
  };
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
    const quote = text[at];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      at += 1;
      continue;
    }
    const from = at + 1;
    at = from;
    while (at < text.length && text[at] !== quote) at += text[at] === "\\" ? 2 : 1;
    out.push({ from, held: text.slice(from, at) });
    at += 1;
  }
  return out;
};

/** Where a source holds one of those names in a string, named by line so the finding is actionable. */
export const printedColumns = (text, where) =>
  quoted(text).flatMap(({ from, held }) =>
    COLUMNS.filter((column) => column.test(held)).map(
      (column) => `${where}:${text.slice(0, from).split("\n").length} prints ${column.source}`,
    ));
