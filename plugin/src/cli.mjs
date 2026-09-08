#!/usr/bin/env node
/* The Forge issue tracker over its own HTTP endpoint: `forge -h`. A verb whose backing tool this
   credential may not call is not listed and does not run — docs/cli/withholding-a-verb.md. */
import { commands } from "./commands.mjs";
import { didYouMean } from "./suggest.mjs";
import { blockedBy, channelRefusal, grouped, helpLine, helpOf, offeredVerbs, verbForPluginDefect }
  from "./resolve/visibility.mjs";
import { wantsHelp } from "./resolve/flags.mjs";
import { retiredRefusal } from "./resolve/retiring.mjs";
import { fail } from "./resolve/settings.mjs";

const offered = offeredVerbs();

const VERB_LIST = [
  `Usage: forge <${offered.map(([verb]) => verb).join("|")}> [args]`,
  "The issue tracker is the backlog; this is the way in that needs no MCP client.",
  "What resolves for this call and from where — the credential, the project, this machine's",
  "settings: `forge doctor`.",
  ...grouped(offered).flatMap(([group, rows]) => ["", `${group}`, ...rows.map(helpLine)]),
].join("\n");

/* The write-time rules this CLI itself refuses without, carried rather than fetched: ten lines
   nobody asked for. They were the tracker's runner's until ISS-66 — src/guides/guides.mjs. */
const PREAMBLE = [
  "",
  "Before you write:",
  "  A description is a requirements contract — an outcome, a rule or an invariant, an out-of-scope,",
  "    read by heading, and one section more for the kind the filing names, which `forge new -h`",
  "    lists. `forge new` refuses a body missing a required one, and a title saying only what was",
  "    done to a file; `forge hooks --how issue-shape` has the three routes a small change takes.",
  "  A status is earned, not set. Each costs the payload the contract names, `forge advance --owed`",
  "    says which, and a jump is refused. Take the lease before the first write — `forge claim`.",
  "  You write the plan and the criteria yourself, at `approved`, through `forge record plan` and",
  "    `forge record criteria`. Nothing here dispatches an issue or fills a field on your behalf.",
  "  Nothing landing is `dropped`. `closed` stamps the merged mark and releases every issue blocked",
  "    on this one, so it is what code that landed earns and nothing else.",
  "  Ordering needs a `blocks` edge — `forge issue ISS-45 --blocks ISS-46` writes one. Prose gates",
  "    nothing, and `forge next --graph` prints what only prose claims under a heading of its own.",
  "  Attach a file rather than pasting it; nested config is replace-not-merge, so read before you",
  "    patch `pipelineConfig` or `projectFacts`.",
  "  `forge guide` lists the tracker's guides this flow stands behind, and `forge guide contract` is",
  "    this plugin's own, one part per call, which is what holds where it and a guide disagree.",
].join("\n");

const MORE = "\nWhat to type for one verb: `forge <verb> -h`, with the schema behind the tracker"
  + " fields it\ntakes, where it takes any. The write-time rules a first issue gets wrong:"
  + " `forge -h --full`.";

/* Silent where the project withholds the channel: the footer is the sentence that outlives a verb. */
const named = verbForPluginDefect();
const FEEDBACK = named
  ? `\nFeedback on this CLI, from any project: \`forge ${named} <note.md> --title "<one`
    + ' line>"`, which files it on this plugin\'s own project wherever you are standing. A wrong'
    + " refusal, a missing way out, a verb that surprised you: send it there, before the workaround."
  : "";

const [command, ...rest] = process.argv.slice(2);
const asked = wantsHelp([command]);

/* Before the help word: a retired verb's `-h` is the same question, and gets the same line. */
const retired = command ? retiredRefusal(command) : null;

if (retired) {
  console.error(retired);
  process.exit(1);
}

const closed = command ? channelRefusal(command) : null;

if (closed) {
  console.error(closed);
  process.exit(1);
}

const needs = command ? blockedBy(command) : null;

if (needs) {
  console.error(`forge ${command} needs ${needs}, which this credential may not call.\n`
    + "`forge doctor` measured that; re-run it after a credential change.");
  process.exit(1);
}

/* `Object.hasOwn`: `commands.toString` is inherited and callable, so a mistyped verb naming a
   prototype member ran it and exited 0. */
if (asked || !command || !Object.hasOwn(commands, command)) {
  if (command && !asked) {
    console.error(`${didYouMean("verb", command, offered.map(([verb]) => verb))}\n`);
  }
  /* An answer, not a failure: on stderr, `forge -h | head` printed nothing. */
  if (!asked) {
    console.error(VERB_LIST);
    process.exit(1);
  }
  console.log((rest.includes("--full") ? `${VERB_LIST}${PREAMBLE}` : `${VERB_LIST}${MORE}`) + FEEDBACK);
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
  /* Through `fail`, so a verb holding a payload nothing else holds gets it printed on a throw too. */
  fail(`forge ${command} failed: ${error?.message ?? error}`);
}
