/* A subagent run as the harness recorded it, read back as pairs of call and result — docs/cli/stats.md. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { VERB_NAMES } from "../resolve/visibility.mjs";
import { TIERS } from "../ladder.mjs";
import { stampedIn } from "../flow/machine.mjs";

export const transcriptBase = () => join(tmpdir(), `claude-${process.getuid?.() ?? 0}`);

export const slugFor = (directory) => directory.replaceAll(/[^a-zA-Z0-9]/gu, "-");

const OUTPUT = /^a\S*\.output$/u;



/* The brief, never the whole file: over the raw text a transcript that had only GREPPED for the
   words was admitted as a run and its search argument read as its claim. The rung below is read off
   a record and not off the words either, for the reasons docs/cli/stats.md carries. */
export const FLOW_BRIEF = /issue-flow/u;

const CONFIRMS = "forge record confirmation";
const CONFIRMED = "confirmation";

export const UNTIERED = "untiered";

/* Which rung a whole run was worked at, off the records its writes posted and never off the output a class covers whole: the-ladder.md. Named apart from `ladder.mjs`'s `tierOf`, which answers for one issue's fields where this reads a transcript, and `UNTIERED` is no rung of the ladder rather than its cheapest. */
export const tierRun = (calls) => {
  const said = calls
    .filter((call) => call.class === CONFIRMS)
    .map((call) => String(stampedIn(call.body ?? "", CONFIRMED, "tier") ?? "").trim().toLowerCase())
    .filter((one) => TIERS.includes(one));
  /* The largest, which is the batch rule: a run of three issues is as heavy as its heaviest. */
  return said.length ? said.reduce((held, one) => (TIERS.indexOf(one) > TIERS.indexOf(held) ? one : held)) : UNTIERED;
};

const namesIn = (directory) => {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
};

export const transcriptsUnder = (root) =>
  namesIn(root)
    .filter((entry) => entry.isDirectory())
    .flatMap((session) => {
      const tasks = join(root, session.name, "tasks");
      return namesIn(tasks)
        .filter((entry) => !entry.isDirectory() && OUTPUT.test(entry.name))
        .map((entry) => ({ session: session.name, path: join(tasks, entry.name) }));
    });

/* Where a command actually starts. A bare space is not a command position: read as one, an echoed
   line was a record and a grep argument a claim, each advancing a phase the run had not reached. */
const LEADS = String.raw`(?:^|[\n;|&(){}])[ \t]*`
  + String.raw`(?:(?:[A-Za-z_][\w.]*=\S*|sudo|time|timeout|env|xargs|do|then|else|if|!)[ \t]+(?:\d+[ \t]+)?)*`;

const at = (what) => new RegExp(LEADS + what, "u");

const FORGE = at(String.raw`(?:\S*/)?forge[ \t]+(?<verb>[a-z][a-z-]*)(?:[ \t]+(?<sub>[a-z][a-z-]*))?`);

/* Two verbs whose actions cost differently enough to earn rows; `forge guide` would be thirteen. */
const SUBBED = new Set(["codex", "record"]);

/* The binary by path and by name is one row, and what follows has to be a verb this CLI has. */
const forgeClass = (shell) => {
  const found = FORGE.exec(shell)?.groups;
  if (!found || !VERB_NAMES.includes(found.verb)) return null;
  if (found.verb === "codex" && found.sub === "consult") {
    return shell.includes("--recheck") ? "forge codex recheck" : "forge codex consult";
  }
  return SUBBED.has(found.verb) && found.sub ? `forge ${found.verb} ${found.sub}` : `forge ${found.verb}`;
};

/* A heredoc carries a document, not shell: read as commands, the criteria files a run writes named
   `npm run check` 423 times, each counted as a gate run that never happened. */
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1(?:[\s\S]*?^[ \t]*\2[ \t]*$|[\s\S]*)/gmu;

export const shellOf = (command) => command.replaceAll(HEREDOC, "<<");

