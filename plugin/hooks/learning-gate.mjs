#!/usr/bin/env node
// Stop once between deciding to record something and recording it. A memory row is project
// knowledge; a skill edit develops the method. docs/HOOKS.md explains why the two must not merge.

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { askedAlready, deny, readEvent } from './_hook.mjs';
import { compare, load, sentences } from '../scripts/skill-dup.mjs';

const FORGE_SOURCES = {
  note: 'episodic — why THIS issue happened, what one debugging run cost',
  knowledge: 'how this codebase actually works, traced and verified',
  decision: 'a choice among alternatives, with the reason it was chosen',
  policy: 'a rule that binds future work',
};
const GUARDED = /\/memory\/|\/skills\//;
// Naming one of those files is not touching it: reading a skill is the common case and must stay
// free. Only a command that carries a write shape is asked about.
const WRITES = /\bsed\b[^|;]*-i|>>?\s|\btee\b|\bcp\b|\bmv\b|\btruncate\b|open\([^)]*['"]w/;

const SKILL_CATEGORIES = {
  trap: 'the environment or a tool behaved unexpectedly -> prefer a check in the plugin',
  method: 'a phase produced the wrong outcome, or had no branch for what happened',
  invariant: 'holds in EVERY project, not just this one -> a rule, and only if it outranks a phase',
  discovery: 'Phase 0 should have established this and did not',
  boundary: 'the skill asserted what a project decides -> DELETE it, say what replaced it',
};
const FILE_TYPES = {
  user: 'who the user is — role, expertise, standing preferences',
  feedback: 'guidance on how to work, with the why',
  project: 'ongoing work, goals, constraints not derivable from the code',
  reference: 'a pointer to something external — URL, dashboard, ticket',
};

const TEST = `Recording is the exception, not the closing ritual. All four must hold:
  1. it cost a cycle, not a thought
  2. it will recur — a property of the tool, repo or domain, not of this issue
  3. its failure is silent (a thing that reports its own cause needs no note)
  4. it is not already written — search first; a second copy drifts from the first
Fail any one and write nothing. That is the normal outcome of a round.

Before either destination: does the wrong state have a SHAPE — a command pattern, a
missing field, a violated ordering? Then it is a check waiting to be written, and a
check cannot be missed the way a sentence can.`;

const catalogue = (entries) =>
  Object.entries(entries)
    .map(([k, v]) => `  ${k.padEnd(10)} ${v}`)
    .join('\n');

/** Walk up to the directory holding SKILL.md, or null if this is not a skill file. */
function skillRoot(path) {
  let dir = dirname(resolve(path));
  for (let i = 0; i < 4; i += 1) {
    if (existsSync(join(dir, 'SKILL.md'))) return dir;
    dir = dirname(dir);
  }
  return null;
}

/** Sentences in the proposed text that the rest of the skill already says.
 *
 *  Run before the write, not after: the point is that the second copy never lands. The file
 *  being edited is excluded, or every unchanged line would match itself. */
function duplicates(root, path, text) {
  if (!text.trim()) return [];
  const incoming = sentences(text).map((s) => ['<proposed>', s]);
  if (incoming.length === 0) return [];
  const rel = relative(root, resolve(path));
  return compare(incoming, load(root, new Set([rel])), 0.34, 5);
}

const ev = readEvent();
const tool = ev.tool_name ?? '';
const ti = ev.tool_input ?? {};

if (tool.endsWith('forge_memory_write') || tool.endsWith('forge_memory.write')) {
  const src = ti.source ?? '';
  if (!(src in FORGE_SOURCES)) process.exit(0); // issue/comment/job are system-authored
  const md = ti.metadata;
  if (md && typeof md === 'object' && md.checked) process.exit(0);
  deny(
    `Hold — you are about to write project memory as \`${src}\`.\n\n${TEST}\n\n` +
      `If it survives, put it in the right category rather than all of it in one:\n${catalogue(FORGE_SOURCES)}\n\n` +
      'Re-send with metadata.checked set to the category you chose, and say in one line which of ' +
      'the four conditions made it worth keeping.',
  );
}

// A memory or a skill written through the shell would pass every check below unseen: `sed -i` and
// a heredoc carry no content this hook can read, and the decision this gate exists to force has to
// happen BEFORE the write, not after it. So the shell route is closed for these two kinds of file
// rather than approximated.
if (tool === 'Bash') {
  const command = ti.command ?? '';
  if (!WRITES.test(command)) process.exit(0);
  for (const token of command.match(/[A-Za-z0-9_./@-]+\.md/g) ?? []) {
    if (GUARDED.test(token) && basename(token) !== 'MEMORY.md') {
      deny(
        `Refused: \`${token}\` is a memory or skill file, and this writes it through the shell.\n\n` +
          'This gate reads the content to ask whether the fact is worth keeping and which category ' +
          'it belongs to. A `sed -i` or a heredoc carries no content to read, so going that way ' +
          'skips the question rather than answering it.\n\n' +
          'Use Write or Edit for this file.',
      );
    }
  }
  process.exit(0);
}

if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) process.exit(0);
const path = ti.file_path ?? '';

