/* `~/.local/bin/forge` is one file for the machine and every session types it, so it names no copy of
   its own: it runs the plugin root the session's own start wrote into that session's environment,
   and outside any session the installed copy it was written with. A link there named whichever
   session started last, and two sessions on two copies took it from each other at every start
   (FB-430). docs/cli/the-way-in.md. */
import { appendFileSync, existsSync, lstatSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync }
  from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

import { hereCopy, installedToRun, nameAt } from "../plugin-copy.mjs";

/** The variable a session's start sets to that session's plugin root. */
export const ROOT_VAR = "FORGE_PLUGIN_ROOT";
const MARK = "# forge-plugin dispatcher";
const DISPATCH = join("src", "dispatch.mjs");
const ENTRIES = { forge: "src/cli.mjs", "vi-natural": "vi-natural/cli.mjs" };
/** The commands put on PATH, each by its own dispatcher. */
export const ON_PATH = Object.keys(ENTRIES);

const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`;
const FALLBACK = /^FALLBACK='((?:[^']|'\\'')*)'$/mu;

/** The dispatcher's text: the session's root, else `fallback`, refused by name where neither runs. */
const dispatcherText = (name, fallback) => [
  "#!/usr/bin/env sh",
  `${MARK}, written and rewritten by this plugin's SessionStart hook; docs/cli/the-way-in.md.`,
  `# A session's start sets ${ROOT_VAR} to its own plugin root; outside one, the installed copy below.`,
  `FALLBACK=${quoted(fallback ?? "")}`,
  `ROOT="\${${ROOT_VAR}:-$FALLBACK}"`,
  "FROM=\"the installed copy this dispatcher names\"",
  `[ -n "\${${ROOT_VAR}}" ] && FROM="this session's ${ROOT_VAR}"`,
  "if [ -z \"$ROOT\" ]; then",
  `  echo "${name}: ${ROOT_VAR} is unset here and no installed copy was recorded when $0 was written:`
    + ` run it from a session this plugin is loaded in, or install the plugin." >&2`,
  "  exit 127",
  "fi",
  "if [ ! -f \"$ROOT/src/dispatch.mjs\" ]; then",
  `  echo "${name}: $ROOT, read from $FROM, holds no src/dispatch.mjs, so it is no copy to run:`
    + " restart the session, or run node on a copy's src/cli.mjs by its path.\" >&2",
  "  exit 127",
  "fi",
  `exec node "$ROOT/src/dispatch.mjs" ${ENTRIES[name]} "$@"`,
  "",
].join("\n");

const text = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

/** The dispatcher at `path` and the fallback it names, or null where the file is no dispatcher of ours. */
export const dispatcherAt = (path) => {
  const held = text(path);
  if (!held?.includes(MARK)) return null;
  const fallback = held.match(FALLBACK)?.[1].replaceAll("'\\''", "'") ?? "";
  return { text: held, fallback: fallback || null };
};

const runs = (root) => Boolean(root) && existsSync(join(root, DISPATCH));

/* Never a copy loaded by path: that one is a session's, and every other session would run it. An
   install record that no longer resolves keeps the copy already named, while that one still runs. */
const fallbackFor = (root, held) => installedToRun(DISPATCH, root)?.dir
  ?? (runs(held?.fallback) ? held.fallback : null);

/** Puts the dispatcher for `name` at `path`, over our own or over a link — a link is what every
 *  earlier release wrote there. Anything else is somebody's install: named, and left. */
export const placeDispatcher = (path, name, root) => {
  let held = null;
  try {
    held = lstatSync(path);
  } catch {
    /* nothing there yet */
  }
  const ours = held && !held.isSymbolicLink() ? dispatcherAt(path) : null;
  if (held && !held.isSymbolicLink() && !ours) {
    return `${path} exists and is no link and no dispatcher of this plugin's: \`${name}\` on PATH is not this plugin's.\n`;
  }
  const wanted = dispatcherText(name, fallbackFor(root, ours));
  if (ours?.text === wanted) return "";
  const temp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, wanted, { mode: 0o755 });
    renameSync(temp, path);
  } catch {
    /* a dispatcher we cannot write is not worth failing a session start over */
    try {
      unlinkSync(temp);
    } catch {
      /* never written */
    }
  }
  return "";
};

/** Tells the session its own root: Claude Code sources this file before each of the session's commands. */
export const tellSession = (root, file = process.env.CLAUDE_ENV_FILE) => {
  if (!file) return;
  try {
    appendFileSync(file, `export ${ROOT_VAR}=${quoted(resolve(root))}\n`);
  } catch {
    /* a session we cannot tell falls back to the installed copy, which the doctor row names */
  }
};

const firstOnPath = (name, path) => {
  for (const dir of (path ?? "").split(delimiter)) {
    const at = dir ? join(dir, name) : null;
    try {
      if (at) return { at, held: lstatSync(at) };
    } catch {
      /* not in this directory */
    }
  }
  return null;
};

/** What a typed `name` reaches from `path` in a session whose start wrote `session`: the first on
 *  PATH, how it chose its copy, and which. */
export const typedReach = ({ name = "forge", path = process.env.PATH, session = process.env.FORGE_PLUGIN_ROOT } = {}) => {
  const first = firstOnPath(name, path);
  if (!first) return null;
  const { at, held } = first;
  if (held.isSymbolicLink()) {
    let root = null;
    try {
      root = resolve(dirname(realpathSync(at)), "..");
    } catch {
      return { at, how: "dangling", root: null };
    }
    return nameAt(root) ? { at, how: "link", root, version: hereCopy(root).version } : { at, how: "foreign", root: null };
  }
  const ours = dispatcherAt(at);
  if (!ours) return { at, how: "foreign", root: null };
  const named = session || null;
  const root = named ?? ours.fallback;
  return { at, how: named ? "session" : "fallback", root, runs: runs(root), version: root ? hereCopy(root).version : null };
};

/** The doctor's row for what a typed `forge` reaches, against the copy the session itself loaded. */
export const reachRow = (reach, session) => {
  const label = "dispatcher on PATH";
  if (!reach) return { level: "miss", label, detail: "no `forge` on PATH — `~/.local/bin` is not on it, or no session start has written it" };
  if (reach.how === "foreign" || reach.how === "dangling") {
    return { level: "miss", label, detail: `${reach.at} is ${reach.how === "dangling" ? "a link to nothing" : "not this plugin's"}: a typed \`forge\` does not reach this plugin` };
  }
  const at = `${reach.version ?? "?"} at ${reach.root}`;
  if (reach.how === "link") {
    const other = session && resolve(session) !== resolve(reach.root);
    return { level: other ? "miss" : "note", label, detail: `${at} — ${reach.at} is a link the last session to start wrote`
      + (other ? `, not this session's ${session}: a typed \`forge\` runs the other copy until a session of this release starts` : ", and it moves whenever another starts") };
  }
  if (!reach.runs) return { level: "miss", label, detail: `${reach.root ?? "nothing"} — the dispatcher at ${reach.at} names it and it holds no ${DISPATCH}: a typed \`forge\` refuses` };
  return { label, detail: `${at} — ${reach.how === "session"
    ? `this session's own copy, read off ${ROOT_VAR}, which its start wrote`
    : `${ROOT_VAR} is unset here, so the installed copy the dispatcher at ${reach.at} names`}` };
};
