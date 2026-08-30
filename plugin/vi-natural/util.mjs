// Small shared helpers.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class CliError extends Error {}

export function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new CliError(`cannot read ${path}: ${error.message}`);
  }
}

export function readJson(path, fallback = null) {
  const text = readText(path);
  if (text === null) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CliError(`${path} is not valid JSON: ${error.message}`);
  }
}

export function writeAtomic(path, body, mode) {
  const directory = dirname(resolve(path));
  if (directory) mkdirSync(directory, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, body, mode === undefined ? 'utf8' : { encoding: 'utf8', mode });
  renameSync(tmp, path);
}

export function writeJson(path, data, indent = 2) {
  writeAtomic(path, `${JSON.stringify(data, null, indent)}\n`);
}

// Model replies arrive fenced, prefaced, or trailed with prose often enough that a bare
// JSON.parse loses whole batches that were otherwise fine.
export function parseJsonObject(text) {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.includes('\n') ? body.slice(body.indexOf('\n') + 1) : '';
    if (body.trimEnd().endsWith('```')) body = body.trimEnd().slice(0, -3);
  }
  try {
    return JSON.parse(body);
  } catch {
    /* fall through to the brace scan */
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new CliError(`model did not return JSON:\n${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (error) {
    throw new CliError(`model returned malformed JSON (${error.message}):\n${text.slice(0, 400)}`);
  }
}

export function err(message) {
  process.stderr.write(`${message.replace(/\s+$/, '')}\n`);
}

/** Group [key, text] pairs into batches small enough to survive one round trip. */
export function chunkItems(items, maxChars, maxItems) {
  const batches = [];
  let batch = [];
  let size = 0;
  for (const [key, text] of items) {
    const cost = text.length + String(key).length + 8;
    if (batch.length && (size + cost > maxChars || batch.length >= maxItems)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push([key, text]);
    size += cost;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

const GLOB = /[.+^${}()|[\]\\]/g;

export function globToRegExp(pattern) {
  const body = pattern
    .replace(GLOB, '\\$&')
    .replace(/\*/g, '[\\s\\S]*')
    .replace(/\?/g, '[\\s\\S]');
  return new RegExp(`^${body}$`);
}

export function matchesAny(name, patterns) {
  return [...patterns].some((pattern) => globToRegExp(pattern).test(name));
}

/** Strip any of `chars` from both ends, the way python's str.strip(set) does. */
export function stripChars(text, chars) {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) start += 1;
  while (end > start && chars.includes(text[end - 1])) end -= 1;
  return text.slice(start, end);
}
