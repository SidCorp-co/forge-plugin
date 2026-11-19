// cm:why the one way anything under `tools` waits for a file — the landing lock, the gate's wait for a verdict — since a second copy is a second answer to when a wait gives up
// cm:guard arm before the writer starts: what is read at arming is what a later change is measured against, so a change landing before anything awaits `settled` is still its wake
// cm:why a directory that cannot be watched (EMFILE or ENOSPC once the box's inotify instances are spent, or a watcher that errors) polls the file instead; sleeping to the ceiling there hung the gate's lock tests past half an hour (ISS-119, debt a1655637)
import { statSync, watch } from "node:fs";
import { basename, dirname } from "node:path";
import { clearInterval, setInterval } from "node:timers";

const POLL_MS = 100;

const seen = (path) => {
  try {
    const { ino, size, mtimeMs, ctimeMs } = statSync(path);
    return `${ino}:${size}:${mtimeMs}:${ctimeMs}`;
  } catch {
    return null;
  }
};

/** Settles "changed" when the file at `path` appears, moves or goes, else "ceiling" after `ms`. `arm` is the seam a
 *  case drives a watch that cannot be armed through. */
export const watching = (path, ms, { arm = watch } = {}) => {
  const before = seen(path);
  let woke = () => {};
  const settled = new Promise((done) => {
    woke = done;
  });
  let watcher = null;
  let poller = null;
  const cancel = () => {
    clearTimeout(timer);
    clearInterval(poller);
    watcher?.close();
    watcher = null;
  };
  const done = (why) => {
    cancel();
    woke(why);
  };
  const timer = setTimeout(() => done("ceiling"), ms);
  timer.unref?.();
  const poll = () => {
    watcher?.close();
    watcher = null;
    if (poller !== null) return;
    poller = setInterval(() => {
      if (seen(path) !== before) done("changed");
    }, POLL_MS);
  };
  try {
    watcher = arm(dirname(path), (_kind, name) => {
      if (name === null || name === basename(path)) done("changed");
    });
    watcher.on("error", poll);
  } catch {
    poll();
  }
  return { settled, cancel };
};
