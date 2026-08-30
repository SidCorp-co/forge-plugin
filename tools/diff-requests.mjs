#!/usr/bin/env node
// Diff what the two implementations SEND, not what the model answers.
//
// Model output is not reproducible, so it cannot be a regression test. The prompt is: if the
// system message, the task and the payload are byte-identical, the port asks the same question and
// the Vietnamese cannot have quietly changed character. This is the closest thing to proof the
// pipeline survived the rewrite.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { translateItems } from '../plugin/vi-natural/gateway/engine.mjs';
import { DOC_TASK } from '../plugin/vi-natural/text/prompts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ITEMS = [
  ['0', 'Save'],
  ['1', 'Delete {{count}} items permanently?'],
  ['2', 'Upload a file'],
];
const CONTEXTS = [
  ['0', 'common.buttons.save'],
  ['1', 'common.dialog.confirmDelete'],
  ['2', 'files.upload'],
];
const GLOSSARY = [
  ['workspace', null],
  ['repository', 'kho mã'],
  ['Billing', 'Thanh toán'],
];

const SCENARIOS = [
  { name: 'ui-plain', kind: 'ui' },
  { name: 'ui-contexts', kind: 'ui', contexts: true },
  { name: 'ui-glossary', kind: 'ui', contexts: true, glossary: true },
  { name: 'ui-trang-trong', kind: 'ui', contexts: true, register: 'trang-trong' },
  { name: 'ui-than-mat-nam', kind: 'ui', register: 'than-mat', region: 'nam' },
  { name: 'doc-mode', kind: 'doc', contexts: true, task: 'doc' },
  { name: 'prose', kind: null },
  // A source with placeholders that the model answers badly, forcing the single-string retry path
  // and its restated rule.
  { name: 'retry-hint', kind: 'ui', contexts: true, breakFirst: true },
];

function recorder(breakFirst) {
  const sent = [];
  let call = 0;
  return {
    sent,
    config: {},
    async chat(system, user, { temperature } = {}) {
      sent.push({ system, user, temperature });
      call += 1;
      const answer = {};
      for (const [key] of ITEMS) answer[key] = breakFirst && call === 1 ? 'bad' : `VI-${key}`;
      return JSON.stringify(answer);
    },
  };
}

async function nodeSide() {
  const out = {};
  for (const s of SCENARIOS) {
    const client = recorder(s.breakFirst);
    await translateItems(client, ITEMS, {
      kind: s.kind,
      task: s.task === 'doc' ? DOC_TASK : undefined,
      glossary: s.glossary ? new Map(GLOSSARY) : null,
      register: s.register ?? 'san-pham',
      region: s.region ?? null,
      contexts: s.contexts ? new Map(CONTEXTS) : null,
      temperature: 0.3,
    });
    out[s.name] = client.sent;
  }
  return out;
}

const PY = `
import json, os, sys
sys.path.insert(0, os.path.join(${JSON.stringify(ROOT)}, "plugin", "scripts"))
from vi_cli import engine, prompts

ITEMS = [tuple(i) for i in json.loads(${JSON.stringify(JSON.stringify(ITEMS))})]
CONTEXTS = dict(json.loads(${JSON.stringify(JSON.stringify(CONTEXTS))}))
GLOSSARY = dict(json.loads(${JSON.stringify(JSON.stringify(GLOSSARY))}))
SCENARIOS = json.loads(${JSON.stringify(JSON.stringify(SCENARIOS))})

class Recorder:
    def __init__(self, break_first):
        self.sent = []
        self.break_first = break_first
        self.calls = 0
    def chat(self, system, user, temperature=0.3, **kw):
        self.sent.append({"system": system, "user": user, "temperature": temperature})
        self.calls += 1
        bad = self.break_first and self.calls == 1
        return json.dumps({k: ("bad" if bad else "VI-" + k) for k, _ in ITEMS})

out = {}
for s in SCENARIOS:
    client = Recorder(s.get("breakFirst", False))
    engine.translate_items(
        client, ITEMS,
        kind=s["kind"],
        task=prompts.DOC_TASK if s.get("task") == "doc" else None,
        glossary=GLOSSARY if s.get("glossary") else None,
        register=s.get("register") or "san-pham",
        region=s.get("region"),
        contexts=CONTEXTS if s.get("contexts") else None,
        temperature=0.3,
    )
    out[s["name"]] = client.sent
print(json.dumps(out, ensure_ascii=False))
`;

const py = spawnSync('python3', ['-c', PY], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (py.status !== 0) {
  process.stderr.write(`python side failed:\n${py.stderr}\n`);
  process.exit(2);
}

const theirs = JSON.parse(py.stdout);
const mine = await nodeSide();
let bad = 0;
for (const name of Object.keys(theirs)) {
  const a = JSON.stringify(theirs[name]);
  const b = JSON.stringify(mine[name]);
  const ok = a === b;
  if (!ok) bad += 1;
  const calls = theirs[name].length;
  process.stdout.write(`  ${ok ? 'same' : 'DIFF'}  ${name.padEnd(18)} ${calls} request(s), ${a.length} bytes\n`);
  if (!ok) {
    for (let i = 0; i < Math.max(theirs[name].length, mine[name].length); i += 1) {
      for (const field of ['system', 'user', 'temperature']) {
        const x = theirs[name][i]?.[field];
        const y = mine[name][i]?.[field];
        if (String(x) === String(y)) continue;
        process.stdout.write(`        [${i}].${field}\n`);
        process.stdout.write(`          python: ${JSON.stringify(x)?.slice(0, 400)}\n`);
        process.stdout.write(`          node:   ${JSON.stringify(y)?.slice(0, 400)}\n`);
      }
    }
  }
}
process.stdout.write(bad ? `${bad} scenario(s) differ\n` : 'every request is byte-identical\n');
process.exit(bad ? 1 : 0);
