/* Whether comments were read before a write: `forge issue --full` returns none. how/issue-read-first.md */

const KEY = /\b[A-Z]{2,6}-\d+\b/g;
const READ_ACTIONS = /"action"\s*:\s*"(list|get)"/;
/* Command position, not a mention: prose quoting the verb refused the note reporting it. Keys stay raw. */
const CLI_WRITE = /^(?:\S*\/)?forge\s+(?:comment|plan|attach)\b/u;
const CLI_CALL = /^(?:\S*\/)?forge\s+call\s+forge_(?:issues|comments)\b/u;

export function keysIn(text) {
  return [...new Set(text.match(KEY) ?? [])];
}

export function writesAnIssue({ name, input }, spoken) {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? {});
  if (/^mcp__forge__forge_(issues|comments)$/.test(name ?? "")) return !READ_ACTIONS.test(text);
  return spoken.some((one) => CLI_WRITE.test(one) || (CLI_CALL.test(one) && !READ_ACTIONS.test(one)));
}

// The key and the call must be ONE invocation: a grep for either that names the other satisfied it.
const INVOKES = /\bforge\s+call\s+forge_comments\b/;

export function readsComments(key, { name, input }) {
  if (/^mcp__forge__forge_comments$/.test(name ?? "")) {
    return JSON.stringify(input ?? {}).includes(key);
  }
  return String(input?.command ?? "")
    .split("\n")
    .some((line) => INVOKES.test(line) && line.includes(key));
}

export function unreadKeys(uses, current) {
  const keys = keysIn(typeof current.input === "string" ? current.input : JSON.stringify(current.input ?? {}));
  return keys.filter((key) => !uses.some((use) => readsComments(key, use)));
}
