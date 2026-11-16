// Teach once at a write to a file an open session cannot pick up: the ship names these at the end
// of a run, hours after the decision that put the text there. how/restart-owed.md says why.

import { dirname, join, relative, resolve } from "node:path";

import { askedAlready, context, done, how, lastRecords, logged, named, ownTranscript, settled, shellWrites, writtenPaths } from "../_hook.mjs";
import { FROZEN, copyToRun, freezesSession } from "../../src/tools/plugin-copy.mjs";

/** The repository-relative name `freezesSession` reads — the set is its and nothing here narrows or widens it — or null where the write is not in a checkout of this plugin at all. A marketplace `source` is one directory below the checkout root, which is what `copyToRun` answers with and what this reads the root back off. */
const held = new Map();
const inCheckout = (path) => {
  const at = dirname(path);
  if (!held.has(at)) {
    const chosen = copyToRun({ cwd: at });
    held.set(at, chosen.kind === "checkout" ? dirname(chosen.dir) : null);
  }
  const root = held.get(at);
  if (!root) return null;
  const rel = relative(root, path);
  return rel && !rel.startsWith("..") ? rel : null;
};

/* A necessary condition, asked first because it costs nothing: a repository-relative name in the set
   is a tail of the absolute path, so a path holding none of them cannot be one, and the walk for a
   marketplace above it — which every write in every project pays — is not made at all. */
const couldBe = (path) => FROZEN.some((one) => path.includes(one));

const frozen = (path, here) => {
  const full = resolve(here, path);
  if (!couldBe(full)) return null;
  const rel = inCheckout(full);
  return rel && freezesSession(rel) ? rel : null;
};

/** What the agent said just before this write, kept so the ship can print it beside the file. The transcript read is the writing run's own and never the one a delegated run's event hands it, which is the dispatcher's and whose last line is about another issue (ISS-510). A transcript this cannot read leaves the line empty rather than holding the write. */
const lineGiven = (ev) => {
  const records = lastRecords(ownTranscript(ev)) ?? [];
  /* The write is the last record and carries no text, so the line is behind it; a record that is not the agent's is a tool's answer, and what was said before it was not said about this write. */
  for (let at = records.length - 1; at >= 0 && records[at]?.type === "assistant"; at -= 1) {
    const said = (records[at].message?.content ?? [])
      .filter((one) => one?.type === "text")
      .map((one) => String(one.text ?? ""))
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
    if (said) return said;
  }
  return "";
};

const NO_LINE = "no line given";

// cm:why two notes per file a session at most, the line before the first write and the one the teaching asks for before the next; the ship prints the latest
const answer = (ev, rel) => {
  if (askedAlready(ev, `${rel} noted`, "restart-owed")) return;
  const said = lineGiven(ev);
  if (said) logged("note", said, rel);
};

const teach = (ev, rel) => {
  const said = lineGiven(ev) || NO_LINE;
  logged("note", said, rel);
  context(
    "Say in one line why no live home fits before your next write to this file: that line replaces the one "
      + "recorded below. A rule with a checker belongs under `plugin/src/`, where the CLI serves it live; "
      + "method text in a guide; a reason in a `--how` page.\n\n"
      + `\`${rel}\` is in the restart set: it reaches a session only at its next start, and every `
      + "open session runs the old copy until then. Recorded as the reason, which the release prints beside "
      + `the file: ${said === NO_LINE ? NO_LINE : `"${said}"`}. Said once per file a session.`
      + how(),
  );
};

export const run = (ev) => {
  const tool = ev.tool_name ?? "";
  const ti = ev.tool_input ?? {};

  /* A read of a guarded path is not a write, so the shell route counts a write shape beside the name and a name inside a sentence counts as nothing (ISS-302). Where the command names a tree it could be standing in, only that tree answers: the shared reading keeps the bare token beside it for a caller that judges the spelling, and taking it here would refuse `cd elsewhere && … plugin/hooks/hooks.json` for this checkout's file. */
  const here = ev.cwd || process.cwd();
  const aimed =
    tool === "Bash"
      ? writtenPaths(shellWrites(ti.command), here)
        .flatMap((one) => (one.trees.length ? one.trees.map((tree) => join(tree, one.token)) : [one.token]))
      : named(ev);

  for (const path of aimed) {
    const rel = frozen(path, here);
    if (!rel) continue;
    if (askedAlready(ev, settled(path), "restart-owed")) {
      answer(ev, rel);
      continue;
    }
    teach(ev, rel);
  }
  done();
};
