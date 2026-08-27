#!/usr/bin/env node
/* The Forge issue tracker, reached over its own HTTP endpoint: `forge -h`.

   The tracker is the backlog, so every agent needs a way in that does not depend on an MCP client
   being connected in the session that asks. The endpoint speaks JSON-RPC over one POST.

   A verb whose backing tool this credential may not call is not listed and does not run. A
   capability an agent cannot use is not information — it is an invitation to a failure two calls
   from here. `forge doctor` measures which those are; `--all` is how a human looks past it. */
import { commands, gatedTools } from "./commands.mjs";
import { suggest } from "./suggest.mjs";

const VERBS = [
  ["issues", "issues [--status s] [--search q] [--limit n]   the browse projection"],
  ["issue", "issue <uuid|ISS-45>                            one issue, full body"],
  ["new", "new <file.md|@file|-> --title T [--status S]   create; open unless --status says"],
  ["comment", "comment <uuid|ISS-45> <file.md|@file|->        post a comment"],
  ["attach", "attach <issue|comment> <uuid> <file>...        upload, no base64 through context"],
  ["deps", "deps [ISS-45] [--long]                         the graph the issue bodies claim"],
  ["dep", "dep <blocker> <blocked> [kind]                 record a dependency edge", "forge_project_pm"],
  ["guide", "guide [slug]                                   the tracker's own guides", "forge_guide"],
  ["project", "project                                        the resolved project id"],
  ["doctor", "doctor [--token t] [--url u]                   what resolves and from where"],
  ["tools", "tools [--all] | schema <tool>                  the reachable surface"],
  ["call", "call <tool> <'json'|@file|->                   anything not wrapped above"],
];

const withheld = gatedTools();
const offered = VERBS.filter(([, , needs]) => !needs || !withheld.has(needs));

const USAGE = [
  `Usage: forge <${offered.map(([verb]) => verb).join("|")}> [args]`,
  "The issue tracker is the backlog; this is the way in that needs no MCP client.",
  "Credentials come from FORGE_MCP_URL/FORGE_TOKEN or the nearest .mcp.json; the project slug",
  "from FORGE_PROJECT_SLUG or .forge.json. The project id is looked up, never passed.",
  "",
  ...offered.map(([, line]) => `  ${line}`),
].join("\n");

const [command, ...rest] = process.argv.slice(2);
const asked = command === "-h" || command === "--help";
const hidden = VERBS.find(([verb, , needs]) => verb === command && needs && withheld.has(needs));

if (hidden) {
  console.error(
    `forge ${command} needs ${hidden[2]}, which this credential may not call.\n` +
      "`forge doctor` measured that; re-run it after a credential change.",
  );
  process.exit(1);
}

/* `Object.hasOwn`, not truthiness: `commands.toString` is inherited and callable, so a mistyped
   verb that happens to name a prototype member ran it and exited 0 with no output. */
if (asked || !command || !Object.hasOwn(commands, command)) {
  const close = command && !asked ? suggest(command, offered.map(([verb]) => verb)) : [];
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
