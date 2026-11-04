/* The `env` group of the tracker route: `list`, `set KEY` and `delete KEY` over core's ISS-827 env
   door. A group rather than a generic row because the name takes a positional KEY the dispatcher has
   no slot for, and because `set`'s value is read from stdin or a file and never from argv, where it
   would land in a shell history. Everything else is the route table's — the request, the consent
   read off `writes`, the --dry-run preview and the rendering — so this module adds only the two
   shapes that generic dispatch cannot carry. docs/cli/coolify.md (ISS-47). */
import { readFileSync } from "node:fs";

import { fail } from "../../../../resolve/settings.mjs";
import { flags, partition, firstLine } from "../../../../resolve/flags.mjs";
import { HELP_WORDS } from "../../../../resolve/help-word.mjs";
import { PAYLOAD_MS, stdinText } from "../../../../resolve/payload.mjs";
import { didYouMean } from "../../../../suggest.mjs";
import { callTool } from "../../../../tracker/rest.mjs";
import { rowFor } from "../../../../tracker/routes.mjs";
import { keysOf, rendered, wrapper } from "../shape.mjs";
import { ENV_USAGE, TRACKER_GROUPS, TRACKER_SCOPE, consentRefusal, trackerRouteLines } from "../chosen-route.mjs";

const VERB = "coolify env";
/* The one declaration of what this group answers to, off the row the usage and the verb's ownership
   are also read from, so a fourth action is added in one place (ISS-47). */
const ACTIONS = TRACKER_GROUPS.find((group) => group.name === "env").actions;
const SWITCHES = ["--redeploy", "--yes", "--dry-run", "--json", "--table"];
const AIMED = "<projectId>";

/* What core answers a value as, kept here so the --dry-run of a write prints the same placeholder a
   read comes back carrying: the value a write sends is never printed, in a preview or an answer. */
const ENV_MASK = "********";

/* The envelope core may wrap the listing in; a raw array answers through the same renderer. */
const ENV_LISTING = ["data", "env", "envs", "variables", "items"];
const bodyOf = (answer) => {
  const named = wrapper(answer, ENV_LISTING);
  return named ? answer[named] : answer;
};

/* The two routes a value reaches `set` by, printed whenever one is reached wrong: a value on the
   command line or a --value flag that does not exist, both because either would land in a shell
   history. `what` names which of the two the caller tried. */
const PIPE_IN = `  pipe it in:             printf %s "<the value>" | forge ${VERB} set KEY --yes`;
const FROM_FILE = `  or read it from a file: forge ${VERB} set KEY --value-file ./value --yes`;
const historyRefusal = (what) =>
  fail(`${VERB} set: ${what}, where it would land in your shell history, so the value is read from `
    + `stdin or a file and never from argv.\n${PIPE_IN}\n${FROM_FILE}`);

/* A value's own trailing newline is the one `echo` adds and no part of the value: a single one is
   dropped so a piped secret is not stored a byte longer than it is. An empty read is refused, a
   value nobody fed being the mistake far likelier than one meant to be blank. */
const valueOf = async (given) => {
  const raw = given["value-file"] !== undefined
    ? readFileSync(given["value-file"], "utf8")
    : (await stdinText(process.stdin, PAYLOAD_MS)) ?? "";
  const held = raw.replace(/\r?\n$/u, "");
  if (!held) {
    fail(`${VERB} set: no value was read from ${given["value-file"] !== undefined
      ? `\`${given["value-file"]}\``
      : "stdin"}, and a variable is not set to nothing here.\n${PIPE_IN}\n${FROM_FILE}`);
  }
  return held;
};

const selectors = (given) => ({
  ...(given.integration !== undefined ? { integrationId: given.integration } : {}),
  ...(given.resource !== undefined ? { resourceUuid: given.resource } : {}),
});

/* Off the row that would make the request, never a second description of it, and the value struck
   before it is printed: a preview that showed what a write would send would put the secret in the
   output the --dry-run exists to make safe. */
const preview = (key, args) => {
  const { page } = rowFor(key, args).requests(args, AIMED);
  console.log(`${page.method ?? "GET"} /api${page.path}`);
  if (page.body) {
    const shown = Object.hasOwn(page.body, "value") ? { ...page.body, value: ENV_MASK } : page.body;
    console.log(JSON.stringify(shown, null, 2));
  }
};

const show = (name, answered, given) => {
  const asTable = given.table || (process.stdout.isTTY && !given.json);
  const body = bodyOf(answered);
  console.log(rendered(body, asTable, keysOf));
  if (Array.isArray(body) && !body.length) {
    console.error([`${VERB} ${name}: the tracker route answered with nothing.`, ...trackerRouteLines()].join("\n"));
  }
};

/** One subcommand of the env group, end to end. Its refusals are plain `fail()`s, so the route-line
 *  footer `overTracker` registered attaches to each the way it does to every other refusal here. */
export const runEnv = async (argv) => {
  if (argv.some((one) => HELP_WORDS.includes(one))) {
    console.log(ENV_USAGE);
    return;
  }
  const value = argv.find((one) => one === "--value" || one.startsWith("--value="));
  if (value) historyRefusal("there is no --value flag");
  const { positionals, flagArgv } = partition(argv, SWITCHES, { verb: VERB, usage: ENV_USAGE });
  const [action, ...more] = positionals;
  if (action === undefined) fail(ENV_USAGE);
  if (!ACTIONS.includes(action)) fail(`${VERB}: ${didYouMean("subcommand", action, ACTIONS)}\n${firstLine(ENV_USAGE)}`);
  const given = flags(flagArgv, `${VERB} ${action}`, SWITCHES, { usage: ENV_USAGE });

  if (action === "list") {
    if (more.length) fail(`${VERB} list: it takes no KEY, and \`${more[0]}\` is one.\n${firstLine(ENV_USAGE)}`);
    show("list", await callTool("forge_coolify.env_list", selectors(given)), given);
    return;
  }

  const [key, ...spare] = more;
  if (key === undefined) fail(`${VERB} ${action}: name the variable, e.g. \`forge ${VERB} ${action} DATABASE_URL\`.`);
  if (action === "set" && spare.length) historyRefusal(`\`${spare[0]}\` is a value on the command line`);
  if (spare.length) fail(`${VERB} ${action}: \`${spare[0]}\` is extra, and this takes one KEY.\n${firstLine(ENV_USAGE)}`);

  const route = `forge_coolify.env_${action}`;
  const args = { key, ...selectors(given), ...(given.redeploy ? { redeploy: true } : {}) };
  if (rowFor(route, args).writes && !given.yes && !given["dry-run"]) fail(consentRefusal(`env ${action}`, TRACKER_SCOPE));
  if (action === "set") args.value = await valueOf(given);
  if (given["dry-run"]) {
    preview(route, args);
    return;
  }
  show(action, await callTool(route, args), given);
};
