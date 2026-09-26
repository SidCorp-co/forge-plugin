/* Whether this machine holds the local configuration a harness tool needs to run at all, which is not
   `visibility.mjs`'s gate: that one replays what the server said this CREDENTIAL may spend. One row per tool and
   one answer, read by the help's filter, `forge doctor`'s rows, the served guides' conditions and the verb's own
   refusal. What puts a tool in the table: docs/cli/an-unconfigured-tool.md. */
import { configSource, userConfig } from "../../resolve/config.mjs";
import { gateway, storeHeld, storeMissing } from "../../resolve/machine/stores.mjs";
import { coolifyTarget } from "./coolify/config.mjs";
import { onTracker } from "./coolify/chosen-route.mjs";
import { googleHeld } from "./google/auth/configured.mjs";


const CONFIGURED = "configured";
export const UNCONFIGURED = "unconfigured";
export const TOOL_STATES = [CONFIGURED, UNCONFIGURED];

const CLOUDFLARE_LOGIN =
  "forge cloudflare login --name <label> --account-id <id> --token <api-token>";

export const NO_ACCOUNT = `No Cloudflare account is configured. Save one with\n  ${CLOUDFLARE_LOGIN}`;

export const cloudflareAccounts = () => {
  const held = (userConfig().cloudflare?.accounts ?? []).filter((one) => one.apiToken && one.accountId);
  return { from: held.length ? configSource("cloudflare.accounts") : null, accounts: held };
};

const TOOLS = [
  { verb: "cloudflare",
    held: () => cloudflareAccounts().accounts.length > 0,
    absent: () => "no account",
    configure: `\`${CLOUDFLARE_LOGIN}\`` },
  /* Held where the tracker is the route that answers, that one asking this machine for nothing it
     has not already got: the credential is the instance route's alone, so it is what gates it. */
  { verb: "coolify",
    held: () => onTracker() || Boolean(coolifyTarget().url),
    absent: () => "no instance, and this machine has chosen the instance route",
    configure: "`forge coolify login --url <url> --token <token>`, or `forge doctor"
      + " --coolify-route tracker` for the route that needs neither" },
  /* Any of the three routes holds it, the environment's token among them: that one is a CI run's whole credential. */
  { verb: "google",
    held: googleHeld,
    absent: () => "no Google account saved and no FORGE_GOOGLE_ACCESS_TOKEN",
    configure: "`forge google auth add <key.json>`, or `forge google auth login --client-secret <file> -s <services>`" },
  { verb: "codex",
    held: () => !gateway().problem,
    absent: () => gateway().problem,
    configure: "`forge doctor --codex-url <endpoint> --codex-key <key>`, which the gateway profile"
      + " answers for where neither key is set" },
  { verb: "chatgpt",
    held: () => storeHeld("chatgpt"),
    absent: () => storeMissing("chatgpt").map((one) => `no ${one.asks}`).join(" and "),
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

const toolState = (verb) => {
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
