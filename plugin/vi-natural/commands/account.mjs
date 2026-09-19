// `vi-natural login`, `models` and `doctor` — the gateway's own state.

import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";

import { CliError, err } from "../util.mjs";
import { CONFIG_PATH, IN_STORE, save } from "../gateway/config.mjs";
import { machineValue } from "../../src/resolve/machine/stores.mjs";
import { translateItems } from "../gateway/engine.mjs";

export async function login(args) {
  let key = args.key;
  if (!key) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    key = (await rl.question("API key: ")).trim();
    rl.close();
  }
  const path = save({
    api_key: key,
    base_url: args.baseUrl,
    model: args.model,
    effort: args.effort,
    register: args.register,
    region: args.region,
  });
  process.stdout.write(`saved ${path} (0600)\n`);
  // This file is the fallback, so a key the plugin's own store holds is what a run still reads: said
  // here, where somebody has just typed the value that did not take effect.
  for (const stored of Object.values(IN_STORE)) {
    const answer = machineValue("vi", stored);
    if (answer.value && answer.from !== CONFIG_PATH) {
      err(`! the ${stored} in force is ${answer.from}'s — \`forge doctor --vi-${stored} <value>\` writes that one`);
    }
  }
  return 0;
}

export async function models(args, makeClient) {
  const { client } = makeClient(args);
  for (const model of await client.models()) {
    process.stdout.write(`${String(model.id).padEnd(32)} ${model.display_name ?? ""}\n`);
  }
  return 0;
}

export async function doctor(args, makeClient) {
  const { config, client } = makeClient(args);
  process.stdout.write(`config file : ${CONFIG_PATH}${existsSync(CONFIG_PATH) ? "" : " (absent)"}\n`);
  try {
    process.stdout.write(`base url    : ${config.baseUrl}  \u2190 ${config.from("baseUrl")}\n`);
  } catch (error) {
    process.stdout.write("base url    : MISSING\n");
    throw error;
  }
  try {
    process.stdout.write(`model       : ${config.model} (effort ${config.effort})  \u2190 ${config.from("model")}\n`);
  } catch (error) {
    process.stdout.write("model       : MISSING\n");
    throw error;
  }
  let key;
  try {
    key = config.apiKey;
  } catch (error) {
    process.stdout.write("api key     : MISSING\n");
    throw error;
  }
  process.stdout.write(`api key     : ${key.slice(0, 6)}…${key.slice(-4)}  \u2190 ${config.from("apiKey")}\n`);

  const glossary = config.glossary();
  process.stdout.write(`glossary    : ${config.glossaryPath ?? "none found"} (${glossary.size} term(s))\n`);
  const region = config.region();
  process.stdout.write(`register    : ${config.register()}${region ? `, region ${region}` : ""}\n`);

  const ids = (await client.models()).map((m) => m.id);
  process.stdout.write(`gateway     : reachable, ${ids.length} models\n`);
  if (!ids.includes(config.model)) err(`! model ${config.model} is not in the gateway list`);

  const { results, problems } = await translateItems(
    client,
    [["1", "Delete {{count}} items permanently?"]],
    {
      kind: "ui",
      glossary,
      register: config.register(),
      region,
      contexts: new Map([["1", "common.dialog.confirmDelete"]]),
    },
  );
  if (problems.length) {
    process.stdout.write(`round trip  : FAILED — ${problems[0].reason}\n`);
    return 1;
  }
  process.stdout.write(`round trip  : ${results.get("1")}\n`);
  process.stdout.write(`usage       : ${client.usageNote()}\n`);
  return 0;
}

export function requireKey(config) {
  if (!config.apiKey) throw new CliError("no API key configured");
}
