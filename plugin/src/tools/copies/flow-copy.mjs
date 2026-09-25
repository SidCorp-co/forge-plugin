/* The flow's verbs write the records the tracker's contract and the landing judge, and both answer to
   the installed release, so a checkout cut releases ago must not answer for them. Every other verb
   is the one a checkout is probed with, and stays the checkout's. docs/cli/the-way-in.md. The
   imports are node builtins and the chooser, for the reason `dispatch.mjs` gives. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { copyToRun } from "../plugin-copy.mjs";

/** The verbs whose rules are the installed flow's: the ones reading or writing an issue's record,
 *  and the one serving the contract that record is judged against. The only list of them. */
export const FLOW_VERBS = Object.freeze([
  "claim", "resume", "record", "advance", "issue", "new", "comment", "feedback", "guide",
]);

const CLI = join("src", "cli.mjs");

/** `copyToRun`'s answer, except for a flow verb standing in a checkout with an install that
 *  resolves: that one takes the installed copy and carries the checkout as `tree`. */
export const copyForVerb = ({ verb, entry = CLI, ...where } = {}) => {
  const chosen = copyToRun({ entry, ...where });
  if (entry !== CLI || !FLOW_VERBS.includes(verb) || chosen.kind !== "checkout" || !chosen.installed) return chosen;
  return {
    ...chosen.installed,
    kind: "installed",
    installed: chosen.installed,
    tree: { dir: chosen.dir, version: chosen.version },
    why: "a flow verb runs the flow the installed copy serves, which is the one the tracker's contract"
      + " and the landing answer to, whichever checkout the call stands in",
  };
};

const git = (cwd, args) => {
  const ran = spawnSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return ran.status === 0 ? ran.stdout.trim() : null;
};

const text = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const IMPORTED = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/gu;

/* Relative specifiers only, followed statically: a package or a builtin is not this checkout's. A
   file imported and gone is still loaded by the call, which is how its deletion reaches the answer. */
const graphOf = (starts) => {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!existsSync(file)) return;
    for (const [, spec] of (text(file) ?? "").matchAll(IMPORTED)) walk(resolve(dirname(file), spec));
  };
  starts.forEach(walk);
  return seen;
};

/* A verb the table answers itself has no module of its own: the table is in the CLI's graph. */
const moduleOf = (dir, verb) => {
  const held = (text(join(dir, "src", "commands.mjs")) ?? "")
    .match(new RegExp(String.raw`^  ${verb}: loads\("\.(/[^"]+)"`, "mu"));
  return held ? join(dir, "src", held[1]) : null;
};

/** The files under `tree` a call of any of `verbs` loads that this checkout changed since it and
 *  the installed copy's commit parted: the CLI's static graph, each verb's own, and the guides
 *  every flow verb serves or judges by. Empty where nothing says which commit that is. */
const flowChanges = (chosen, verbs) => {
  const sha = chosen?.tree && chosen.installed?.sha;
  if (!sha) return [];
  const dir = chosen.tree.dir;
  const base = git(dir, ["merge-base", "HEAD", sha]);
  const changed = base && git(dir, ["diff", "--relative", "--name-only", base]);
  if (!changed) return [];
  const starts = [join(dir, CLI), ...verbs.map((verb) => moduleOf(dir, verb)).filter(Boolean)];
  const loaded = graphOf(starts);
  return changed.split("\n").filter((path) => path.startsWith("guides/") || loaded.has(join(dir, path)));
};

const named = (files) => `${files[0]}${files.length > 1 ? ` and ${files.length - 1} more` : ""}`;

/** The line a flow verb's call prints where the checkout it stands in changes what that verb runs,
 *  so a run proving its own change to one is told which copy answered and how to run the other. */
export const flowNote = (chosen, verb) => {
  const files = flowChanges(chosen, [verb]);
  if (!files.length) return null;
  return `forge ${verb}: the installed copy ${chosen.version ?? "?"} answered, and this checkout changes`
    + ` what it runs (${named(files)}); \`${join(chosen.tree.dir, "bin", "forge")} ${verb}\` with the`
    + " same arguments runs this checkout's own.";
};

/** The row `forge doctor` prints for the flow's verbs, beside the one for every other verb. */
export const flowRow = (where = {}) => {
  const chosen = copyForVerb({ verb: FLOW_VERBS[0], ...where });
  const files = flowChanges(chosen, FLOW_VERBS);
  const own = files.length
    ? ` — this checkout changes what they load (${named(files)}), and \`${join(chosen.tree.dir, "bin", "forge")}`
      + " <verb>` runs its own"
    : "";
  return `${chosen.kind} ${chosen.version ?? "?"} at ${chosen.dir} — ${FLOW_VERBS.join(", ")}: ${chosen.why}${own}`;
};
