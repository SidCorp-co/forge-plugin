/* Whether this machine holds the local configuration a harness tool needs to run at all, which is not
   `visibility.mjs`'s gate: that one replays what the server said this CREDENTIAL may spend. One row per tool and
   one answer, read by the help's filter, `forge doctor`'s rows, the served guides' conditions and the verb's own
   refusal. What puts a tool in the table: docs/cli/an-unconfigured-tool.md. */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chatgptSettings } from "../../resolve/settings.mjs";
import { configPath, userConfig } from "../../resolve/config.mjs";
import { coolifyTarget } from "./coolify/config.mjs";


const profilePath = () =>
  process.env.CLAUDE_PROXY_ENV || join(homedir(), ".claude", "claude-proxy.env");

const ENV_LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

const unquoted = (raw) => {
  const value = raw.trim();
  const quote = value[0];
  const paired = (quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1;
  return paired ? value.slice(1, -1) : value;
};

export const profileFrom = (text) => {
  const found = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const matched = ENV_LINE.exec(line);
    if (matched) found[matched[1]] = unquoted(matched[2]);
  }
  return found;
};

export const profile = () => {
  const path = profilePath();
  if (!existsSync(path)) return { path, problem: `no gateway profile at ${path}` };
  const values = profileFrom(readFileSync(path, "utf8"));
  for (const key of ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"]) {
    if (!values[key]) return { path, problem: `${key} is missing from ${path}`, values };
  }
  return { path, values };
};

/* The slot is the account's and the rung table sits in front of it; with none this slot answers every level.
   The profile decides which model that slot is, which is the whole reason this is a second opinion not an echo. */
export const modelSlot = () => userConfig().codex?.model || "fable";

export const modelBehind = (values, slot = modelSlot()) =>
  values?.[`ANTHROPIC_DEFAULT_${slot.toUpperCase()}_MODEL`] ?? null;

export const CONFIGURED = "configured";
export const UNCONFIGURED = "unconfigured";
export const TOOL_STATES = [CONFIGURED, UNCONFIGURED];

const CLOUDFLARE_LOGIN =
  "forge cloudflare login --name <label> --account-id <id> --token <api-token>";

export const NO_ACCOUNT = `No Cloudflare account is configured. Save one with\n  ${CLOUDFLARE_LOGIN}`;

export const cloudflareAccounts = () => {
  const held = (userConfig().cloudflare?.accounts ?? []).filter((one) => one.apiToken && one.accountId);
  return { from: held.length ? configPath() : null, accounts: held };
};

const TOOLS = [
  { verb: "cloudflare",
    held: () => cloudflareAccounts().accounts.length > 0,
    absent: () => "no account",
    configure: `\`${CLOUDFLARE_LOGIN}\`` },
  { verb: "coolify",
    held: () => Boolean(coolifyTarget().url),
    absent: () => "no instance",
    configure: "`forge coolify login --url <url> --token <token>`" },
  { verb: "codex",
    held: () => !profile().problem,
    absent: () => profile().problem,
    configure: "one carrying ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN, at `CLAUDE_PROXY_ENV`"
      + " or at ~/.claude/claude-proxy.env" },
  { verb: "chatgpt",
    held: () => chatgptSettings().missing.length === 0,
    configure: "`forge doctor --chatgpt-url <endpoint> --chatgpt-key <key>`" },
];

export const CONFIGURABLE = TOOLS.map(({ verb }) => verb);

const rowFor = (verb) => TOOLS.find((one) => one.verb === verb);

/* Every read of a row goes through here, because `forge -h` asks before it dispatches and `forge doctor` is the one
   surface left to explain itself: a directory named in `CLAUDE_PROXY_ENV` would otherwise take the whole CLI down,
   and a guard on one of the two readings leaves the report throwing where the help survived. The verb typed still
   reaches the same file and still fails its own way. */
const tried = (read, fallback) => {
  try {
    return read();
  } catch {
    return fallback;
  }
};

export const toolState = (verb) => {
  const row = rowFor(verb);
  if (!row) return null;
  return tried(row.held, false) ? CONFIGURED : UNCONFIGURED;
};

export const unconfiguredTool = (verb) => toolState(verb) === UNCONFIGURED;

export const configureSaid = (verb) => rowFor(verb)?.configure ?? null;

export const absentSaid = (verb) => {
  const row = rowFor(verb);
  return row?.absent ? tried(row.absent, "nothing this machine could read") : null;
};

export const toolConditions = () =>
  Object.fromEntries(TOOLS.map(({ verb }) =>
    [`tool.${verb}`, { value: toolState(verb), allowed: TOOL_STATES }]));
