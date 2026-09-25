/* What the shape checkers under this directory read a call as: its arguments split where the call
   splits them, over code whose strings, comments and regular expressions are blanked, so a comma
   or an operator spelled inside a string is not one. Offsets are kept, so a caller reads the
   source's own text back at the same place. */

const OPENS = "([{";
const CLOSES = ")]}";

/** The arguments of the call whose `(` stands at `open` in `code`, each as its `from` and `to`, and
 *  where the call closes. A call left open reads to the end of the code. */
export const argumentsAt = (code, open) => {
  const out = [];
  let depth = 0;
  let from = open + 1;
  for (let at = open; at < code.length; at += 1) {
    if (OPENS.includes(code[at])) depth += 1;
    else if (CLOSES.includes(code[at])) {
      depth -= 1;
      if (depth === 0) {
        if (code.slice(from, at).trim()) out.push({ from, to: at });
        return { args: out, close: at };
      }
    } else if (code[at] === "," && depth === 1) {
      out.push({ from, to: at });
      from = at + 1;
    }
  }
  return { args: out, close: code.length };
};

/** Whether `operator` stands in `code` between `from` and `to` outside every bracket. */
export const atTopLevel = (code, from, to, operator) => {
  let depth = 0;
  for (let at = from; at < to; at += 1) {
    if (OPENS.includes(code[at])) depth += 1;
    else if (CLOSES.includes(code[at])) depth -= 1;
    else if (depth === 0 && code.startsWith(operator, at)) return true;
  }
  return false;
};
