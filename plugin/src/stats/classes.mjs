/* What one call of a transcript was — the classifier and the wrong rows it was built to avoid: docs/cli/stats-rows.md. */
import { DEFAULT } from "../guides/flow.mjs";
import { VERB_NAMES } from "../resolve/visibility.mjs";
import { handledBy } from "../resolve/handler.mjs";
import { projectFileAt } from "../resolve/settings.mjs";

/* Where a command actually starts. A bare space is not a command position: read as one, an echoed line was a record and a grep argument a claim, each advancing a phase the run had not reached. */
const LEADS = String.raw`(?:^|[\n;|&(){}])[ \t]*`
  + String.raw`(?:(?:[A-Za-z_][\w.]*=\S*|sudo|time|timeout|env|xargs|do|then|else|if|!)[ \t]+(?:\d+[ \t]+)?)*`;

const at = (what) => new RegExp(LEADS + what, "u");

/* One spelling of the call for both readings below — the binary, the verb, the word after it and the word after that. The guide reading fixes the verb rather than filtering the first call, so a `forge guide` later in a compound command is still the part that run read. A sub is that second word as a verb name reads it, stopping at the first character no verb carries, where a slug and its part are read whole: one token, two word classes. */
const CALL = (verb) => String.raw`(?:\S*/)?forge[ \t]+${verb}`
  + String.raw`(?:[ \t]+(?<slug>[a-z][\w-]*)(?:[ \t]+(?<part>[a-z][\w-]*))?)?`;
const FORGE = at(CALL(String.raw`(?<verb>[a-z][a-z-]*)`));
const SUB_WORD = /^[a-z][a-z-]*/u;

const SUBBED = new Set(["codex", "record"]);

/** The consult reading every file the change touched, which is the pass a review is earned by. Told by the flag and never by a `codex.send` setting, which no transcript records: docs/cli/stats-rows.md. */
export const WHOLE_SET_CLASS = "forge codex whole-set";
const WHOLE_SET = /--send[= \t]+bodies\b/u;

const forgeClass = (shell) => {
  const found = FORGE.exec(shell)?.groups;
  if (!found) return null;
  /* A form is a `forge` command, classed by the word typed: read as a verb it is none, so `forge close` fell to `shell` and the tool-seconds table filed it under nothing (ISS-704). */
  if (handledBy(found.verb)) return `forge ${found.verb}`;
  if (!VERB_NAMES.includes(found.verb)) return null;
  const sub = found.slug ? SUB_WORD.exec(found.slug)?.[0] : undefined;
  if (found.verb === "codex" && sub === "consult") {
    if (shell.includes("--recheck")) return "forge codex recheck";
    return WHOLE_SET.test(shell) ? WHOLE_SET_CLASS : "forge codex consult";
  }
  return SUBBED.has(found.verb) && sub ? `forge ${found.verb} ${sub}` : `forge ${found.verb}`;
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

/** What a checkout says its own gate, test and ship are, off the project file that directory resolves to, so `--checkout` reads the profiled project's commands and not this process's. */
export const DECLARES = "stats.commands";
export const DECLARABLE = ["gate", "ship", "test"];
export const declaredIn = (directory) => projectFileAt(directory)?.stats?.commands ?? null;

/* This repository's own commands, and the fallback for every project that declares none, so a reading taken here does not move. The ship one is the invocation and never the mention: `pgrep -f "tools/run.mjs ship"` is a run WAITING for one. */
const BUILT_IN = {
  gate: String.raw`(?:npm run check|node\s+\S*tools/gates\.mjs)`,
  ship: String.raw`node[ \t]+\S*tools/run\.mjs[ \t]+ship\b`,
  test: String.raw`(?:node --test|npm (?:run )?test|npx vitest|npx playwright)`,
};

const ESCAPED = /[.*+?^${}()|[\]\\]/gu;

/* A declared command is matched as the text the project typed and nothing is read out of its shape: guessing that any script named `gates.mjs` is a gate is how a profiler starts counting a project's unrelated tooling (ISS-1586). */
export const declares = (label, declared) => {
  const said = declared?.[label];
  const many = (Array.isArray(said) ? said : [said]).filter((one) => typeof one === "string" && one.trim());
  return many.length ? `(?:${many.map((one) => one.trim().replaceAll(ESCAPED, String.raw`\$&`)).join("|")})` : null;
};

/** The class table a corpus is read by. A declaration REPLACES the built-in pattern for its class rather than joining it: a project that has said what its gate is has said what its gate is. */
export const classesFor = (declared = null) => [
  ...DECLARABLE.map((label) => [label, at(declares(label, declared) ?? BUILT_IN[label])]),
  ["forge", forgeClass],
  ["git", at(String.raw`git\s`)],
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
