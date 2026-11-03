/* What the brief verb printed, kept as a digest per session so the hook can tell a message the verb
   generated from one somebody typed. A match on the whole text is the one reading no added sentence
   survives; a reading of its words was refused (ISS-2147). Nothing here needs a checkout, so the hook
   holds wherever a dispatch is made. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { reap } from "../rooms/reap.mjs";

/* A brief is readings taken now: ten minutes is long enough to send one, and short enough that what
   a tree held has not moved under it. */
export const FRESH_MS = 10 * 60_000;

const NO_SESSION = "none";

// cm:why the pin ignores the two-space-indented heldLine readings — the other trees' held files, read now, that moved and refused an as-printed brief — so a sibling moving, added or removed leaves it whole; only those lines, so a line added anywhere else still breaks it (ISS-30)
const INDENTED = /^ {2}\S/u;
const stable = (text) => String(text ?? "").split("\n").filter((line) => !INDENTED.test(line)).join("\n");
const digestOf = (text) => createHash("sha256").update(stable(text).trim()).digest("hex");

// cm:guard the brief store roots at HOME, never XDG_CONFIG_HOME or TMPDIR — a borrow resets XDG and the scratch system resets TMPDIR, HOME neither, so verb and hook agree where either had the hook miss a byte-identical brief (ISS-29); reaped, so .cache fits it.
const briefRoot = () => join(homedir(), ".cache", "forge", "briefs");

/* A session id is a path segment here, so anything but its own alphabet is refused as none. */
const storeOf = (session) =>
  join(briefRoot(), /^[\w-]+$/u.test(String(session ?? "")) ? session : NO_SESSION);

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
