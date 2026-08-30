#!/usr/bin/env node
// The global half of a two-level arrangement.
//
// This plugin owns WHEN and WHERE a code rule fires — every write route, including the shell,
// and only inside a directory the project actually lints. It owns no rule of its own. WHAT
// counts as good code is the project's, and the project already installed something that
// knows: `eslint-plugin-code-quality` ships a hook script that resolves the workspace, the
// local eslint and the local config. So this locates that script through the project's own
// node_modules and hands the file to it.
//
// A project without that dependency gets silence, which is the correct answer — a global
// plugin that imposed a rule the project never opted into would be the thing projects
// disable.
//
// Why a wrapper exists at all: the shipped hook matches `Edit|Write|MultiEdit|NotebookEdit`,
// so a `sed -i`, a heredoc or a python one-liner writes the file with nothing watching. That
// gap is about routes, not rules, which makes it this level's problem to close.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DELEGATE = 'eslint-plugin-code-quality/claude-plugin/scripts/lint-edited-file.mjs';
const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP = /\/(node_modules|dist|\.next|coverage|\.git)\//;
const TOKEN = /[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+/g;
const FRESH_MS = 120_000;
const MAX_FILES = 5;

/** Files this call wrote, whichever route it took. Parsing the shell is the wrong tool —
 *  there is no bounded set of ways to write a file — so ask the disk: a path-shaped token
 *  naming a real file whose mtime is within the last breath is one this call just wrote. */
function touched(ev) {
  const ti = ev.tool_input ?? {};
  if (ev.tool_name !== 'Bash') {
    const p = ti.file_path ?? ti.notebook_path;
    return p ? [resolve(p)] : [];
  }
  const cwd = ev.cwd ?? process.cwd();
  const now = Date.now();
  const out = new Set();
  for (const token of String(ti.command ?? '').match(TOKEN) ?? []) {
    for (const cand of [resolve(cwd, token), resolve(token)]) {
      try {
        if (statSync(cand).isFile() && now - statSync(cand).mtimeMs <= FRESH_MS) {
          out.add(cand);
          break;
        }
      } catch {
        /* not a file */
      }
    }
  }
  return [...out];
}

/** The project's copy, found by walking its node_modules — never this plugin's own. */
function delegateFor(file) {
  let dir = dirname(file);
  while (dir && dir !== '/') {
    const cand = join(dir, 'node_modules', DELEGATE);
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return null;
}

const raw = readFileSync(0, 'utf8');
let ev;
try {
  ev = JSON.parse(raw);
} catch {
  process.exit(0);
}

const files = touched(ev).filter((f) => CODE.test(f) && !SKIP.test(f)).slice(0, MAX_FILES);
const reasons = [];
for (const file of files) {
  const delegate = delegateFor(file);
  if (!delegate) continue;
  try {
    execFileSync('node', [delegate], {
      input: JSON.stringify({ ...ev, tool_name: 'Write', tool_input: { file_path: file } }),
      encoding: 'utf8',
      timeout: 60_000,
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
  process.stderr.write(reasons.join('\n\n') + '\n');
  process.exit(2);
}