// --- a memory file: project knowledge ---
// MEMORY.md is the index, not a memory: it carries pointers and no frontmatter.
if (path.includes('/memory/') && path.endsWith('.md') && basename(path) !== 'MEMORY.md') {
  let body = ti.content ?? '';
  if (!body) {
    // An Edit sends only the changed span, so the type lives in the file already; gating on the
    // span would refuse every legitimate revision of an existing fact.
    try {
      body = readFileSync(path, 'utf8');
    } catch {
      body = '';
    }
    if (!body) process.exit(0);
  }
  const m = /^type:\s*([a-z]+)\s*$/m.exec(body);
  if ((m && m[1] in FILE_TYPES) || askedAlready(ev, path, 'learning-gate')) process.exit(0);
  deny(
    `Hold — you are about to write a memory file.\n\n${TEST}\n\n` +
      'If it survives, one file is one fact, and the frontmatter must declare which kind it is:\n' +
      `${catalogue(FILE_TYPES)}\n\nAdd a valid \`type:\` to the frontmatter and re-send.`,
  );
}

// --- a skill's own text: a skill learning ---
if (path.includes('/skills/') && /\/(SKILL\.md|references\/[^/]+\.md)$/.test(path)) {
  const root = skillRoot(path);
  const proposed = `${ti.content ?? ''}\n${ti.new_string ?? ''}`;
  if (root) {
    const dups = duplicates(root, path, proposed);
    if (dups.length) {
      const joined = dups
        .slice(0, 3)
        .map(
          ([score, [, a], [lb, b]]) =>
            `  ${score.toFixed(2)}  you are writing: ${a.slice(0, 140)}\n` +
            `        ${lb} already says: ${b.slice(0, 140)}`,
        )
        .join('\n');
      deny(
        'This repeats what the skill already says — that is a defect, not a style preference: two ' +
          'authorities for one rule diverge the first time someone corrects only the copy they ' +
          `found.\n\n${joined}\n\n` +
          'Keep it in one place and cite it from the other. If the existing wording is the worse ' +
          'one, replace it rather than adding beside it.\n' +
          'Audit the whole skill with: scripts/skill-dup.mjs <skill-dir>',
      );
    }
  }
  if (askedAlready(ev, path, 'learning-gate')) process.exit(0);
  deny(
    'Hold — you are about to change a skill\'s own text. That is a skill learning, not project ' +
      'knowledge: it develops the method, so it must not be a note about this one repository.\n\n' +
      `${TEST}\n\nIf it survives, it lands in a specific place, not on a pile:\n` +
      `${catalogue(SKILL_CATEGORIES)}\n\n` +
      'Two more before you re-send. (a) Could a check in the plugin enforce this instead? A check ' +
      'cannot be missed the way a sentence can. (b) What does this displace? A skill that only ' +
      'accumulates stops being read — name the rule it replaces, or say that it adds without ' +
      'replacing.\n\n' +
      'Re-send the same edit once you have answered both — say the category and what it displaces ' +
      'in your reply, not in the file.',
  );
}
