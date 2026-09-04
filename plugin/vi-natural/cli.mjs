#!/usr/bin/env node
// Argument parsing and command dispatch for `vi-natural`.

import { pathToFileURL } from "node:url";

import { CliError, err } from "./util.mjs";
import { Client } from "./gateway/client.mjs";
import { Config, DEFAULT_EFFORT, EFFORTS, EFFORT_BY_VERB } from "./gateway/config.mjs";
import { REGION_NAMES, REGISTER_NAMES } from "./text/prompts.mjs";
import * as account from "./commands/account.mjs";
import * as docCmd from "./commands/doc.mjs";
import * as i18nCmd from "./commands/i18n.mjs";
import * as reviewCmd from "./commands/review.mjs";

export const VERSION = "2.0.0";

// name → [takes a value, dest, allowed values]
const COMMON = {
  "--model": [true, "model"],
  "--effort": [true, "effort", EFFORTS],
  "--base-url": [true, "baseUrl"],
  "--temperature": [true, "temperature"],
  "--register": [true, "register", REGISTER_NAMES],
  "--region": [true, "region", REGION_NAMES],
  "--glossary": [true, "glossary"],
  "--ignore": [true, "ignore"],
  "--no-glossary": [false, "noGlossary"],
  "-v": [false, "verbose"],
  "--verbose": [false, "verbose"],
};

const VERBS = {
  translate: { common: true, positional: "text", many: true, flags: { "-f": [true, "file"], "--file": [true, "file"], "--kind": [true, "kind", ["ui", "doc", "prose"]] } },
  i18n: { common: true, positional: "source", flags: { "-o": [true, "out"], "--out": [true, "out"], "--overwrite": [false, "overwrite"], "--keys": [true, "keys"], "--prune": [false, "prune"], "--check": [false, "check"], "--dry-run": [false, "dryRun"] } },
  doc: { common: true, positional: "source", flags: { "-o": [true, "out"], "--out": [true, "out"], "--dry-run": [false, "dryRun"] } },
  review: { common: true, positional: "source", flags: { "--json": [false, "asJson"], "--fix": [false, "fix"] } },
  login: { flags: { "--key": [true, "key"], "--base-url": [true, "baseUrl"], "--model": [true, "model"], "--effort": [true, "effort", EFFORTS], "--register": [true, "register", REGISTER_NAMES], "--region": [true, "region", REGION_NAMES] } },
  models: { common: true },
  doctor: { common: true },
};

const USAGE = `usage: vi-natural <command> [options]

Natural Vietnamese for i18n files and docs, via an OpenAI-compatible gateway.

  translate [text...] [-f FILE] [--kind ui|doc|prose]   translate text; omit text to read stdin
  i18n SOURCE [-o OUT] [--overwrite] [--keys a,b] [--prune] [--check] [--dry-run]
  doc SOURCE [-o OUT] [--dry-run]                       translate a Markdown document
  review SOURCE [--json] [--fix]                        flag translationese in Vietnamese
  login [--key K] [--base-url U] [--model M] [--effort E] [--register R] [--region R]
  models                                                list what the gateway offers
  doctor                                                config, reachability, one round trip

Common options:
  --model M          model id (required; the models verb lists them)
  --effort E         ${EFFORTS.join("|")} (default ${DEFAULT_EFFORT}, ${EFFORT_BY_VERB.review} for review)
  --base-url U       gateway base url
  --temperature N    sampling temperature (default 0.3)
  --register R       ${REGISTER_NAMES.join(" | ")}
  --region R         ${REGION_NAMES.join(" | ")}
  --glossary PATH    path to a term glossary JSON
  --ignore GLOBS     comma-separated key globs exempt from the placeholder check
  --no-glossary      ignore .vi-glossary.json even if one is found
  -v, --verbose      progress on stderr
  --version          print the version

Exit codes: 0 clean · 1 error, or review found something · 2 written, some strings refused.`;

function parse(argv) {
  if (argv.includes("--version")) return { command: "version" };
  const command = argv[0];
  if (!command || command === "-h" || command === "--help") return { command: "help" };
  const spec = VERBS[command];
  if (!spec) throw new CliError(`unknown command: ${command}\n\n${USAGE}`);

  const flags = { ...(spec.common ? COMMON : {}), ...(spec.flags ?? {}) };
  const args = { command, temperature: 0.3, kind: "ui", text: [] };
  const positional = [];

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "-h" || token === "--help") return { command: "help" };
    if (!(token in flags)) {
      if (token.startsWith("-") && token !== "-") throw new CliError(`unknown option: ${token}\n\n${USAGE}`);
      positional.push(token);
      continue;
    }
    const [takesValue, dest, allowed] = flags[token];
    if (!takesValue) {
      args[dest] = true;
      continue;
    }
    const value = argv[++index];
    if (value === undefined) throw new CliError(`${token} needs a value`);
    if (allowed && !allowed.includes(value)) {
      throw new CliError(`${token} must be one of ${allowed.join(", ")}, not ${value}`);
    }
    args[dest] = dest === "temperature" ? Number(value) : value;
  }

  if (spec.many) args.text = positional;
  else if (spec.positional) {
    if (!positional.length) throw new CliError(`${command} needs a ${spec.positional}\n\n${USAGE}`);
    args[spec.positional] = positional[0];
  }
  return args;
}

function makeClient(args) {
  const config = new Config({
    model: args.model,
    baseUrl: args.baseUrl,
    effort: args.effort,
    // Which verb is running decides how hard the model should think when nothing overrides it.
    verb: args.command,
    glossary: args.glossary,
    noGlossary: args.noGlossary,
    ignore: args.ignore,
    register: args.register,
    region: args.region,
  });
  return { config, client: new Client(config, { verbose: Boolean(args.verbose) }) };
}

// Every verb takes the same pair, so login can sit here directly rather than behind a wrapper
// that would only forward; it is the one verb that reaches no gateway and ignores the second.
const RUN = {
  translate: docCmd.translate,
  i18n: i18nCmd.run,
  doc: docCmd.doc,
  review: reviewCmd.run,
  login: account.login,
  models: account.models,
  doctor: account.doctor,
};

export async function main(argv) {
  let args;
  try {
    args = parse(argv);
  } catch (error) {
    err(`vi-natural: ${error.message}`);
    return 1;
  }
  if (args.command === "help") {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (args.command === "version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  try {
    return await RUN[args.command](args, makeClient);
  } catch (error) {
    if (error instanceof CliError) {
      err(`vi-natural: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.on("SIGINT", () => {
    err("interrupted");
    process.exit(130);
  });
  process.exit(await main(process.argv.slice(2)));
}
