/* What one call of a transcript was — the classifier and the wrong rows it was built to avoid: docs/cli/stats-rows.md. */
import { DEFAULT } from "../../guides/flow.mjs";
import { VERB_NAMES } from "../../resolve/visibility.mjs";
import { handledBy } from "../../resolve/handler.mjs";
import { DECLARABLE, at, declares } from "./declared.mjs";
import { HELP_WORD_PATTERN } from "../../resolve/help-word.mjs";
import { WAITS_ON_PID } from "../../hooks/wait-idiom.mjs";

/* One spelling of the call for both readings below — the binary, the verb, the word after it and the word after that. The guide reading fixes the verb rather than filtering the first call, so a `forge guide` later in a compound command is still the part that run read. A sub is that second word as a verb name reads it, stopping at the first character no verb carries, where a slug and its part are read whole: one token, two word classes. `knowledge` is subbed because the store is read in phase 0 and written in the last phase, and one row over both filed a run's opening read under what it learned (ISS-1714). */
const CALL = (verb) => String.raw`(?:\S*/)?forge[ \t]+${verb}`
  + String.raw`(?:[ \t]+(?<slug>[a-z][\w-]*)(?:[ \t]+(?<part>[a-z][\w-]*))?)?`;
const FORGE = at(CALL(String.raw`(?<verb>[a-z][a-z-]*)`));
const SUB_WORD = /^[a-z][a-z-]*/u;

const SUBBED = new Set(["codex", "knowledge", "record"]);

/** The prefix every row naming a verb of this CLI carries, so a reader counting those rows and the classifier minting them agree on which they are. */
export const FORGE_ROW = "forge ";
const row = (...words) => FORGE_ROW + words.filter(Boolean).join(" ");

/** The consult reading every file the change touched, which is the pass a review is earned by. Told by the flag and never by a `codex.send` setting, which no transcript records: docs/cli/stats-rows.md. */
export const WHOLE_SET_CLASS = row("codex", "whole-set");
const WHOLE_SET = /--send[= \t]+bodies\b/u;

/* Minting the name, apart from whichever pattern found it, so a lookup of a verb's help is filed in the row that verb's own work is filed in rather than in one spelled beside it. */
const classFor = (verb, slug, shell) => {
  /* A form is a `forge` command, classed by the word typed: read as a verb it is none, so `forge close` fell to `shell` and the tool-seconds table filed it under nothing (ISS-704). */
  if (handledBy(verb)) return row(verb);
  if (!VERB_NAMES.includes(verb)) return null;
  const sub = slug ? SUB_WORD.exec(slug)?.[0] : undefined;
  if (verb === "codex" && sub === "consult") {
    if (shell.includes("--recheck")) return row("codex", "recheck");
    return WHOLE_SET.test(shell) ? WHOLE_SET_CLASS : row("codex", "consult");
  }
  return SUBBED.has(verb) && sub ? row(verb, sub) : row(verb);
};

const forgeClass = (shell) => {
  const found = FORGE.exec(shell)?.groups;
  return found ? classFor(found.verb, found.slug, shell) : null;
};

/* A help read is the help word standing whole in the verb's own slot or in the slot after its subject, so a call inside a pipeline or after a `cd` counts and a `-h` a run typed into a `--why` or a `--note` does not. Whether the subject is one that verb has is not asked and cannot be: each verb declares its own list and none is reachable from here — docs/cli/stats-the-help-reads.md carries what that costs. The word is inside the pattern rather than captured and tested after it, so a prose flag on an earlier command does not hide a real read on a later one. */
const HELP = at(String.raw`(?:\S*/)?forge[ \t]+(?<verb>[a-z][a-z-]*)`
  + String.raw`(?:[ \t]+(?<slug>[a-z][\w-]*))?[ \t]+` + HELP_WORD_PATTERN);

/** Whose help a call read, as the row the class table already names that verb, or null where it read none. Which slots answer is `resolve/help-word.mjs`'s and not this reading's: the two go on agreeing only while this asks the same question. */
export const helpReadOf = (shell) => {
  const found = HELP.exec(shell)?.groups;
  return found ? classFor(found.verb, found.slug, shell) : null;
};

export const GUIDE_INDEX = "(index)";

/* The class table keeps `forge guide` one row; which part a run read is a table of its own. */
const GUIDE = at(CALL("guide"));

export const guidePartOf = (shell) => {
  const found = GUIDE.exec(shell)?.groups;
  if (!found) return null;
  return [found.slug, found.part].filter(Boolean).join(" ") || GUIDE_INDEX;
};

/* Off the line the part ends with, never this copy's own flow — which for an older transcript would be this machine's configuration passed off as that run's fact (ISS-673). The second shape is the retired key's, read as the flow it named, so an older window is a window (ISS-902). */
const SERVED_FLOW = /^Flow ([a-z][a-z0-9-]*), which this project runs/mu;
const SERVED_METHOD = /^Method version 1, which this project runs;/mu;

