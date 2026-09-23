/* What the brief verb printed, kept as a digest per session in the config directory `configDir` names, so the
   hook can tell a message the verb generated from one somebody typed. A match on the whole text is the
   one reading no added sentence survives; a reading of its words was refused (ISS-2147). Nothing here
   needs a checkout, so the hook holds wherever a dispatch is made. */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { configDir } from "../resolve/config.mjs";

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

const pruned = (dir, now) => {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const one of names) {
    if ((ageOf(join(dir, one), now) ?? 0) > FRESH_MS) rmSync(join(dir, one), { recursive: true, force: true });
  }
};

/** Keep what `session` was shown, dropping every record past its window on the way. */
export const keepBrief = (session, text, now = Date.now()) => {
  const store = storeOf(session);
  pruned(join(store, ".."), now);
  pruned(store, now);
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, digestOf(text)), "");
};

/** Whether `text` is a brief the verb printed for `session` inside the window. */
export const generatedFor = (session, text, now = Date.now()) => {
  const age = ageOf(join(storeOf(session), digestOf(text)), now);
  return age !== null && age <= FRESH_MS;
};
