// `vi-natural i18n` — translate a locale JSON file, and `--check`, its offline audit.

import { basename, dirname, extname, join, sep } from 'node:path';

import * as cta from '../text/cta.mjs';
import * as locale from '../format/locale.mjs';
import * as placeholders from '../text/placeholders.mjs';
import { CliError, err, matchesAny, readText, writeAtomic } from '../util.mjs';
import { parseOrdered, stringifyOrdered } from '../format/json-order.mjs';
import { translateItems } from '../gateway/engine.mjs';

const SHOWN = 40;

export function defaultTarget(source) {
  const directory = dirname(source);
  const ext = extname(source);
  const stem = basename(source, ext);
  for (const [pattern, replacement] of [
    ['en', 'vi'],
    ['en-US', 'vi-VN'],
    ['en_US', 'vi_VN'],
  ]) {
    if (stem === pattern) return join(directory, `vi${ext}`);
    if (stem.startsWith(`${pattern}.`)) {
      return join(directory, stem.replace(pattern, replacement) + ext);
    }
  }
  if (source.includes(`${sep}en${sep}`)) return source.replace(`${sep}en${sep}`, `${sep}vi${sep}`);
  return join(directory, `${stem}.vi${ext}`);
}

function readTree(path, fallback) {
  const text = readText(path);
  if (text === null) return fallback;
  return parseOrdered(text);
}

/** [key label, english, vietnamese] for every string that has both sides. */
export function ctaPairs(source, target) {
  const pairs = [];
  for (const [path, text] of locale.flatten(source)) {
    const existing = locale.getPath(target, path);
    if (typeof existing === 'string' && existing.trim()) {
      pairs.push([locale.label(path), text, existing]);
    }
  }
  return pairs;
}

/** Style findings: reported, never a failure. A verbose button is not a bug. */
function reportCta(inflated, groups) {
  if (!inflated.length && !groups.length) return;
  process.stdout.write(
    `\ncall-to-action: ${inflated.length} inflated label(s), ` +
      `${groups.length} verb group(s) a shared key would cover\n`,
  );
  for (const finding of inflated) {
    const owner = finding.existing ? ` — ${finding.existing} already says it` : '';
    process.stdout.write(
      `  inflated: ${finding.key}\n      en: ${finding.en}\n      vi: ${finding.vi} → ${finding.suggested}${owner}\n`,
    );
  }
  for (const group of groups) {
    const owner = group.existing || 'no generic key yet';
    process.stdout.write(`  collapse: ${group.members.length} keys say "${group.bare} <object>" — ${owner}\n`);
    for (const member of group.members.slice(0, 4)) {
      process.stdout.write(`      ${member.key.padEnd(44)} ${member.vi}\n`);
    }
    if (group.members.length > 4) {
      process.stdout.write(`      … and ${group.members.length - 4} more\n`);
    }
  }
}

/** Offline audit: what is missing, and what has broken placeholders. */
export function checkLocale(source, target, sourcePath, targetPath, ignore = []) {
  const missing = [];
  const damaged = [];
  let skipped = 0;
  for (const [path, text] of locale.flatten(source)) {
    const existing = locale.getPath(target, path);
    if (typeof existing !== 'string' || !existing.trim()) {
      missing.push(locale.label(path));
      continue;
    }
    if (matchesAny(locale.label(path), ignore)) {
      skipped += 1;
      continue;
    }
    const problem = placeholders.diff(text, existing);
    if (problem) damaged.push([locale.label(path), problem, text, existing]);
  }
  const extra = locale
    .flatten(target)
    .filter(([path]) => locale.getPath(source, path) === null)
    .map(([path]) => locale.label(path));

  const pairs = ctaPairs(source, target);
  const index = cta.genericIndex(pairs);
  const inflated = cta.inflated(pairs, index).filter((f) => !matchesAny(f.key, ignore));

  const total = locale.flatten(source).length;
  process.stdout.write(
    `${sourcePath} vs ${targetPath}: ${total} source strings, ${missing.length} missing, ` +
      `${damaged.length} with placeholder damage, ${extra.length} stale` +
      `${skipped ? `, ${skipped} ignored` : ''}\n`,
  );
  for (const name of missing.slice(0, 50)) process.stdout.write(`  missing: ${name}\n`);
  for (const [name, problem, want, got] of damaged) {
    process.stdout.write(`  damaged: ${name} — ${problem}\n      en: ${want}\n      vi: ${got}\n`);
  }
  for (const name of extra.slice(0, 50)) process.stdout.write(`  stale:   ${name}\n`);
  reportCta(inflated, cta.collapseGroups(pairs, index));
  return missing.length || damaged.length ? 1 : 0;
}

