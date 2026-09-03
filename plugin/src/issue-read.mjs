/* Whether comments were read before a write: `forge issue --full` returns none. how/issue-read-first.md */

const KEY = /\b[A-Z]{2,6}-\d+\b/g;
const READS = new Set(["list", "get"]);

/* Read off the parsed payload, never searched for: a key named twice or escaped resolves one way
   for JSON and another for a search, and one nothing can parse counts as neither, both ways. */
const payload = (text) => {
  const at = String(text ?? "").indexOf("{");
  try {
    return at < 0 ? null : JSON.parse(String(text).slice(at, String(text).lastIndexOf("}") + 1));
  } catch {
    return null;
  }
};
const readAction = (held) => READS.has((typeof held === "string" ? payload(held) : held)?.action);
/* Command position, not a mention: prose quoting the verb refused the note reporting it. Keys stay raw. */
const CLI_WRITE = /^(?:\S*\/)?forge\s+(?:comment|plan|attach)\b/u;
const CLI_CALL = /^(?:\S*\/)?forge\s+call\s+forge_(?:issues|comments)\b/u;

export function keysIn(text) {
  return [...new Set(text.match(KEY) ?? [])];
}

export function writesAnIssue({ name, input }, spoken) {
  if (/^mcp__forge__forge_(issues|comments)$/.test(name ?? "")) return !readAction(input);
  return spoken.some((one) => CLI_WRITE.test(one) || (CLI_CALL.test(one) && !readAction(payload(one))));
}

// Command position too, by the injected parser; `resume` must be given the key itself (ISS-44).
const INVOKES = /^(?:\S*\/)?forge\s+call\s+forge_comments\b/u;
const RESUMES = /^(?:\S*\/)?forge\s+resume\s+(\S+)/u;

export function readsComments(key, { name, input }, spokenOf = () => []) {
  if (/^mcp__forge__forge_comments$/.test(name ?? "")) {
    return JSON.stringify(input ?? {}).includes(key) && readAction(input);
  }
  if (!String(input?.command ?? "").includes(key)) return false;
  return spokenOf(input).some((one) =>
    (INVOKES.test(one) && one.includes(key) && readAction(payload(one))) || RESUMES.exec(one)?.[1] === key);
}

export function unreadKeys(uses, current, spokenOf) {
  const keys = keysIn(typeof current.input === "string" ? current.input : JSON.stringify(current.input ?? {}));
  return keys.filter((key) => !uses.some((use) => readsComments(key, use, spokenOf)));
}
