// What every hook in this plugin needs: the event, the files a call wrote, the two ways to
// answer, and the once-per-file-per-session stamp.
//
// WHICH FILES A CALL WROTE is the part worth reading. The file hooks used to watch
// Write/Edit/MultiEdit and nothing else, so every edit made through the shell — `sed -i`, a
// heredoc, a python one-liner — passed all of them unseen. Under a permission mode that
// encourages Bash that is not an edge case, it is the main road.
//
// Parsing the shell command is the wrong tool: there is no bounded set of ways to write a
// file. So this asks the disk instead. Any path-shaped token in the command that names a real
// file whose mtime is within the last breath is a file this call just wrote — which covers
// `sed`, a heredoc, `tee`, `cp`, and a script that opens a path it mentions, without any of
// them being understood.

import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TOKEN = /[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+/g;
const FRESH_MS = 120_000;

/** The event, or exit 0. A parse failure must never break a session. */
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

/** PreToolUse: refuse the call and say why. */
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

/** PostToolUse: the call already happened, so this is feedback rather than a refusal. */
export function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

/** Ask once per file per session, then get out of the way.
 *
 *  A memory row can carry `metadata.checked`, but a file edit has no field to put an
 *  acknowledgement in — forcing one into the content would write the gate's bookkeeping into
 *  the file it is guarding. So the acknowledgement is the fact that the question was put,
 *  recorded outside the file. */
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
