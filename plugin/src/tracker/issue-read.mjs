/* Which issues a call writes to, read from the arguments the verb takes and not searched for in the
   text: a reference in a heredoc, a quoted value or a path is no target, and one by uuid is. And
   which call files a new one, which names no issue yet and so owes no comment delivery. */
import { isReference } from "./issues.mjs";
import { EDGE_KINDS } from "./routes.mjs";

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

/* Quote removal as the shell does it, so the verb and this read one argument alike, and the hook cannot defer to whichever CLI is on PATH: a quote inside a word joins it. */
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

const EDGE_FLAGS = [...EDGE_KINDS, "unlink"].map((one) => `--${one}`);

/* Positionals as `partition` finds them, so a row reads a slot and not a fixed index: `comment` declares no boolean flag, every `--flag` takes the next word, and a body after `--title T` is the write the raw second argument called a read. With no body the verb reads the thread, and holding a read is circular — the command held is the one the refusal asks for. */
const positionalsIn = (args) =>
  args.filter((one, at) => !one.startsWith("--") && !(at > 0 && args[at - 1].startsWith("--")));

/* Which argument is the issue, read off the words themselves. */
const VERBS = {
  comment: { words: positionalsIn, at: () => [0], when: (args) => args.length > 1 },
  claim: { at: () => [0] },
  attach: { at: () => [1], when: (args) => args[0] === "issue" },
  /* An edge write is taken against the end whose order moves, so that end is the read owed. */
  issue: {
    when: (args) => args.some((one) => EDGE_FLAGS.includes(one)),
    at: (args) => {
      const blocks = args.indexOf("--blocks");
      return [blocks < 0 ? 0 : blocks + 1];
    },
  },
  record: { at: () => [1] },
  advance: { at: () => [0], when: (args) => !args.includes("--owed") },
};

const VERB = /^(?:\S*\/)?forge\s+([a-z]+)\b/u;
/* The one raw surface left: this CLI has no verb that types a tool name, so a Bash line cannot name a route, and a connected MCP client still can — which is what `toolOfCall` is read for. */
const MCP = /^mcp__forge__(forge_\w+)$/u;

export const toolOfCall = (name) => MCP.exec(name ?? "")?.[1] ?? null;

const spokenTargets = (one) => {
  const said = VERB.exec(one);
  const verb = VERBS[said?.[1]];
  if (!verb) return [];
  const words = (one.match(WORDS) ?? []).slice(2).map((word) => (CUT.test(word) ? "" : unquoted(word)));
  const args = verb.words ? verb.words(words) : words;
  if (verb.when && !verb.when(args)) return [];
  return verb.at(args).map((index) => args[index]).filter(isReference);
};

/** The physical lines a shell joins before it reads a word: the shared grammar cuts at a newline, right for where a command starts and wrong for the word this reads. A backslash escaping a backslash leaves the newline a separator, and single quotes join nothing. */
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
  const tool = toolOfCall(name);
  const found = tool ? targetsOfTool(tool, input) : spoken.flatMap(spokenTargets);
  return [...new Set(found)];
};

/* The kind and the complexity travel with the body: what a description is read against is the kind's own shape, and which rung it claims is what decides the light path. */
const filingOf = (args) =>
  (args?.action === "create" && args?.data && typeof args.data === "object"
    ? [{
      title: String(args.data.title ?? ""),
      body: String(args.data.description ?? ""),
      kind: args.data.category ?? null,
      complexity: args.data.complexity ?? null,
    }]
    : []);

/** Through a connected MCP client alone: `forge new` reads its body off a file this cannot see, and the shape a spoken filing had was a raw payload no verb takes now. */
export const filingsOf = ({ name, input }) => {
  const tool = toolOfCall(name);
  return tool === "forge_issues" ? filingOf(input) : [];
};
