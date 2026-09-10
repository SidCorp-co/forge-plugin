/* The one way anything under `tools` waits for a file — the landing lock for another ship's release, the gate wait for a
   verdict — since a second copy is a second answer to when a wait gives up. The file need not exist yet, so it watches the
   directory; arm before the writer starts, because a notification arriving before anything awaits `settled` is lost; and a
   directory it cannot watch at all leaves the ceiling as the only wake, which refuses rather than hangs. */
import { watch } from "node:fs";
import { basename, dirname } from "node:path";

export const watching = (path, ms) => {
  let close = () => {};
  let done = () => {};
  const settled = new Promise((woke) => {
    done = woke;
  });
  const timer = setTimeout(() => done("ceiling"), ms);
  timer.unref?.();
  try {
    const watcher = watch(dirname(path), (_kind, name) => {
      if (name === null || name === basename(path)) done("changed");
    });
    watcher.on("error", () => done("unwatchable"));
    close = () => watcher.close();
  } catch {
    close = () => {};
  }
  return {
    settled,
    cancel: () => {
      clearTimeout(timer);
      close();
    },
  };
};
