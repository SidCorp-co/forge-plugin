// Stop once before a write to a file an open session cannot pick up: the ship names these at the end
// of a run, hours after the decision that put the text there. how/restart-owed.md says why.

import { dirname, join, relative, resolve } from "node:path";

import { askedAlready, deny, done, how, logged, settled, shellText, turnRecords, writtenPaths } from "../_hook.mjs";
import { copyToRun, freezesSession } from "../../src/tools/plugin-copy.mjs";

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

const frozen = (path, here) => {
  const rel = inCheckout(resolve(here, path));
  return rel && freezesSession(rel) ? rel : null;
};

/** What the agent said when it re-sent, kept so the ship can print it beside the file. A transcript this cannot read leaves the line empty rather than refusing the write it already asked about. */
const lineGiven = (ev) => {
  const records = turnRecords(ev.transcript_path ?? "") ?? [];
  for (let at = records.length - 1; at >= 0; at -= 1) {
    if (records[at]?.type !== "assistant") continue;
    return (records[at].message?.content ?? [])
      .filter((one) => one?.type === "text")
      .map((one) => String(one.text ?? ""))
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
  }
  return "";
};

/* One note per file per session: the write after the hold is the answer, and every write after that one is the same answer again. */
const note = (ev, rel) => {
  if (askedAlready(ev, `${rel} noted`, "restart-owed")) return;
  logged("note", lineGiven(ev) || "no line given", rel);
};

const hold = (rel) =>
  deny(
    `Hold — \`${rel}\` is in the restart set: it reaches a session only at its next start, and every `
      + "open session runs the old copy until then.\n\n"
      + "Do this: say in one line why no live home fits — a rule with a checker belongs under "
      + "`plugin/src/`, where the CLI serves it live; method text in a guide; a reason in a `--how` "
      + "page — then re-send."
      + how(),
  );

export const run = (ev) => {
  const tool = ev.tool_name ?? "";
  const ti = ev.tool_input ?? {};

  /* A read of a guarded path is not a write, so the shell route counts a write shape beside the name and a name inside a sentence counts as nothing (ISS-302). Where the command names a tree it could be standing in, only that tree answers: the shared reading keeps the bare token beside it for a caller that judges the spelling, and taking it here would refuse `cd elsewhere && … plugin/hooks/hooks.json` for this checkout's file. */
  const here = ev.cwd || process.cwd();
  const aimed =
    tool === "Bash"
      ? writtenPaths(shellText(ti.command), here)
        .flatMap((one) => (one.trees.length ? one.trees.map((tree) => join(tree, one.token)) : one.paths))
      : [ti.file_path ?? ti.notebook_path ?? ""].filter(Boolean);

  for (const path of aimed) {
    const rel = frozen(path, here);
    if (!rel) continue;
    if (askedAlready(ev, settled(path), "restart-owed")) {
      note(ev, rel);
      continue;
    }
    hold(rel);
  }
  done();
};