/* The invocation, never the mention: `pgrep -f "tools/run.mjs ship"` is a run WAITING for one. */
const SHIP = at(String.raw`node[ \t]+\S*tools/run\.mjs[ \t]+ship\b`);

export const CLASSES = [
  ["gate", at(String.raw`(?:npm run check|node\s+\S*tools/gates\.mjs)`)],
  ["ship", SHIP],
  ["test", at(String.raw`(?:node --test|npm (?:run )?test|npx vitest|npx playwright)`)],
  ["forge", forgeClass],
  ["git", at(String.raw`git\s`)],
  ["poll", at(String.raw`(?:sleep|until|while|pgrep)\s`)],
  ["edit", /(?:python3|node) - <<|sed -i|(?:^|[\s;&|(])(?:cat|tee)\s+>/u],
  ["read", at(String.raw`(?:cat|sed -n|head|tail|grep|rg|ls|wc|find)\s`)],
];

const TOOL_CLASS = { Read: "read", Grep: "read", Glob: "read", Edit: "edit", Write: "edit", NotebookEdit: "edit" };

export const classOf = (name, shell) => {
  if (name !== "Bash") return TOOL_CLASS[name] ?? name.toLowerCase();
  for (const [label, match] of CLASSES) {
    const found = typeof match === "function" ? match(shell) : match.test(shell) && label;
    if (found) return found;
  }
  return "shell";
};

export const PHASES = ["0 discover", "1 plan", "2 build", "3 review", "4 judge", "5 ship", "6 close"];

/* Off the class the call already has, so the two cannot disagree: no run writes a phase into its
   transcript, and the first call of each kind is where a phase opens. */
export const MARKERS = [
  [1, ["forge claim", "forge record confirmation"]],
  [2, ["forge plan", "forge record plan"]],
  [3, ["forge codex consult"]],
  [4, ["forge record verdict"]],
  [5, ["ship"]],
];

export const markerOf = (label) => MARKERS.find(([, classes]) => classes.includes(label))?.[0] ?? null;

/* A name that is not a string is what a change on the host's side looks like from here. */
const string = (value) => (typeof value === "string" ? value : "");

const textOf = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "object" && part ? part.text ?? "" : "")).join(" ");
};

/** A transcript folded into its calls, the moments it ran between and the brief it opened with. The
 *  bounds are every record's: the opening prompt and the closing report are generation the run
 *  spent, and a window it belongs to. */
export const callsIn = (whole) => {
  const uses = new Map();
  const results = new Map();
  const order = [];
  let firstAt = null;
  let lastAt = 0;
  let brief = "";
  for (const line of whole.split("\n")) {
    if (!line.startsWith("{")) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const stamp = Date.parse(record.timestamp);
    if (!stamp) continue;
    if (firstAt === null) {
      firstAt = stamp;
      brief = textOf(record.message?.content);
    }
    lastAt = Math.max(lastAt, stamp);
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "tool_use") {
        uses.set(block.id, { at: stamp, name: string(block.name) || "Bash", command: string(block.input?.command) });
        order.push(block.id);
      } else if (block?.type === "tool_result") {
        results.set(block.tool_use_id, { at: stamp, body: textOf(block.content), error: Boolean(block.is_error) });
      }
    }
  }
  const calls = order.map((id) => {
    const use = uses.get(id);
    const result = results.get(id);
    const shell = use.name === "Bash" ? shellOf(use.command) : "";
    return {
      at: use.at,
      name: use.name,
      command: use.command,
      shell,
      class: classOf(use.name, shell),
      answered: Boolean(result),
      /* Zero for a call that never returned, neither skipped nor stretched to the next: the hand
         profilers took one of the three each, and a run cut mid-gate is the common case. */
      wait: result ? Math.max(0, result.at - use.at) / 1000 : 0,
      endedAt: result ? result.at : use.at,
      body: result?.body ?? "",
      error: result?.error ?? false,
    };
  });
  return { calls, brief, firstAt, lastAt: Math.max(lastAt, ...calls.map((one) => one.endedAt)) };
};

export const readTranscript = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};
