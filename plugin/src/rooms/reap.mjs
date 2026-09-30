/* The one sweep every module that ages out a directory of its own spends, so an inode incident like
   the one `STAMP_MS` in `hooks/stamps.mjs` records is answered here and nowhere else. It imports
   nothing but `node:`, so `resolve/` and a hook's path may both spend it without loading either. */
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/** Whether a file nothing has written for `life` is past it, the bound itself included; a file already gone is not, being nobody's to remove. */
export const aged = (at, life, now = Date.now()) =>
  now - (statSync(at, { throwIfNoEntry: false })?.mtimeMs ?? now) >= life;

const EVERY = () => true;

/** Remove every entry of `room` past `life` and answer with the names left standing, so a reader that lists the room pays for the sweep in the same walk. An entry that cannot be read or removed is neither swept nor answered for, and one failure stops no other entry's sweep.
 *  `whole` removes an entry with whatever it holds, for a room whose entries are directories; without it a directory past its life is an entry that cannot be removed, since a room of files has no business emptying one.
 *  `only` judges the names it admits and no others, for a room this module shares with files it must never age out; the answer is then the admitted names left standing. */
export function reap(room, life, now = Date.now(), { whole = false, only = EVERY } = {}) {
  let names;
  try {
    names = readdirSync(room).filter((name) => only(name));
  } catch {
    return [];
  }
  const kept = [];
  for (const name of names) {
    try {
      if (aged(join(room, name), life, now)) rmSync(join(room, name), { force: true, recursive: whole });
      else kept.push(name);
    } catch {
      continue;
    }
  }
  return kept;
}
