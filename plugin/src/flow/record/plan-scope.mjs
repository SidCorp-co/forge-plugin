/* What the issues a tree holds say their change may write, so a gate on the write can ask it without a call to the tracker. The key is the tree and never a session id, for the reason `runHeldWhere` in `resolve/session/run-id.mjs` gives: the tree is the one thing a hook event and the run's own CLI agree on. */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { configDir, readJson, writeJsonPrivate } from "../../resolve/config.mjs";
import { repoRoot } from "../../git/repo-root.mjs";

/** How long an entry answers for. A lease outlives no window and no window outlives a day: past it a plan neither refuses a path nor admits one, which is the same answer as a tree nobody has claimed in. */
export const SCOPE_KEPT_MS = 86_400_000;

export const scopeDir = () => join(configDir("forge"), "plan-scope");

const named = (tree) => createHash("sha1").update(String(tree)).digest("hex").slice(0, 16);

/** One file per issue per tree, so no writer ever reads a set it then writes back: a whole-file rewrite is how a later save puts back a scope an earlier one had already corrected, and a writer that touches only its own issue's file has no such window to lose. */
export const scopePath = (tree, ref) => join(scopeDir(), `${named(tree)}-${String(ref).toUpperCase()}.json`);

const GONE = new Set(["closed", "dropped"]);

const stale = (at, now) => now - (statSync(at, { throwIfNoEntry: false })?.mtimeMs ?? now) >= SCOPE_KEPT_MS;

const filesFor = (tree, now) => {
  const out = [];
  try {
    for (const one of readdirSync(scopeDir())) {
      const at = join(scopeDir(), one);
      if (stale(at, now)) rmSync(at, { force: true });
      else if (one.startsWith(`${named(tree)}-`)) out.push(at);
    }
  } catch {}
  return out;
};

/* A file nothing wrote inside the window holds a plan past it, which reads as no plan at all, so the listing above takes it. A save that can neither write its file nor remove it is the one case where a correction lands and the write it clears stays refused, so the caller is told: the old text names fewer paths than the record now does, and no entry at all is what stands a gate down. Where even the removal fails nothing further is this module's, and `developed` still reads the rule. That case is the whole of what `false` means here, and every writer below answers the same question so the caller never has to guess which one it got: does the directory now say what this call meant it to say. A call naming no tree, a reference with no entry, and an entry the sweep already owns all leave nothing disagreeing with the record, so all of them are `true` — the caller has nothing it could act on, and the only advice this module's failure carries stands a working gate down. */
const saved = (tree, ref, row) => {
  const at = scopePath(tree, ref);
  try {
    mkdirSync(scopeDir(), { recursive: true });
    if (row) writeJsonPrivate(at, row);
    else rmSync(at, { force: true });
    return true;
  } catch {
    try {
      rmSync(at, { force: true });
    } catch {}
    return false;
  }
};

/** What `namedIn` gave for one issue, against the tree it is being worked in — the caller's own directory, since a run's writes and its records stand in one tree. A tree this cannot name writes nothing, and so does a call with no reference. */
export const noteScope = (ref, text, { tree = repoRoot(process.cwd()), now = Date.now() } = {}) => {
  if (!tree || !ref) return true;
  filesFor(tree, now);
  return saved(tree, ref, { tree, ref: String(ref).toUpperCase(), at: new Date(now).toISOString(), named: String(text ?? "") });
};

/** An issue this tree no longer holds. The entry goes rather than emptying, an issue with no plan and an issue that is gone being two different silences. Nothing to remove is this call's success and not its failure: the entry the record wanted gone is gone, and so is one the sweep already owns. */
export const dropScope = (ref, { tree = repoRoot(process.cwd()), now = Date.now() } = {}) => {
  if (!tree || !ref) return true;
  const at = scopePath(tree, ref);
  if (!statSync(at, { throwIfNoEntry: false }) || stale(at, now)) return true;
  return saved(tree, ref, null);
};

/** Every issue this tree holds, newest first, each with the text `namedIn` gave for it. */
export const scopeHeld = (tree, now = Date.now()) => {
  if (!tree) return [];
  return filesFor(tree, now)
    .map((at) => readJson(at))
    .filter((one) => one && typeof one === "object" && one.ref)
    .map((one) => ({ ref: String(one.ref), named: String(one.named ?? ""), at: String(one.at ?? "") }))
    .filter((one) => now - (Date.parse(one.at) || 0) < SCOPE_KEPT_MS)
    .sort((one, two) => (one.at > two.at ? -1 : Number(one.at < two.at)));
};

/** One issue's scope as its record now stands: the text where the issue is still being worked, and no entry at all where it has left the ladder. */
export const scopeFrom = (status, ref, text, options) =>
  (GONE.has(status) ? dropScope(ref, options) : noteScope(ref, text, options));
