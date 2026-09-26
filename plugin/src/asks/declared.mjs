/* What a question says about itself before anything judges it: whether the session declared how its
   answer is undone, and whether it names a subject that is the owner's whatever it declares. The
   words are a check against a false declaration and never a reason to decide.
   plugin/hooks/how/ask-decide.md. */
import { escaped } from "../markdown.mjs";

/* The tool's schema strips any key it does not declare before a hook sees the call, so the
   declaration rides the one field the owner also reads: the question's own last words. */
export const DECLARED = /\[reversible:\s*([^\]\n]*[^\]\s])\s*\]\s*$/u;

/** How one question says it is undone, or null where it says nothing. */
export const reversalOf = (question) => DECLARED.exec(String(question?.question ?? ""))?.[1] ?? null;

/** The one line a session is told about the form, spelt once for the gate and its page. */
export const DECLARE_FORM = "[reversible: <the one command or correction that undoes the choice>]";

const words = (list) => new RegExp(String.raw`\b(?:${list.join("|")})\b`, "iu");

/* Six subjects whose answer is the owner's input. The first five are the issue's; the sixth is what
   the owner's own overrides held that none of the five reached — a transport, a command's shape. */
export const OWNER_CATEGORIES = [
  {
    name: "a secret or credential",
    pattern: new RegExp(String.raw`\b(?:secrets?|credentials?|passwords?|passphrases?|tokens?|api[- ]?keys?|`
      + String.raw`(?:private|ssh|access|signing|license|gateway|provider|service)[- ]keys?|reveal|oauth|pat|`
      + String.raw`paste (?:it|the \S+)|env(?:ironment)? var(?:iable)?s?)\b|\b(?:the|a|your|its|my)\s+`
      + String.raw`(?!(?:issue|project|config|configuration|setting|settings|sort|primary|foreign|cache|map|lookup|`
      + String.raw`json|object|dictionary|record|table|same|one|first|last|next)\b)[\w.-]+\s+keys?\b`, "iu"),
  },
  {
    name: "spend",
    pattern: new RegExp(String.raw`\b(?:money|pay|paid|payment|billing|billed|invoice|purchase|buy|`
      + String.raw`subscription|price|pricing|credit card|dollars?|usd|vnd|đồng)\b|\$\s?\d`, "iu"),
  },
  {
    name: "a production or outward-facing write",
    pattern: words(["production", "prod", "live (?:site|domain|domains|server|servers|users?|traffic|zones?)",
      "deploy(?:s|ed|ing|ment)?", "releases?", "publish(?:es|ed|ing)?", "go live", "customers?", "e-?mails?",
      "announce(?:ment)?", "public", "dns", "domains?", "force[- ]push", "push(?:es|ed)? to (?:origin|main|master|remote)"]),
  },
  {
    name: "discarding work the owner holds",
    pattern: words(["discard(?:s|ed|ing)?", "delet(?:e|es|ed|ing)", "remov(?:e|es|ed|ing)", "drop(?:s|ped|ping)?",
      "reset", "revert(?:s|ed|ing)?", "overwrit(?:e|es|ing|ten)", "stash(?:es|ed)?", "wipe", "purge", "prune",
      "throw away", "uncommitted", "unstaged", "dirty", "modifications?", "your (?:changes|work|edits|files)"]),
  },
  {
    name: "filing or dropping product work",
    pattern: words(["file(?:d|s)? (?:it|them|an? issues?|issues?)", "filing", "backlog", "tickets?",
      String.raw`(?:file|open|create|split|close|drop|park|merge|fold|reopen)\w*\b[^.?\n]{0,40}\bissues?`,
      String.raw`(?:one|two|three|four|nine|\d+|separate|own|single|grouped|several) issues?`,
      "split(?:ting)?", "close (?:it|them|the issue)", "park(?:ed|ing)?", "fold (?:it|them) into", "scope"]),
  },
  {
    name: "a contract others build against",
    pattern: words(["wire", "protocol", "transport", "sse", "websockets?", "stream(?:s|ing)?", "api", "endpoints?",
      "schema", "(?:wire|data|file|output|payload) formats?", "bin", "binar(?:y|ies)", "subcommands?", "verbs?", "cli", "packages?", "boundar(?:y|ies)",
      "renam(?:e|ed|ing)"]),
  },
];

/** The project's own terms, each a whole word or phrase and never a pattern: an entry that fails to
 *  compile or matches everything is not a category a project meant to add. */
export const ownerCategories = (terms = []) => [
  ...OWNER_CATEGORIES,
  ...terms.filter((term) => String(term).trim()).map((term) => ({ name: `\`${term}\` (asks.owner)`, pattern: new RegExp(String.raw`(?<![\w-])${escaped(term)}(?![\w-])`, "iu") })),
];

/* Everything a question puts in front of the owner, the declaration itself excepted: a reversal
   naming `git revert` is how the session says it is undone, not a subject. */
const textOf = (question) => [
  String(question?.question ?? "").replace(DECLARED, ""),
  question?.header,
  ...(Array.isArray(question?.options) ? question.options.flatMap((one) => [one?.label, one?.description]) : []),
].filter((one) => typeof one === "string").join("\n");

/** The owner categories one question names, by name; empty where it names none. */
export const namedCategories = (question, categories = OWNER_CATEGORIES) => {
  const text = textOf(question);
  return categories.filter((one) => one.pattern.test(text)).map((one) => one.name);
};

/** Why a question is the owner's before any precedent is read, or null where it may be judged. */
export const ownersBefore = (question, categories = OWNER_CATEGORIES) => {
  if (!reversalOf(question)) return "it declares no reversal";
  if (!Array.isArray(question?.options) || question.options.length < 2) return "it offers no options to choose between";
  const named = namedCategories(question, categories);
  return named.length ? `it names ${named.join(", ")}` : null;
};
