#!/usr/bin/env node
// Report drift between the vendored lint script and its upstream. A copy nobody compares is a
// fork with a comment on top; docs/HOOKS.md says why the copy exists at all.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED = join(HERE, '..', 'hooks', 'vendor', 'lint-edited-file.mjs');
const REL = 'claude-plugin/scripts/lint-edited-file.mjs';

const header = readFileSync(VENDORED, 'utf8').split('\n').slice(0, 8).join('\n');
const pinned = /commit ([0-9a-f]{7,40})/.exec(header)?.[1];
const pkg = /Upstream: (\S+) v(\S+),/.exec(header);
if (!pinned || !pkg) {
  process.stderr.write(`${VENDORED}: header does not record its upstream commit\n`);
  process.exit(2);
}

const [, name, version] = pkg;
const upstream = process.argv[2] ?? join(HERE, '..', '..', '..', name);
if (!existsSync(join(upstream, REL))) {
  process.stdout.write(`upstream not on this machine (${upstream}) — pinned at ${name} v${version} @ ${pinned}\n`);
  process.exit(0);
}

const head = spawnSync('git', ['-C', upstream, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
const now = (head.stdout ?? '').trim();

// Compare code, not sha: upstream moving without touching this file is not drift.
const mine = readFileSync(VENDORED, 'utf8').split('\n').slice(9).join('\n').trim();
const theirs = readFileSync(join(upstream, REL), 'utf8').replace(/^#!.*\n/, '').trim();
if (mine === theirs) {
  process.stdout.write(`in sync with ${name} @ ${now || pinned}\n`);
  process.exit(0);
}
process.stderr.write(
  `DRIFT: hooks/vendor/lint-edited-file.mjs differs from ${join(upstream, REL)}\n` +
    `  vendored at ${pinned}, upstream now ${now || 'unknown'}\n` +
    '  Re-vendor it, keeping the header, rather than editing either copy toward the other.\n',
);
process.exit(1);
