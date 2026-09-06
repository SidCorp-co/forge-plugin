/* What a gate asked once and what its last call said, kept outside the files they are about. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Per call, so `TMPDIR` moves it; per user, since a shared temp root would let only its first owner write. */
export const stampRoom = () => join(tmpdir(), `forge-hook-stamps-${process.getuid?.() ?? "one"}`);

/** How long one answers: it is a session's memory and no session lasts a day. Unreaped they reached
 *  29,626 files and took a machine's temp filesystem to 97% of its inodes, killing a whole suite. */
export const STAMP_MS = 86_400_000;

function reap(room) {
  const stale = Date.now() - STAMP_MS;
  let names;
  try {
    names = readdirSync(room);
  } catch {
    return;
  }
  for (const name of names) {
    const at = join(room, name);
    try {
      if (statSync(at).mtimeMs < stale) rmSync(at);
    } catch {
      continue;
    }
  }
}

function put(room, at, body) {
  try {
    mkdirSync(room, { recursive: true });
    writeFileSync(at, body);
  } catch {}
}

/* Reaped before the write: a temp root out of inodes refuses a write and allows a removal. */
function place(room, stamp) {
  reap(room);
  put(room, stamp, "");
}

const keyFor = (session, of) =>
  createHash("sha1").update(`${session ?? ""}\0${of}`).digest("hex").slice(0, 16);

export function askedAlready(ev, path, kind, { set = true } = {}) {
  const room = stampRoom();
  const stamp = join(room, `${kind}-${keyFor(ev.session_id, path)}`);
  if (existsSync(stamp)) return true;
  if (set) place(room, stamp);
  return false;
}

/** Keyed for whoever asks next: a guarded directory is the project's, not one session's. */
export const askedByAnyone = (ev, path, kind, options) =>
  askedAlready({ ...ev, session_id: "" }, path, kind, options);

const noteAt = (ev, kind) => join(stampRoom(), `${kind}-said-${keyFor(ev.session_id, "")}`);

/** What the call before this one left; it reaps nothing, since a gate spends it on every call. */
export const noted = (ev, kind) => {
  try {
    return readFileSync(noteAt(ev, kind), "utf8");
  } catch {
    return "";
  }
};

export const note = (ev, kind, said) => put(stampRoom(), noteAt(ev, kind), said);
