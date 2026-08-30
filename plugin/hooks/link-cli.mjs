#!/usr/bin/env node
// The skills tell the agent to run `forge` and `vi-natural`, so both have to be on PATH.
import { mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) process.exit(0);
const bin = join(homedir(), '.local', 'bin');
try {
  mkdirSync(bin, { recursive: true });
} catch {
  process.exit(0);
}
for (const name of ['forge', 'vi-natural']) {
  const link = join(bin, name);
  try {
    unlinkSync(link);
  } catch {
    /* nothing there yet */
  }
  try {
    symlinkSync(join(root, 'bin', name), link);
  } catch {
    /* a link we cannot write is not worth failing a session start over */
  }
}
