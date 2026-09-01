/* Whether an issue's comments have been read before something is written to it. `forge issue --full`
   carries no comments at all, so the obvious read leaves the state unread. hooks/how/issue-read-first.md */

const KEY = /\b[A-Z]{2,6}-\d+\b/g;
const READ_ACTIONS = /"action"\s*:\s*"(list|get)"/;
const CLI_WRITE = /\bforge\s+(comment|plan|attach)\b/;
const CLI_CALL = /\bforge\s+call\s+forge_(issues|comments)\b/;

export function keysIn(text) {
  return [...new Set(text.match(KEY) ?? [])];
}

export function writesAnIssue({ name, input }) {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? {});
  if (/^mcp__forge__forge_(issues|comments)$/.test(name ?? "")) return !READ_ACTIONS.test(text);
  const command = (input?.command ?? "") + "";
  if (CLI_WRITE.test(command)) return true;
  return CLI_CALL.test(command) && !READ_ACTIONS.test(command);
}

// The key and the call have to be the SAME invocation. A search for both anywhere in the command
// is satisfied by a grep for one that mentions the other — including this gate's own diagnostics.
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
