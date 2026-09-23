/* The gateway profile: an env file the shim outside this repository owns and Claude Code consumes as
   environment, so this reads it and nothing here writes it — its model slots decide which model a
   subagent's frontmatter spawns on. Its grammar is its own, which is why it sits apart from the table
   that treats it as one store's fallback. docs/cli/settings.md. */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";


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

export const profileValues = () => {
  const path = profilePath();
  try {
    return { path, values: profileFrom(readFileSync(path, "utf8")) };
  } catch {
    return { path, values: null };
  }
};
