/* What the gates actually did. Three false refusals this session were found by watching a command
   fail, not by reading anything — a refusal left no trace at all. docs/FORGE-CLI.md. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { configDir } from "./resolve/config.mjs";
import { flags } from "./resolve/flags.mjs";

export const HOOK_LOG_PATH = join(configDir("forge"), "hook-log.jsonl");
const KEPT = 220;
const TAIL = 20;

/* A named credential flag, a header, and the shapes that are a secret on sight. An hour ago a
   Coolify token reached this session's transcript through a redaction that missed one level. */
const SECRETS = [
  [/(--?(?:token|password|api[-_]?key|secret|passwd?)[=\s]+)\S+/giu, "$1***"],
  [/(Authorization:\s*)(?:Bearer\s+)?\S+/giu, "$1***"],
  [/(Bearer\s+)\S+/giu, "$1***"],
  [/\b\d+\|[A-Za-z0-9]{30,}\b/gu, "***"],
  [/\beyJ[\w-]{10,}\.[\w-]+\.[\w-]+/gu, "***"],
  [/\b(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_]{16,}\b/gu, "***"],
];

export const scrubbed = (text) => {
  let out = String(text ?? "");
  for (const [pattern, mask] of SECRETS) out = out.replace(pattern, mask);
  return out.length > KEPT ? `${out.slice(0, KEPT)}\u2026` : out;
};

export const logHook = (record) => {
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    if (!existsSync(HOOK_LOG_PATH)) closeSync(openSync(HOOK_LOG_PATH, "a", 0o600));
    appendFileSync(HOOK_LOG_PATH, `${JSON.stringify(record)}\n`);
    return true;
  } catch {
    return false;
  }
};

export const hookEntries = () => {
  try {
    return readFileSync(HOOK_LOG_PATH, "utf8")
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const line = (one) =>
  `${one.at}  ${(one.hook ?? "?").padEnd(16)} ${(one.decision ?? "?").padEnd(5)} `
  + `${(one.tool ?? "?").padEnd(8)} ${one.target ?? ""}`;

export const hooks = (argv) => {
  const held = flags(argv, "hooks", ["--deny", "--block"]);
  let entries = hookEntries();
  if (held.hook) entries = entries.filter((one) => one.hook === held.hook);
  if (held.deny) entries = entries.filter((one) => one.decision === "deny");
  if (held.block) entries = entries.filter((one) => one.decision === "block");
  if (!entries.length) {
    return console.log(`No hook refusals logged. ${HOOK_LOG_PATH} appears on the first one.`);
  }
  const last = Number(held.last || TAIL);
  for (const one of entries.slice(-last)) console.log(line(one));
  const by = entries.reduce((seen, one) => ({ ...seen, [one.hook]: (seen[one.hook] ?? 0) + 1 }), {});
  const summary = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
  console.log(`\n${entries.length} refusal(s): ${summary}`);
};
