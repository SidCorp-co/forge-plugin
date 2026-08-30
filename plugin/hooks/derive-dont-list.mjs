#!/usr/bin/env node
// Nudge once when a checker is about to hard-code the cases it knows.
//
// A checker earns its keep by catching what nobody predicted. A list written by hand only knows
// the cases its author had already met, and it fails twice over: it stays silent when someone
// adds a case it never heard of, and it reports a false gap when someone extends the thing
// correctly. The second failure is the expensive one — a checker that cries wolf gets switched
// off, and a switched-off checker protects nothing.
//
// Measured on sid-erp: an error-code test carried a six-item list copied by hand out of a
// `switch`. Adding one arm to that switch and one code to the contract — a correct change, both
// halves consistent — made the test fail on the correct change while a derived version stayed
// green.
//
// Deliberately a nudge, not a refusal. A hard-coded list is sometimes the honest answer: a
// ratchet's list of migrated directories is *supposed* to be enumerated, because being
// incomplete is the point. So this asks once per file per session and then gets out of the way.
//
// A comment sitting directly above the literal silences it outright. That is not politeness: it
// is the difference between a list nobody examined and one somebody decided on, and the decision
// is the only thing a reader downstream can act on.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { askedAlready, block, readEvent, touched } from './_hook.mjs';

// Only files whose job is to check something. Nudging every array literal in a codebase is how a
// guard earns its way into the ignore list.
const CHECKER =
  /(lint|check|guard|rule|verify|validate|audit)[^/]*\.(py|mjs|js|ts)$|\/scripts\/[^/]+\.(mjs|js|py)$|\.test\.(ts|tsx|js|mjs)$/;

// A run of quoted constants that reads like an enumeration of cases.
const LIST = /(?:const|let|var|^\s*[A-Z_]+\s*=)\s*[\w:[\]<>,\s]*=\s*[[{]([^\]}]{0,400})[\]}]/gm;
const CONSTS = /['"]([A-Z][A-Z0-9_]{2,})['"]/g;

/** The file as it now stands. Running after the write is what lets a `sed -i` or a heredoc be
 *  seen at all — they leave no tool_input to inspect, only a file. */
function contentOf(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** A comment on the line above the literal means somebody decided to enumerate. */
function isExplained(text, start) {
  const before = text.slice(0, start).replace(/\s+$/, '');
  const line = before.slice(before.lastIndexOf('\n') + 1).trimStart();
  return ['//', '/*', '*', '#'].some((open) => line.startsWith(open));
}

/** The longest run of ALL_CAPS string constants in one unexplained literal. */
function offending(text) {
  let worst = [];
  for (const m of text.matchAll(LIST)) {
    if (isExplained(text, m.index)) continue;
    const found = [...m[1].matchAll(CONSTS)].map((c) => c[1]);
    if (found.length > worst.length) worst = found;
  }
  return worst;
}

const ev = readEvent();
for (const path of touched(ev)) {
  if (!CHECKER.test(path)) continue;
  const found = offending(contentOf(path));
  if (found.length < 3 || askedAlready(ev, path, 'derive-dont-list')) continue;
  const sample = found.slice(0, 4).join(', ') + (found.length > 4 ? '…' : '');
  block(
    `${basename(path)} — asked once, then this file is yours.\n\n` +
      `This checker is about to carry a hand-written list of ${found.length} constants ` +
      `(${sample}). A list only knows the cases you have already met: it stays silent on a case ` +
      'it never heard of, and it reports a false gap when someone extends the thing correctly — ' +
      'and a checker that cries wolf gets switched off.\n\n' +
      'Can it be DERIVED from the source instead? Read the enum, parse the switch, key on the ' +
      'declared type rather than the name. Then a case added next year is covered without anyone ' +
      'remembering this file exists.\n\n' +
      'If enumerating IS the point — a ratchet\'s migrated-directory list is supposed to be ' +
      'incomplete — say so in a comment above the list.',
  );
}
