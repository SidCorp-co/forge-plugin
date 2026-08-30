// What every hook here needs: the event, the files a call wrote, the two ways to answer, and
// the once-per-file-per-session stamp. Why the write detection asks the disk instead of parsing
// the shell: docs/HOOKS.md.

import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TOKEN = /[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+/g;
const FRESH_MS = 120_000;

export function readEvent() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }
}

export function touched(ev, freshMs = FRESH_MS) {
  const ti = ev.tool_input ?? {};
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(ev.tool_name)) {
    const p = ti.file_path ?? ti.notebook_path;
    if (!p) return [];
    try {
      return [realpathSync(p)];
    } catch {
      return [resolve(p)];
    }
  }
  if (ev.tool_name !== 'Bash') return [];

  const cwd = ev.cwd || process.cwd();
  const now = Date.now();
  const out = new Set();
  for (const token of String(ti.command ?? '').match(TOKEN) ?? []) {
    for (const cand of [token, join(cwd, token)]) {
      try {
        const st = statSync(cand);
        if (st.isFile() && now - st.mtimeMs <= freshMs) {
          out.add(realpathSync(cand));
          break;
        }
      } catch {
        /* not a file */
      }
    }
  }
  return [...out].sort();
}

export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

export function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

/** A file edit has no field to hold an acknowledgement, and forcing one into the content would
 *  write this gate's bookkeeping into the file it guards. So the answer is that the question was
 *  put — recorded outside the file, once per session. */
export function askedAlready(ev, path, kind) {
  const key = createHash('sha1')
    .update(`${ev.session_id ?? ''}\0${path}`)
    .digest('hex')
    .slice(0, 16);
  const stamp = join(tmpdir(), `${kind}-${key}`);
  try {
    statSync(stamp);
    return true;
  } catch {
    /* first time */
  }
  try {
    writeFileSync(stamp, '');
  } catch {
    /* a stamp we cannot write means we ask again; that is the safe direction */
  }
  return false;
}
