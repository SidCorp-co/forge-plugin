#!/usr/bin/env node
// Stop once before a commit message written in Vietnamese by hand — docs/HOOKS.md says why the
// commit is where the provenance question has one answer, and why an accent alone is not enough.

import { askedAlready, deny, readEvent } from './_hook.mjs';

const COMMIT = /\bgit\s+(?:-[^\s]+(?:\s+[^\s-][^\s]*)?\s+)*commit\b/;

const VIETNAMESE = /[ĂăĐđƠơƯưẠ-ỹ]/;

const ev = readEvent();
if (ev.tool_name !== 'Bash') process.exit(0);

const command = (ev.tool_input ?? {}).command ?? '';
if (!COMMIT.test(command) || !VIETNAMESE.test(command)) process.exit(0);
if (askedAlready(ev, ev.cwd ?? '', 'vi-provenance')) process.exit(0);

deny(
  'Hold — this commit message is in Vietnamese. Where did the Vietnamese come from?\n\n' +
    'If you wrote it, it is not ready: `vi-natural` carries the written style contract and the ' +
    'project glossary, and the failure mode of skipping it is invisible to a reviewer who does ' +
    'not read Vietnamese — the text parses, it just reads translated.\n\n' +
    'Write the message in English, then:\n' +
    '  vi-natural translate --kind prose "<the message>"\n\n' +
    'and commit what it prints. If it already came from `vi-natural` or from `forge`, re-send the ' +
    'same command and say so. Asked once per repository per session.',
);
