/* A fixture tracker configuration that does not name the retry ladder lets a case sit the ladder out:
   the transport waits 2s, 4s then 8s between four attempts, so one spawn against a tracker no fixture
   can reach costs 14.2s of sleeping and proves nothing by it. ISS-736 added `retrySeconds` for this
   and one fixture still omitted it two months later, at 28.4s in a single case (ISS-2040). The suite
   went from 219 files to 366 in ten days, so the rule is held here rather than remembered. */

/* Reached: an object literal in a test tree, inside a statement that names this plugin's own
   `config.json`, which names a tracker endpoint and a token of its own and does not name the ladder.
   The statement is what tells a tracker's configuration from another service's — a Coolify session
   carries a url and a token too and answers to no ladder of this transport's. A configuration naming
   no token is no tracker's either, and a nested object is read as its own literal. */

import { lineAt } from "../../markdown.mjs";
import { blanked } from "./wall-clock.mjs";

export const SETTING = "retrySeconds";

const names = (text, key) => new RegExp(`(?:^|[{,\\s])${key}\\s*(?::|[,}])`, "u").test(text);

/* The literal's own keys and not its children's: a config carrying `chatgpt: { url, key }` names a
   url that is not the tracker's, and a rule reading the whole nest would ask the wrong object for the
   ladder. */
const ownKeys = (block) => {
  let out = "";
  let depth = 0;
  for (const character of block) {
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (depth === 0) out += character;
    else out += " ";
  }
  return out;
};

export const STORE = "config.json";

/* The statement the literal stands in, bounded by the semicolons either side of it: a literal is a
   tracker's configuration where the statement writing it says which file it is written to. Read off
   the source and not the blanked copy, the file's name being a string and blanking taking the
   contents of every string — the two are the same length, so one set of offsets answers for both. */
const statementAround = (code, from, at) => {
  const opens = code.lastIndexOf(";", from);
  const closes = code.indexOf(";", at);
  return code.slice(opens + 1, closes === -1 ? code.length : closes);
};

export const laddersIn = (text, rel) => {
  const code = blanked(text);
  const open = [];
  const out = [];
  for (let at = 0; at < code.length; at += 1) {
    if (code[at] === "{") open.push(at);
    else if (code[at] === "}" && open.length) {
      const from = open.pop();
      /* Its own braces kept, so a key written as shorthand at either end of the literal is still
         read as a key: the pattern reads what stands beside a name, and the brace is what stands
         there. */
      const own = `{${ownKeys(code.slice(from + 1, at))}}`;
      if (!names(own, "url") || !names(own, "token") || names(own, SETTING)) continue;
      if (!statementAround(text, from, at).includes(STORE)) continue;
      out.push(`${rel}:${lineAt(code, from)} writes a fixture tracker configuration that does not name `
        + `${SETTING}, so a call this fixture makes waits the transport's real ladder — 2s, 4s then 8s `
        + `between four attempts — for a tracker no fixture can reach. Name it: ${SETTING}: 0.`);
    }
  }
  return [...new Set(out)].sort();
};
