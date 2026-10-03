/* What the brief verb printed, kept as a digest per session in the config directory `configDir` names, so the
   hook can tell a message the verb generated from one somebody typed. A match on the whole text is the
   one reading no added sentence survives; a reading of its words was refused (ISS-2147). Nothing here
   needs a checkout, so the hook holds wherever a dispatch is made. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { configDir } from "../resolve/config.mjs";
import { reap } from "../rooms/reap.mjs";

/* A brief is readings taken now: ten minutes is long enough to send one, and short enough that what
   a tree held has not moved under it. */
export const FRESH_MS = 10 * 60_000;

const NO_SESSION = "none";

const digestOf = (text) => createHash("sha256").update(String(text ?? "").trim()).digest("hex");

/* A session id is a path segment here, so anything but its own alphabet is refused as none. */
const storeOf = (session) =>
  join(configDir("forge"), "briefs", /^[\w-]+$/u.test(String(session ?? "")) ? session : NO_SESSION);

const ageOf = (path, now) => {
  try {
    return now - statSync(path).mtimeMs;
  } catch {
    return null;
  }
};

/** Keep what `session` was shown and which form of brief it was, dropping every record past its
 *  window on the way. The room above the store holds one directory per session, so an aged one goes
 *  with what it holds. */
export const keepBrief = (session, text, now = Date.now(), form = "") => {
  const store = storeOf(session);
  reap(join(store, ".."), FRESH_MS, now, { whole: true });
  reap(store, FRESH_MS, now);
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, digestOf(text)), form);
};

/** The form of a brief the verb printed for `session` inside the window, `""` for a builder's, and
 *  null where `text` is none it printed. */
export const briefFormOf = (session, text, now = Date.now()) => {
  const path = join(storeOf(session), digestOf(text));
  const age = ageOf(path, now);
  if (age === null || age > FRESH_MS) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};
