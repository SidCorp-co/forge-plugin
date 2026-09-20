/* The credential mask on its own. It is what writing one refusal line needs, and the verb beside it
   — the reader, the switch, the suggester — is what writing one does not, which is the whole reason
   these two are not one module (ISS-1904). Which shapes count as a credential, and why over-masking
   is the safe direction: docs/cli/the-refusal-log.md. */

const KEPT = 220;

/* A named credential flag, a header, and the shapes that are a secret on sight. A value goes whole, quotes and spaces included: masking to the next space leaves most of a passphrase in a log printed back into a session. */
const VALUE = String.raw`("[^"]*"|'[^']*'|\S+)`;

/* One list read by both the flag pattern and the assignment pattern below. They held separate lists
   that disagreed — the assignment one trusted a bare `key`, the flag one did not — so this CLI's own
   documented `forge doctor --codex-key <key>` travelled where `CODEX_KEY=<key>` did not, and nothing
   compared the two (ISS-2015). Over-masking is the safe direction, which is what admits bare `key`. */
const NAMES = String.raw`\w*(?:token|password|passwd?|secret|api[-_]?key|key)\w*`;

const SECRETS = [
  [new RegExp(String.raw`(--?${NAMES}[=\s]+)${VALUE}`, "giu"), "$1***"],
  [/(Authorization:\s*)(?:Bearer\s+)?\S+/giu, "$1***"],
  [/(Bearer\s+)\S+/giu, "$1***"],
  [/\b\d+\|[A-Za-z0-9]{30,}\b/gu, "***"],
  [/\beyJ[\w-]{10,}\.[\w-]+\.[\w-]+/gu, "***"],
  /* A hyphen after the prefix is part of the shape rather than the end of it: a live key is written
     `sk-live-…` and `sk-proj-…` as often as `sk-…`, and the run that read this pattern for its own
     purposes found the first two were secrets on sight to nobody (ISS-2015). */
  [/\b(?:sk|ghp|gho|github_pat)[-_](?:[A-Za-z0-9_]+-)*[A-Za-z0-9_]{16,}\b/gu, "***"],
  /* Named rather than shaped: a value no pattern knows is still a secret when the name beside it says so, and over-masking is the safe direction. */
  [new RegExp(String.raw`\b(${NAMES}\s*=\s*)${VALUE}`, "giu"), "$1***"],
  [/([a-z][\w+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/giu, "$1***@"],
  [/("(?:password|token|secret|api[-_]?key)"\s*:\s*")[^"]*/giu, "$1***"],
];

/* The masking without the clip: a consult reply is an eval set, not a refusal line (codex-log.mjs). */
export const masked = (text) => {
  let out = String(text ?? "");
  for (const [pattern, mask] of SECRETS) out = out.replace(pattern, mask);
  return out;
};

export const scrubbed = (text) => {
  const out = masked(text);
  return out.length > KEPT ? `${out.slice(0, KEPT)}\u2026` : out;
};

