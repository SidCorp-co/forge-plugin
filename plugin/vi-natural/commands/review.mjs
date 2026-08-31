// `vi-natural review` — flag translationese in Vietnamese that already exists.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import * as locale from "../format/locale.mjs";
import * as markdown from "../format/doc.mjs";
import * as placeholders from "../text/placeholders.mjs";
import { CliError, chunkItems, err, readText, writeAtomic } from "../util.mjs";
import { MAX_CHARS, MAX_ITEMS } from "../gateway/engine.mjs";
import { REVIEW_TASK, systemPrompt } from "../text/prompts.mjs";
import { parseJsonObject } from "../util.mjs";
import { parseOrdered, stringifyOrdered } from "../format/json-order.mjs";

function localeEntries(path) {
  const text = readText(path);
  const tree = text === null ? new Map() : parseOrdered(text);
  const entries = new Map();
  for (const [keyPath, value] of locale.flatten(tree)) {
    if (value.trim()) entries.set(locale.label(keyPath), value);
  }
  return { entries, contexts: null };
}

function docEntries(path) {
  const pieces = markdown.segment(readFileSync(path, "utf8"));
  const entries = new Map();
  pieces.forEach(([kind, block], index) => {
    if (kind === "text") entries.set(String(index), block);
  });
  // The heading above a paragraph is the key path a document never had.
  const trails = markdown.headingTrails(pieces, basename(path));
  return { entries, contexts: new Map(Object.entries(trails)) };
}

function apply(path, findings) {
  const tree = parseOrdered(readText(path) ?? "{}");
  const byLabel = new Map(locale.flatten(tree).map(([keyPath]) => [locale.label(keyPath), keyPath]));
  let applied = 0;
  const refused = [];
  for (const finding of findings) {
    const { key, suggested } = finding;
    if (!byLabel.has(key) || typeof suggested !== "string" || !suggested.trim()) continue;
    const current = locale.getPath(tree, byLabel.get(key));
    const problem = placeholders.diff(current, suggested);
    if (problem) {
      refused.push(`${key} (${problem})`);
      continue;
    }
    locale.setPath(tree, byLabel.get(key), suggested);
    applied += 1;
  }
  writeAtomic(path, `${stringifyOrdered(tree)}\n`);
  process.stdout.write(`applied ${applied} rewrite(s) to ${path}\n`);
  for (const name of refused) err(`  refused, placeholders would change: ${name}`);
  return 0;
}

export async function run(args, makeClient) {
  const { config, client } = makeClient(args);
  const isJson = args.source.endsWith(".json");
  const { entries, contexts } = isJson ? localeEntries(args.source) : docEntries(args.source);
  if (!entries.size) throw new CliError(`nothing to review in ${args.source}`);

  const system = systemPrompt(isJson ? "ui" : "doc", {
    glossary: config.glossary(),
    register: config.register(),
    region: config.region(),
    keyContext: !isJson,
  });

  let findings = [];
  for (const batch of chunkItems([...entries], MAX_CHARS, MAX_ITEMS)) {
    const body = {};
    for (const [key, value] of batch) {
      body[key] = isJson ? value : { k: contexts.get(key) ?? "", s: value };
    }
    const answer = parseJsonObject(
      await client.chat(system, `${REVIEW_TASK}\n\n${JSON.stringify(body, null, 2)}`, { temperature: 0.2 }),
    );
    findings.push(...(answer.findings ?? []));
  }
  findings = findings.filter((f) => f && typeof f === "object" && entries.has(f.key));

  if (args.asJson) {
    process.stdout.write(`${JSON.stringify({ file: args.source, findings }, null, 2)}\n`);
  } else if (!findings.length) {
    process.stdout.write(`${args.source}: reads naturally, nothing to flag.\n`);
  } else {
    process.stdout.write(`${args.source}: ${findings.length} finding(s)\n\n`);
    for (const finding of findings) {
      process.stdout.write(`  ${finding.key} — ${finding.issue ?? ""}\n`);
      process.stdout.write(`      now: ${finding.current ?? ""}\n`);
      process.stdout.write(`      →    ${finding.suggested ?? ""}\n\n`);
    }
  }

  if (args.fix && findings.length) {
    if (!isJson) throw new CliError("--fix only supports JSON locale files");
    return apply(args.source, findings);
  }
  if (args.verbose) err(client.usageNote());
  return findings.length && !args.fix ? 1 : 0;
}
