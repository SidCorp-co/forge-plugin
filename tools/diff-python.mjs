#!/usr/bin/env node
// Run the node port and the python it replaces over the same corpus and diff the answers.
//
// The point is the pure functions: placeholder accounting, CTA judgement, Markdown segmentation,
// locale walking. Model output cannot be diffed, but everything that decides what is SENT can, and
// that is what changes whether the Vietnamese comes out right.
//
// --goldens replays tools/goldens.json, frozen while both implementations existed, and is the mode
// that still works. The live comparison needs a python tree that is no longer here.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cta from '../plugin/vi-natural/text/cta.mjs';
import * as placeholders from '../plugin/vi-natural/text/placeholders.mjs';
import * as doc from '../plugin/vi-natural/format/doc.mjs';
import * as locale from '../plugin/vi-natural/format/locale.mjs';
import { parseOrdered, stringifyOrdered } from '../plugin/vi-natural/format/json-order.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDENS = join(ROOT, 'tools', 'goldens.json');
const CORPUS = JSON.parse(readFileSync(join(ROOT, 'tools', 'corpus.json'), 'utf8'));
const MARKDOWN = readFileSync(join(ROOT, 'tools', 'corpus.md'), 'utf8');
const TREE = readFileSync(join(ROOT, 'tools', 'corpus-locale.json'), 'utf8');

const PAIRS = [
  ['common.save', 'Save', 'Lưu'],
  ['rates.removeRate', 'Remove', 'Xóa tỷ giá'],
  ['customers.save', 'Save', 'Lưu khách hàng'],
  ['orders.createOrder', 'Create order', 'Tạo đơn hàng'],
  ['orders.createDraft', 'Create draft', 'Tạo bản nháp'],
  ['orders.createInvoice', 'Create invoice', 'Tạo hóa đơn'],
  ['status.closed', 'Close', 'Kết quả đóng'],
  ['common.cancel', 'Cancel', 'Hủy'],
  ['a.upload', 'Upload', 'Tải tệp lên'],
];

function nodeAnswers() {
  const tree = parseOrdered(TREE);
  const pieces = doc.segment(MARKDOWN);
  return {
    extract: CORPUS.map((s) => [...placeholders.extract(s)].sort()),
    diff: CORPUS.map((s, i) => placeholders.diff(s, CORPUS[(i + 1) % CORPUS.length])),
    normalize: CORPUS.map((s) => cta.normalize(s)),
    isActionKey: ['common.save', 'a.status.x', 'b.ariaLabel', 'c.button'].map((k) => cta.isActionKey(k)),
    genericIndex: [...cta.genericIndex(PAIRS)].sort(),
    inflated: cta.inflated(PAIRS, cta.genericIndex(PAIRS)),
    collapse: cta.collapseGroups(PAIRS, cta.genericIndex(PAIRS), 3),
    isBare: CORPUS.map((s) => cta.isBare(s)),
    segment: pieces,
    trails: Object.entries(doc.headingTrails(pieces, 'corpus.md')),
    docVerify: pieces.filter(([k]) => k === 'text').map(([, b]) => doc.verify(b, b)),
    flatten: locale.flatten(tree).map(([path, text]) => [path, text]),
    labels: locale.flatten(tree).map(([path]) => locale.label(path)),
    order: stringifyOrdered(tree),
  };
}

const PY = `
import json, os, sys
sys.path.insert(0, os.path.join(${JSON.stringify(ROOT)}, "plugin", "scripts"))
from vi_cli import cta, doc, locale, placeholders

corpus = json.load(open(os.path.join(${JSON.stringify(ROOT)}, "tools", "corpus.json"), encoding="utf-8"))
markdown = open(os.path.join(${JSON.stringify(ROOT)}, "tools", "corpus.md"), encoding="utf-8").read()
tree = json.load(open(os.path.join(${JSON.stringify(ROOT)}, "tools", "corpus-locale.json"), encoding="utf-8"))
pairs = ${JSON.stringify(PAIRS)}
pairs = [tuple(p) for p in pairs]
index = cta.generic_index(pairs)
pieces = doc.segment(markdown)

print(json.dumps({
  "extract": [sorted(placeholders.extract(s).items()) for s in corpus],
  "diff": [placeholders.diff(s, corpus[(i + 1) % len(corpus)]) for i, s in enumerate(corpus)],
  "normalize": [cta.normalize(s) for s in corpus],
  "isActionKey": [cta.is_action_key(k) for k in ["common.save", "a.status.x", "b.ariaLabel", "c.button"]],
  "genericIndex": sorted(index.items()),
  "inflated": cta.inflated(pairs, index),
  "collapse": cta.collapse_groups(pairs, index, 3),
  "isBare": [cta.is_bare(s) for s in corpus],
  "segment": [list(p) for p in pieces],
  "trails": sorted(doc.heading_trails(pieces, root="corpus.md").items()),
  "docVerify": [doc.verify(b, b) for k, b in pieces if k == "text"],
  "flatten": [[list(p), t] for p, t in locale.flatten(tree)],
  "labels": [locale.label(p) for p, _ in locale.flatten(tree)],
}, ensure_ascii=False, sort_keys=True))
`;

// Object key order is this harness's own serialization choice, not a behaviour: python dumps with
// sort_keys, so both sides are canonicalised before they are compared.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

function report(want, got, skip = new Set()) {
  let bad = 0;
  for (const key of Object.keys(want).sort()) {
    if (skip.has(key)) continue;
    const a = JSON.stringify(canonical(want[key]));
    const b = JSON.stringify(canonical(got[key]));
    const ok = a === b;
    if (!ok) bad += 1;
    process.stdout.write(`  ${ok ? 'same' : 'DIFF'}  ${key}\n`);
    if (!ok) {
      process.stdout.write(`        python: ${a.slice(0, 300)}\n`);
      process.stdout.write(`        node:   ${b.slice(0, 300)}\n`);
    }
  }
  return bad;
}

const mine = nodeAnswers();
// trails is emitted sorted by key on both sides; python keys are ints, node's are strings.
mine.trails = mine.trails.map(([k, v]) => [Number(k), v]).sort((x, y) => x[0] - y[0]);

if (process.argv.includes('--write')) {
  writeFileSync(GOLDENS, `${JSON.stringify(mine, null, 2)}\n`);
  process.stdout.write(`wrote ${GOLDENS}\n`);
  process.exit(0);
}

if (process.argv.includes('--goldens')) {
  if (!existsSync(GOLDENS)) {
    process.stderr.write('no goldens recorded yet — run with --write while the python still exists\n');
    process.exit(2);
  }
  const bad = report(JSON.parse(readFileSync(GOLDENS, 'utf8')), mine);
  process.stdout.write(bad ? `${bad} golden(s) differ\n` : 'node matches the recorded goldens\n');
  process.exit(bad ? 1 : 0);
}

if (!existsSync(join(ROOT, 'plugin', 'scripts', 'vi_cli'))) {
  process.stderr.write('the python is gone — run with --goldens, which needs no comparison source\n');
  process.exit(2);
}
const py = spawnSync('python3', ['-c', PY], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (py.status !== 0) {
  process.stderr.write(`python side failed:\n${py.stderr}\n`);
  process.exit(2);
}
const theirs = JSON.parse(py.stdout);
// `order` has no python counterpart: python dicts already keep insertion order, so the property
// only needs proving on the node side, which tools/check-order.mjs does.
const bad = report(theirs, mine, new Set(['order']));
process.stdout.write(bad ? `${bad} behaviour(s) differ\n` : 'node and python agree on every case\n');
process.exit(bad ? 1 : 0);