/** Ids whose English source is a bare CTA, so the translation must be one too. */
function bareCtaKeys(todo, contexts, ignore) {
  const keys = new Set();
  todo.forEach(([, text], index) => {
    const name = contexts.get(String(index));
    if (matchesAny(name, ignore) || !cta.isActionKey(name)) return;
    if (cta.normalize(text) in cta.GENERIC) keys.add(String(index));
  });
  return keys;
}

export async function run(args, makeClient) {
  const source = locale.loadTree(args.source, readTree(args.source, null));
  if (source === null) throw new CliError(`cannot read ${args.source}`);
  const outPath = args.out || defaultTarget(args.source);
  const target = readTree(outPath, new Map());

  const { config, client } = makeClient(args);
  if (args.check) {
    config.glossary();
    return checkLocale(source, target, args.source, outPath, config.ignorePatterns());
  }

  const keys = args.keys ? args.keys.split(',').map((k) => k.trim()) : null;
  const todo = locale.pending(source, target, { overwrite: args.overwrite, keys });
  if (!todo.length) {
    process.stdout.write(`${outPath} is already complete (${locale.flatten(source).length} strings).\n`);
    return 0;
  }

  if (args.dryRun) {
    process.stdout.write(`${todo.length} string(s) would be translated into ${outPath}:\n`);
    for (const [path, text] of todo.slice(0, SHOWN)) {
      process.stdout.write(`  ${locale.label(path)} = ${text}\n`);
    }
    if (todo.length > SHOWN) process.stdout.write(`  ... and ${todo.length - SHOWN} more\n`);
    return 0;
  }

  const ids = new Map(todo.map(([path], index) => [String(index), path]));
  const items = todo.map(([, text], index) => [String(index), text]);
  const contexts = new Map(todo.map(([path], index) => [String(index), locale.label(path)]));
  const glossary = config.glossary();
  const ignore = config.ignorePatterns();
  const skipVerify = new Set([...contexts].filter(([, name]) => matchesAny(name, ignore)).map(([id]) => id));

  err(`translating ${items.length} string(s) with ${config.model} (${config.register()})`);
  const { results, problems } = await translateItems(client, items, {
    kind: 'ui',
    glossary,
    temperature: args.temperature,
    verbose: args.verbose,
    register: config.register(),
    region: config.region(),
    contexts,
    skipVerify,
    bareCta: bareCtaKeys(todo, contexts, ignore),
    ctaIndex: cta.genericIndex(ctaPairs(source, target)),
  });

  const translations = [...results].map(([index, text]) => [ids.get(index), text]);
  let merged = locale.merge(target, translations);
  if (args.prune) merged = locale.prune(merged, source);
  writeAtomic(outPath, `${stringifyOrdered(locale.reorder(source, merged))}\n`);

  process.stdout.write(
    `${outPath}: ${translations.length} translated, ${problems.length} skipped (${client.usageNote()})\n`,
  );
  if (!problems.length) return 0;
  err('\nleft untranslated — fix by hand or rerun:');
  for (const problem of problems) {
    const key = ids.has(problem.key) ? locale.label(ids.get(problem.key)) : problem.key;
    err(`  ${key}: ${problem.reason}\n      source: ${problem.source}`);
  }
  return 2;
}
