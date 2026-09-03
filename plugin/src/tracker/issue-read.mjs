/* Which issues a call writes to, read from the arguments the verb takes and not searched for in the
   text: a reference in a heredoc, a quoted value or a path is no target, and one by uuid is. */
import { HUMAN_REF, UUID } from "./issues.mjs";

const READS = new Set(["list", "get"]);
const DEPTH = 4;

/* Parsed, never searched: a key named twice resolves one way for JSON and another for a search. */
const payload = (text) => {
  const at = String(text ?? "").indexOf("{");
  try {
    return at < 0 ? null : JSON.parse(String(text).slice(at, String(text).lastIndexOf("}") + 1));
  } catch {
    return null;
  }
};

export const readAction = (held) => READS.has((typeof held === "string" ? payload(held) : held)?.action);

export const isReference = (value) => typeof value === "string" && (UUID.test(value) || HUMAN_REF.test(value));

/* Where each tool carries the issue — and a comment's own id, which names no issue, is not there. */
const TARGET_KEYS = {
  forge_issues: ["documentId", "issueId"],
  forge_comments: ["issue"],
};

const under = (value, keys, depth = 0) => {
  if (!value || typeof value !== "object" || depth > DEPTH) return [];
  return Object.entries(value).flatMap(([name, held]) =>
    (keys.includes(name) && isReference(held) ? [held] : under(held, keys, depth + 1)));
};

export const targetsOfTool = (tool, input) => {
  const keys = TARGET_KEYS[tool];
  if (!keys || readAction(input)) return [];
  return under(input, keys);
};

/* Quote removal as the shell does it, so the verb and this read one argument alike: a quote inside a
   word is a join and not a character, and the hook cannot defer to whichever CLI is on PATH. */
const ESCAPED = /["$`\\]/u;
const unquoted = (word) => {
  let out = "";
  let quote = "";
  for (let at = 0; at < word.length; at += 1) {
    const one = word[at];
    if (one === "\\" && quote !== "'" && (quote !== '"' || ESCAPED.test(word[at + 1] ?? ""))) {
      out += word[at + 1] ?? "";
      at += 1;
    } else if (quote) {
      out += one === quote ? "" : one;
      quote = one === quote ? "" : quote;
    } else if (one === '"' || one === "'") {
      quote = one;
    } else {
      out += one;
    }
  }
  return out;
};

/* One word is one argument, quoted whitespace included, or a value holding a flag reads as it. */
const WORDS = /(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*"|\\[\s\S]|\S)+/gu;
const CUT = /(?<!\\)\\$/u;

/* Which argument is the issue — `dep` renews the second's lease. */
const VERBS = {
  comment: { at: [0] },
  plan: { at: [0] },
  claim: { at: [0] },
  attach: { at: [1], when: (args) => args[0] === "issue" },
  dep: { at: [1] },
  record: { at: [1], when: (args) => args[0] !== "report" },
  advance: { at: [0], when: (args) => !args.includes("--owed") },
};

const CALL = /^(?:\S*\/)?forge\s+call\s+(forge_\w+)\b/u;
const VERB = /^(?:\S*\/)?forge\s+([a-z]+)\b/u;

const spokenTargets = (one) => {
  const called = CALL.exec(one);
  if (called) return targetsOfTool(called[1], payload(one));
  const said = VERB.exec(one);
  const verb = VERBS[said?.[1]];
  if (!verb) return [];
  const args = (one.match(WORDS) ?? []).slice(2).map((word) => (CUT.test(word) ? "" : unquoted(word)));
  if (verb.when && !verb.when(args)) return [];
  return verb.at.map((index) => args[index]).filter(isReference);
};

/** The physical lines a shell joins before it reads a word: the shared grammar cuts a command at a
 *  newline, which is right for asking where one starts and wrong for the word this then reads. A
 *  backslash escaping a backslash leaves the newline a separator, and single quotes join nothing. */
export const joined = (command) => {
  const text = String(command ?? "");
  let out = "";
  let quote = "";
  for (let at = 0; at < text.length; at += 1) {
    const one = text[at];
    if (quote !== "'" && one === "\\") {
      const next = text[at + 1] ?? "";
      at += 1;
      out += next === "\n" ? "" : one + next;
    } else {
      quote = one === "'" || one === '"' ? (quote === one ? "" : quote || one) : quote;
      out += one;
    }
  }
  return out;
};

/** Every issue one call writes to, so a compound is answered once — parsed for the tracker's own
 *  tool, and read where a command starts for a shell one. */
export const writeTargets = ({ name, input }, spoken = []) => {
  const tool = /^mcp__forge__(forge_\w+)$/u.exec(name ?? "")?.[1];
  const found = tool ? targetsOfTool(tool, input) : spoken.flatMap(spokenTargets);
  return [...new Set(found)];
};
