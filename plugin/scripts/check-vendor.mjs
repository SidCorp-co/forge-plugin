#!/usr/bin/env node
// Report drift between each vendored file and packages/code-quality, whose copy it is. A copy
// nobody compares is a fork with a comment on top; docs/HOOKS.md says why the copies exist.
// Every file in vendor/ names its own upstream in its header, so vendoring one more is a copy
// and never an edit here.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, '..', 'hooks', 'vendor');
const upstream = process.argv[2] ?? join(HERE, '..', '..', 'packages', 'code-quality');

const head = spawnSync('git', ['-C', upstream, 'rev-parse', '--short', 'HEAD'], {
  encoding: 'utf8',
});
const now = (head.stdout ?? '').trim();

function provenance(text, path) {
  const header = text.split('\n').slice(0, 8).join('\n');
  const pinned = /commit ([0-9a-f]{7,40})/.exec(header)?.[1];
  const pkg = /Upstream: (\S+) v(\S+),/.exec(header);
  // Its continuation line carries the path: the one token in the header with a separator in it.
  const rel = /^\/\/\s+(\S+\/\S+)\s*$/m.exec(header)?.[1];
  if (!pinned || !pkg || !rel) {
    process.stderr.write(`${path}: header does not record its upstream commit and path\n`);
    process.exit(2);
  }
  return { pinned, name: pkg[1], version: pkg[2], rel };
}

const names = readdirSync(VENDOR).sort();
if (names.length === 0) {
  process.stderr.write(`${VENDOR} is empty — a vendored copy went missing\n`);
  process.exit(2);
}

let drifted = 0;
for (const name of names) {
  const vendored = join(VENDOR, name);
  const text = readFileSync(vendored, 'utf8');
  const { pinned, name: pkg, version, rel } = provenance(text, vendored);
  const source = join(upstream, rel);
  // The path is inside this tree, so an absent one is a broken tree and not an absent checkout.
  if (!existsSync(source)) {
    process.stderr.write(`${source} is missing — pinned at ${pkg} v${version} @ ${pinned}\n`);
    process.exit(2);
  }

  // Compare code, not sha: upstream moving without touching this file is not drift.
  const mine = text.split('\n').slice(9).join('\n').trim();
  const theirs = readFileSync(source, 'utf8').replace(/^#!.*\n/, '').trim();
  if (mine === theirs) {
    process.stdout.write(`hooks/vendor/${name}: in sync with ${pkg} @ ${now || pinned}\n`);
    continue;
  }
  drifted += 1;
  process.stderr.write(
    `DRIFT: hooks/vendor/${name} differs from ${source}\n` +
      `  vendored at ${pinned}, upstream now ${now || 'unknown'}\n` +
      '  Re-vendor it, keeping the header, rather than editing either copy toward the other.\n',
  );
}
process.exit(drifted === 0 ? 0 : 1);
