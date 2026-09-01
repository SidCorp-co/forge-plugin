#!/usr/bin/env node
/* The Forge issue tracker over its own HTTP endpoint: `forge -h`. A verb whose backing tool this
   credential may not call is not listed and does not run — docs/FORGE-CLI.md. */
import { commands } from "./commands.mjs";
import { suggest } from "./suggest.mjs";
import { blockedBy, helpLine, helpOf, offeredVerbs } from "./resolve/visibility.mjs";
import { wantsHelp } from "./resolve/flags.mjs";

const offered = offeredVerbs();

const VERB_LIST = [
  `Usage: forge <${offered.map(([verb]) => verb).join("|")}> [args]`,
  "The issue tracker is the backlog; this is the way in that needs no MCP client.",
  "Credentials come from ~/.config/forge/config.json, the project slug from .forge.json, and",
  "from nowhere else. The project id is looked up from the slug, never passed.",
  "",
  ...offered.map(helpLine),
].join("\n");

/* The tracker's write-time rules, carried rather than fetched: ten lines nobody asked for. */
const PREAMBLE = [
  "",
  "Before you write:",
  "  Recall first. Project memory is not loaded for you — forge_memory.search is a call you make,",
  "    and every hit is point-in-time: verify it against live code before relying on it.",
  "  `open` dispatches the issue for work; `draft` never does. A note or a decision is not an issue",
  "    at all — write it to memory. Nobody browses the issue list for notes.",
  "  A description is a requirements contract — outcome, business rules, invariants, out-of-scope.",
  "    Not an implementation script naming files: those claims go stale and outrank live reading.",
  "  Do not pre-fill `plan` or `acceptanceCriteria`; the clarify and plan steps write them.",
  "  Ordering needs a `blocks` edge. Prose gates nothing — `forge deps` reads prose, not edges.",
  "  Attach a file rather than pasting it; nested config is replace-not-merge, so read before you",
  "    patch `pipelineConfig` or `projectFacts`.",
].join("\n");

const MORE = "\nWhat to type for one verb: `forge <verb> -h`, with the schema behind the tracker"
  + " fields it\ntakes, where it takes any. The write-time rules a first issue gets wrong:"
  + " `forge -h --full`.";

const [command, ...rest] = process.argv.slice(2);
const asked = command === "-h" || command === "--help";
const needs = command ? blockedBy(command) : null;

if (needs) {
  console.error(
    `forge ${command} needs ${needs}, which this credential may not call.\n` +
      "`forge doctor` measured that; re-run it after a credential change.",
  );
  process.exit(1);
}

/* `Object.hasOwn`: `commands.toString` is inherited and callable, so a mistyped verb naming a
   prototype member ran it and exited 0. */
if (asked || !command || !Object.hasOwn(commands, command)) {
  const close = command && !asked ? suggest(command, offered.map(([verb]) => verb)) : [];
  if (close.length) console.error(`No verb named ${command}. Did you mean: ${close.join(", ")}?\n`);
  /* An answer, not a failure: on stderr, `forge -h | head` printed nothing. */
  if (!asked) {
    console.error(VERB_LIST);
    process.exit(1);
  }
  console.log(rest.includes("--full") ? `${VERB_LIST}${PREAMBLE}` : `${VERB_LIST}${MORE}`);
  process.exit(0);
}

/* Before the verb sees it: every one but codex read `-h` as a filename, a uuid or a tool name. */
if (!commands[command].answersHelp && wantsHelp(rest)) {
  console.log(helpOf(command));
  process.exit(0);
}

/* An unhandled fetch rejection reads as a bug in this CLI rather than a network that is down. */
try {
  await commands[command](rest);
} catch (error) {
  console.error(`forge ${command} failed: ${error?.message ?? error}`);
  process.exit(1);
}