export const guideFlowOf = (body) => {
  const held = String(body ?? "");
  return SERVED_FLOW.exec(held)?.[1] ?? (SERVED_METHOD.test(held) ? DEFAULT : null);
};

export const POLL = "poll";

/** The one-call wait this plugin prescribes for work already running, which is neither a poll — it
 *  asks once and comes back — nor a read of a file, and whose discriminator is `wait-idiom.mjs`'s. */
export const WAIT = "wait";

/** The generation of the table below. A row added or removed, or a pattern changed so that a call
 *  moves from one row to another, is a new generation; a reading carries the one that classed it, so
 *  a window read at one is never compared row by row with a window read at another. */
export const TABLE = 2;

/** The generation each row's population last changed at, for the rows that have changed since this
 *  number existed; a row absent from here has stood throughout. Only the last change matters: a row
 *  is comparable with a reading held at generation `g` exactly where this is at or below `g`. Two
 *  things keep that sound: a row taken out of the table keeps its entry, an older reading still
 *  holding figures under that label; and a row that takes another's calls is stamped at the
 *  generation it took them, its population having moved though its pattern did not.
 *
 *  This number answers for the table below and for nothing a project said. The four rows
 *  `DECLARABLE` names are classed by a project's own words, so their populations move when those
 *  words do with this number unmoved — `declaredSaid` is what a reading carries for that half, and
 *  the two are read together or a redeclared gate reads as a gate that got slower (ISS-2086). */
export const MOVED_AT = new Map([["read", 2], [POLL, 2], [WAIT, 2]]);

const VERB_ENDS = String.raw`(?![\w-])`;

/* This repository's own commands, and the fallback for every project that declares none, so a reading taken here does not move. The ship one and the cleanup one are the invocation and never the mention, which is what the leading binary buys: `pgrep -f "tools/run.mjs ship"` is a run WAITING for one. Each stops where a verb name stops and not at a word boundary, which ends a word at a hyphen and would read the sibling verb this repository ships, `land-ready`, as `land` (ISS-1714). */
const BUILT_IN = {
  cleanup: String.raw`node[ \t]+\S*tools/run\.mjs[ \t]+finish` + VERB_ENDS,
  gate: String.raw`(?:npm run check|node\s+\S*tools/gates\.mjs)`,
  ship: String.raw`node[ \t]+\S*tools/run\.mjs[ \t]+ship` + VERB_ENDS,
  test: String.raw`(?:node --test|npm (?:run )?test|npx vitest|npx playwright)`,
};

/** The class table a corpus is read by. A declaration REPLACES the built-in pattern for its class rather than joining it: a project that has said what its gate is has said what its gate is. */
export const classesFor = (declared = null) => [
  ...DECLARABLE.map((label) => [label, at(declares(label, declared) ?? BUILT_IN[label])]),
  ["forge", forgeClass],
  ["git", at(String.raw`git\s`)],
  /* Above `poll` because half this idiom's calls carry on the same line the `pgrep` that found the
     pid, and read as polls they put the prescribed one-call wait in the row that counts the
     refusable kind: 2166 of `poll`'s 2814 tool-minutes on this project's 601-run corpus. Below the
     declared rows, `forge` and `git` because a line that starts the ship or the gate and then waits
     on it is that launch, and `ship` and `cleanup` are what open a phase. Below `read` the `tail` in
     that row's alternation shadows it, which is 1876 of `read`'s 3518 tool-minutes filed as reading
     (ISS-2086). */
  [WAIT, at(WAITS_ON_PID)],
  [POLL, at(String.raw`(?:sleep|until|while|pgrep)\s`)],
  ["edit heredoc", at(String.raw`(?:python3|node) - <<`)],
  ["edit sed", at(String.raw`sed -i\s`)],
  ["edit file", at(String.raw`(?:cat|tee)\s+>`)],
  ["read", at(String.raw`(?:cat|sed -n|head|tail|grep|rg|ls|wc|find)\s`)],
];

export const CLASSES = classesFor();

const TOOL_CLASS = { Read: "read", Grep: "read", Glob: "read", Edit: "edit", Write: "write", NotebookEdit: "edit" };

export const EDIT_ROUTES = ["edit", "write", "edit heredoc", "edit file", "edit sed"];

export const classOf = (name, shell, classes = CLASSES) => {
  if (name !== "Bash") return TOOL_CLASS[name] ?? name.toLowerCase();
  for (const [label, match] of classes) {
    const found = typeof match === "function" ? match(shell) : match.test(shell) && label;
    if (found) return found;
  }
  return "shell";
};
