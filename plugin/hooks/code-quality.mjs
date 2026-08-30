#!/usr/bin/env node
// The global half of a two-level arrangement.
//
// This plugin owns WHEN and WHERE a code rule fires — every write route, including the shell.
// It owns no rule of its own: WHAT counts as good code is decided by the project's own eslint
// config, and the script that resolves that config is `eslint-plugin-code-quality`'s, not one
// written here.
//
// Why a wrapper exists at all: that script ships as a Claude plugin whose matcher is
// `Edit|Write|MultiEdit|NotebookEdit`, so a `sed -i`, a heredoc or a python one-liner writes the
// file with nothing watching. That gap is about routes, not rules, which makes it this level's
// problem to close.
//
// Two copies can answer, and the order matters. A project that installed the package has pinned
// a version, and that pin outranks anything global — so its node_modules copy is tried first, and
// the vendored fallback runs only where the project has none. A project with no eslint at all is
// silent either way: the script itself treats that as an opt-out rather than a misconfiguration.
//
// One consequence worth naming: the delegate formats with prettier before linting, so it WRITES
// the file. Extending it to the shell route means a file written by `sed` gets formatted too —
// the same contract every project already accepted on Edit.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readEvent, touched } from './_hook.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED = join(HERE, 'vendor', 'lint-edited-file.mjs');
const INSTALLED = 'eslint-plugin-code-quality/claude-plugin/scripts/lint-edited-file.mjs';
const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP = /\/(node_modules|dist|\.next|coverage|\.git)\//;
const MAX_FILES = 5;

/** The project's own copy if it has one, else the copy that travels with this plugin. */
function delegateFor(file) {
  let dir = dirname(file);
  while (dir && dir !== '/') {
    const cand = join(dir, 'node_modules', INSTALLED);
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return VENDORED;
}

const ev = readEvent();
const files = touched(ev)
  .filter((f) => CODE.test(f) && !SKIP.test(f))
  .slice(0, MAX_FILES);

const reasons = [];
for (const file of files) {
  try {
    execFileSync('node', [delegateFor(file)], {
      input: JSON.stringify({ ...ev, tool_name: 'Write', tool_input: { file_path: file } }),
      encoding: 'utf8',
      timeout: 60_000,
      // Without this the child's stderr is ALSO inherited, so every finding prints twice.
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    // The delegate speaks Claude Code's own hook protocol: exit 2 with the reason on stderr.
    // Passing that through unchanged keeps one convention where translating would invent a
    // second, and a second convention is the one that drifts.
    const text = String(err.stderr ?? '').trim();
    if (err.status === 2 && text) reasons.push(text);
  }
}

if (reasons.length) {
  process.stderr.write(`${reasons.join('\n\n')}\n`);
  process.exit(2);
}
