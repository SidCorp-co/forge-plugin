/* The gateway profile the external shim owns, and which model it resolves a slot to. Apart from the call
   that spends it, because a hook reaching `../resolve/tool-config.mjs` may not pay for an HTTP client to
   learn whether there is a gateway at all. docs/cli/an-unconfigured-tool.md. */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { userConfig } from "../resolve/config.mjs";

export const profilePath = () =>
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
