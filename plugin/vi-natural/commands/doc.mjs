// `vi-natural doc` and `vi-natural translate` — Markdown and loose strings.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

import * as markdown from '../format/doc.mjs';
import { CliError, err } from '../util.mjs';
import { DOC_TASK } from '../text/prompts.mjs';
import { translateItems } from '../gateway/engine.mjs';

const SHOWN = 10;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function translate(args, makeClient) {
  let text;
  if (args.file) text = readFileSync(args.file, 'utf8');
  else if (args.text.length) text = args.text.join(' ');
  else text = await readStdin();
  text = text.trim();
  if (!text) throw new CliError('nothing to translate');

  const { config, client } = makeClient(args);
  const { results, problems } = await translateItems(client, [['1', text]], {
    kind: args.kind === 'prose' ? null : args.kind,
    glossary: config.glossary(),
    temperature: args.temperature,
    verbose: args.verbose,
    register: config.register(),
    region: config.region(),
  });
  if (problems.length) {
    for (const problem of problems) err(`! ${problem.reason}`);
    return 1;
  }
  process.stdout.write(`${results.get('1')}\n`);
  if (args.verbose) err(client.usageNote());
  return 0;
}

export async function doc(args, makeClient) {
  const original = readFileSync(args.source, 'utf8');
  const pieces = markdown.segment(original);
  const trails = markdown.headingTrails(pieces, basename(args.source));
  const slots = [];
  const items = [];
  const indexMap = new Map();
  const contexts = new Map();
  pieces.forEach(([kind, block], index) => {
    if (kind !== 'text') return;
    const key = String(items.length);
    indexMap.set(key, index);
    // Where the block sits, so a paragraph is not translated out of its section.
    contexts.set(key, trails[index] ?? '');
    items.push([key, markdown.protectInline(block, slots)]);
  });

  if (!items.length) throw new CliError(`no translatable prose found in ${args.source}`);

  const ext = extname(args.source);
  const outPath = args.out || `${args.source.slice(0, args.source.length - ext.length)}.vi${ext || '.md'}`;

  if (args.dryRun) {
    process.stdout.write(`${items.length} block(s) would be translated into ${outPath}\n`);
    for (const [, block] of items.slice(0, SHOWN)) {
      process.stdout.write(`  ---\n  ${block.replace(/\n/g, '\n  ')}\n`);
    }
    return 0;
  }

  const { config, client } = makeClient(args);
  const glossary = config.glossary();
  err(`translating ${items.length} block(s) with ${config.model} (${config.register()})`);
  const { results, problems } = await translateItems(client, items, {
    kind: 'doc',
    task: DOC_TASK,
    glossary,
    temperature: args.temperature,
    verbose: args.verbose,
    verify: markdown.verify,
    register: config.register(),
    region: config.region(),
    contexts,
  });

  // Blocks that failed verification keep their English original, which is already sitting in
  // `pieces` — only the successful ones get replaced.
  const out = [...pieces];
  for (const [key, translated] of results) {
    out[indexMap.get(key)] = ['text', markdown.restoreInline(translated, slots)];
  }
  writeFileSync(outPath, out.map(([, block]) => block).join(''), 'utf8');

  process.stdout.write(
    `${outPath}: ${results.size} block(s) translated, ${problems.length} left in English (${client.usageNote()})\n`,
  );
  for (const problem of problems) err(`  block ${problem.key}: ${problem.reason}`);
  return problems.length ? 2 : 0;
}
