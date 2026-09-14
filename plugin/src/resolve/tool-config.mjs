/* Whether this machine holds the local configuration a harness tool needs to run at all, which is not
   `visibility.mjs`'s gate: that one replays what the server said this CREDENTIAL may spend. One row per tool and
   one answer, read by the help's filter, `forge doctor`'s rows, the served guides' conditions and the verb's own
   refusal. What puts a tool in the table: docs/cli/an-unconfigured-tool.md. */
import { chatgptSettings } from "./settings.mjs";
import { configPath, userConfig } from "./config.mjs";
import { coolifyTarget } from "../tools/services/coolify/config.mjs";
import { profile } from "../codex/codex-profile.mjs";

export const CONFIGURED = "configured";
export const UNCONFIGURED = "unconfigured";
export const TOOL_STATES = [CONFIGURED, UNCONFIGURED];

export const CLOUDFLARE_LOGIN =
  "forge cloudflare login --name <label> --account-id <id> --token <api-token>";

export const NO_ACCOUNT = `No Cloudflare account is configured. Save one with\n  ${CLOUDFLARE_LOGIN}`;

export const cloudflareAccounts = () => {
  const held = (userConfig().cloudflare?.accounts ?? []).filter((one) => one.apiToken && one.accountId);
  return { from: held.length ? configPath() : null, accounts: held };
};

const TOOLS = [
  { verb: "cloudflare",
    held: () => cloudflareAccounts().accounts.length > 0,
    configure: `\`${CLOUDFLARE_LOGIN}\`` },
  { verb: "coolify",
    held: () => Boolean(coolifyTarget().url),
    configure: "`forge coolify login --url <url> --token <token>`" },
  { verb: "codex",
    held: () => !profile().problem,
    configure: "a gateway profile carrying ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN, at"
      + " `CLAUDE_PROXY_ENV` or at ~/.claude/claude-proxy.env" },
  { verb: "chatgpt",
    held: () => chatgptSettings().missing.length === 0,
    configure: "`forge doctor --chatgpt-url <endpoint> --chatgpt-key <key>`" },
];

export const CONFIGURABLE = TOOLS.map(({ verb }) => verb);

const rowFor = (verb) => TOOLS.find((one) => one.verb === verb);

/* A reader that THROWS answers unconfigured: `forge -h` asks this before it dispatches, so a directory named in
   `CLAUDE_PROXY_ENV` would otherwise take every verb of this CLI down. The verb typed still reaches it and throws. */
export const toolState = (verb) => {
  const row = rowFor(verb);
  if (!row) return null;
  try {
    return row.held() ? CONFIGURED : UNCONFIGURED;
  } catch {
    return UNCONFIGURED;
  }
};

export const unconfiguredTool = (verb) => toolState(verb) === UNCONFIGURED;

export const configureSaid = (verb) => rowFor(verb)?.configure ?? null;

export const toolConditions = () =>
  Object.fromEntries(TOOLS.map(({ verb }) =>
    [`tool.${verb}`, { value: toolState(verb), allowed: TOOL_STATES }]));
