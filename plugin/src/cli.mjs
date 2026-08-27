#!/usr/bin/env node
/* The Forge issue tracker, reached over its own HTTP endpoint: `forge -h`.

   The tracker is the backlog, so every agent needs a way in that does not depend on an MCP client
   being connected in the session that asks. The endpoint speaks JSON-RPC over one POST. */
import { commands } from "./commands.mjs";
import { suggest } from "./suggest.mjs";

const USAGE = [
  `Usage: forge <${Object.keys(commands).join("|")}> [args]`,
  "The issue tracker is the backlog; this is the way in that needs no MCP client.",
  "Credentials come from FORGE_MCP_URL/FORGE_TOKEN/FORGE_PROJECT_SLUG or the nearest .mcp.json,",
  "and the project id is looked up from the slug, never passed.",
  "Give it English prose: the bundled `vi-natural` writes the Vietnamese the tracker gets.",
  "",
  "  issues [--status s] [--label l] [--search q] [--limit n]   the browse projection",
  "  issue <uuid|ISS-45>                            one issue, full body",
  "  new <file.md|@file|-> --title T [--status S]   create; open unless --status says",
  "  comment <uuid|ISS-45> <file.md|@file|->        post a comment",
  "  attach <issue|comment> <uuid> <file>...        upload, no base64 through context",
  "  deps [ISS-45] [--long]                         the graph the issue bodies claim",
  "  dep <blocker> <blocked> [blocks|relates]       record a dependency edge (PM-gated)",
  "  guide [slug]                                   the tracker's own guides",
  "  project                                        the resolved project id",
  "  doctor [--token t] [--url u]                   what resolves and from where; saves both",
  "  tools | schema <tool>                          the raw surface",
  "  call <tool> <'json'|@file|->                   anything not wrapped above",
].join("\n");

const [command, ...rest] = process.argv.slice(2);
const asked = command === "-h" || command === "--help";

/* `Object.hasOwn`, not truthiness: `commands.toString` is inherited and callable, so a mistyped
   verb that happens to name a prototype member ran it and exited 0 with no output. */
if (asked || !command || !Object.hasOwn(commands, command)) {
  const close = command && !asked ? suggest(command, Object.keys(commands)) : [];
  if (close.length) console.error(`No verb named ${command}. Did you mean: ${close.join(", ")}?\n`);
  console.error(USAGE);
  process.exit(asked ? 0 : 1);
}

/* A DNS failure or a dropped socket rejects out of fetch, and an unhandled rejection prints a
   stack trace that reads as a bug in this CLI rather than a network that is down. */
try {
  await commands[command](rest);
} catch (error) {
  console.error(`forge ${command} failed: ${error?.message ?? error}`);
  process.exit(1);
}
