/* R-20: what §19 declares against what this source reaches. `documents` is the tree and `sources`
   this repository's own modules, each `{ file, text }` with `file` from the root — the spelling a
   clause claims a module in. What the selector does not reach is `docs/requirements/README.md`'s. */
import { CODE_SPAN_NONEMPTY_PATTERN } from "../../markdown.mjs";
import { clausesOf } from "../parse.mjs";

const FIELD = "Reached from";
const SPAN = new RegExp(CODE_SPAN_NONEMPTY_PATTERN, "gu");
const CALLS = /(?<![\w$])fetch\s*\(/u;
const ADDRESS = /https?:\/\//u;

const ROUTE = "Write the interface clause it crosses in docs/requirements/srs/19-external-interfaces.md"
  + ` and name this module in its \`${FIELD}:\` field, or name it there on the clause that already`
  + " carries this boundary";

export const claimedIn = (documents) => {
  const out = new Set();
  for (const { text } of documents) {
    for (const clause of clausesOf(text)) {
      if (clause.prefix !== "EI") continue;
      for (const found of String(clause.fields[FIELD] ?? "").matchAll(SPAN)) out.add(found[1]);
    }
  }
  return out;
};

export const reachesOut = (text) => CALLS.test(String(text ?? "")) || ADDRESS.test(String(text ?? ""));

export const reachedProblems = (documents, sources) => {
  const claimed = claimedIn(documents);
  return sources
    .filter((one) => reachesOut(one.text) && !claimed.has(one.file))
    .map((one) => `${one.file} R-20 reaches an endpoint outside this product and no EI clause `
      + `names it. ${ROUTE}`);
};
