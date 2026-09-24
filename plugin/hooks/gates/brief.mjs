// Refuse a dispatch to one of this plugin's roles whose message `forge brief` did not print: a typed
// brief is where a dispatcher's method reached a run. how/brief.md says why.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deny, how } from "../_hook.mjs";
import { FRESH_MS, generatedFor } from "../../src/brief/record.mjs";
import { PLUGIN_ROOT } from "../../src/tools/plugin-copy.mjs";

const DISPATCHES = new Set(["Agent", "Task"]);
const KEY = /\b[A-Z][A-Z0-9]*-\d+\b/u;

/* The prefix a role of this plugin carries is its name, read off the copy that is running. */
const rolePrefix = () => {
  try {
    const { name } = JSON.parse(readFileSync(join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8"));
    return name ? `${name}:` : null;
  } catch {
    return null;
  }
};

export const run = (ev) => {
  if (!DISPATCHES.has(ev.tool_name ?? "")) return;
  const role = String(ev.tool_input?.subagent_type ?? "");
  const prefix = rolePrefix();
  if (!prefix || !role.startsWith(prefix)) return;
  const prompt = String(ev.tool_input?.prompt ?? "");
  if (generatedFor(ev.session_id, prompt)) return;
  const key = KEY.exec(prompt)?.[0] ?? "ISS-nn";
  deny(
    `Hold — run \`forge brief ${key} --tree <its worktree>\` (no --tree for a run given none) and `
      + "send what it prints as the prompt, unchanged.\n\n"
      + `This message to \`${role}\` is not one \`forge brief\` printed in the last `
      + `${FRESH_MS / 60_000} minutes, so whatever was typed around the readings reaches the run as `
      + "if it were the method."
      + how(),
  );
};
