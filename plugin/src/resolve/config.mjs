/* The account's credentials, this CLI's cache and the run's own identity, kept outside every
   repository at 0600 from the moment the file exists. docs/cli/settings.md. */
import { randomUUID } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

import { idGrantedBy } from "./session/granted-id.mjs";
import { RUN_ID, RUN_ID_VAR, besideGit, runHeldWhere } from "./session/run-id.mjs";

export const configDir = (name) =>
  join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), name);

export const configPath = () => join(configDir("forge"), "config.json");

/* Remembers THAT it ran, not what it returned: a truthiness memo re-runs on a valid null. */
export const once = (produce) => {
  let value;
  let ran = false;
  return (...args) => {
    if (!ran) {
      value = produce(...args);
      ran = true;
    }
    return value;
  };
};

export const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

export const userConfig = once(() => readJson(configPath()) ?? {});

/* `w` sets the mode on create only, so a temp file left by a crashed run would keep its own. The temporary name carries the writer's pid: two processes sharing one would interleave a file the survivor then renames into place, and a writer killed before its rename leaves a file nothing reuses. The next write sweeps it, there being nothing else here that runs to clean up. */
const STRANDED_MS = 60_000;

const sweepStranded = (path) => {
  const room = dirname(path);
  const mine = basename(path);
  try {
    for (const name of readdirSync(room)) {
      if (!name.startsWith(`${mine}.`) || !name.endsWith(".tmp")) continue;
      const full = join(room, name);
      if (Date.now() - statSync(full).mtimeMs > STRANDED_MS) rmSync(full, { force: true });
    }
  } catch {
    /* a directory that cannot be read holds nothing this can clean */
  }
};

export const writeJsonPrivate = (path, value) => {
  const temporary = `${path}.${process.pid}.tmp`;
  sweepStranded(path);
  rmSync(temporary, { force: true });
  const handle = openSync(temporary, "w", 0o600);
  try {
    writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`);
  } finally {
    closeSync(handle);
  }
  renameSync(temporary, path);
};

export const saveConfig = (values) => {
  mkdirSync(configDir("forge"), { recursive: true });
  const merged = { ...userConfig(), ...values };
  writeJsonPrivate(configPath(), merged);
  Object.assign(userConfig(), merged);
  return configPath();
};

/* One key of the config holds an object, and `saveConfig` above merges the top level only — so writing one field of it from a bare object drops every sibling under the same key, which is how a login lost what a login before it had saved. The read, the merge and the save are here, where that limitation is. */
export const saveNested = (key, values) => saveConfig({ [key]: { ...(userConfig()[key] ?? {}), ...values } });

/* Which run this is: the lease's holder and what a session has been shown are both keyed by it. */
export const sessionPath = () => join(configDir("forge"), "session.json");
export const sessionSaved = () => readJson(sessionPath())?.session || null;

/* Where an id came from is half the answer, and this is the one place that says so: a second copy
   of this table is how two readers disagree about whose an id is (ISS-445). */
export const INHERITED = "inherited";

export const INHERITED_MEANS =
  "the session that dispatched this run, and every agent it dispatched carries the same value, so "
  + "an id matching it names a wave and not a run";

/** Named without a command: what sets it is a project's business, and this plugin cannot see one. */
export const OWN_ID = `Give each run an id of its own in ${RUN_ID_VAR}.`;

/** A tree that names its own run, which is what a run standing in it holds instead of the wave's, and above it the id a run was handed rather than found, which outranks every tree. */
export const WORKTREE = "worktree";
export const ASKED = "asked";

/* Ordered, first row holding an id wins. Each carries its own `said`, so a row added here needs no
   edit elsewhere; `environment` marks the two a process was handed rather than found, and `granted`
   is neither, being read off an event about a process that has not started. */
const SOURCES = [
  {
    source: "granted",
    read: (ev) => idGrantedBy(ev?.tool_input?.command),
    said: () => "FORGE_SESSION_ID — the command this call is judging grants it to the run inside it",
  },
  {
    source: ASKED,
    read: () => process.env.FORGE_SESSION_ID || null,
    said: () => "FORGE_SESSION_ID — this run says which run it is",
    environment: true,
  },
  {
    source: WORKTREE,
    read: (ev) => runHeldWhere(ev).id,
    said: (ev) => `${besideGit(runHeldWhere(ev).at, RUN_ID)} — the tree this write stands in names `
      + "its own run, so no variable had to be carried to it",
  },
  {
    source: INHERITED,
    read: () => process.env.CLAUDE_CODE_SESSION_ID || null,
    said: () => `CLAUDE_CODE_SESSION_ID — ${INHERITED_MEANS}. ${OWN_ID}`,
    environment: true,
  },
  {
    source: "event",
    read: (ev) => ev?.session_id || null,
    said: () => "the hook event this call is answering, which names the session that made it",
  },
  {
    source: "saved",
    read: sessionSaved,
    said: () => `${sessionPath()} — this machine's, kept across sessions`,
  },
];

/* Read without minting: a reader asking whose lease this is must not write a file to find out. An
   event outranks the saved id, which outlives a run and would credit one run's reading to another. */
export const sessionSourced = (ev = null) => {
  for (const row of SOURCES) {
    const id = row.read(ev);
    if (id) return { id, source: row.source, said: row.said(ev), environment: Boolean(row.environment) };
  }
  return { id: null, source: null, said: null, environment: false };
};

export const sessionAsked = () => {
  const { id, environment } = sessionSourced();
  return environment ? id : null;
};

export const sessionHeld = () => sessionSourced().id;

export const sessionOf = () => {
  const held = sessionHeld();
  if (held) return held;
  const minted = `machine-${randomUUID()}`;
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    writeJsonPrivate(sessionPath(), { session: minted });
  } catch {
    /* An id that cannot be saved is a holder for this process alone, never a failed call. */
  }
  return minted;
};

export const MINTED = "minted";

/* No row above answered, said in a word: a blank meaning "nobody asked" reads like one a writer forgot. */
export const NO_SESSION = "none";

/* The id a write goes under and where it came from, in one answer, and the one source no row above reads: `sessionOf` saves what it mints, so a source asked for after it would say `saved` about an id that did not exist a call earlier. */
export const sessionWriting = () => {
  const held = sessionSourced();
  return held.id ? { id: held.id, source: held.source } : { id: sessionOf(), source: MINTED };
};
