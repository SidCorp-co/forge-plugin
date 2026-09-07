/* A subagent run as the harness recorded it, read back as pairs of call and result — docs/cli/stats.md. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { NOTHING, logRead } from "../hooks/log-reads.mjs";
import { VERB_NAMES } from "../resolve/visibility.mjs";
import { TIERS, highest } from "../ladder.mjs";
import { stampedIn } from "../flow/machine.mjs";

export const transcriptBase = () => join(tmpdir(), `claude-${process.getuid?.() ?? 0}`);

export const slugFor = (directory) => directory.replaceAll(/[^a-zA-Z0-9]/gu, "-");

/** Where one project's transcripts sit; the trailing separator is cut first, or one checkout named two ways answers as two corpora. */
export const rootFor = (directory) => join(transcriptBase(), slugFor(directory.replace(/\/+$/u, "") || "/"));

const OUTPUT = /^a\S*\.output$/u;

/* The brief, never the whole file: over raw text a transcript that had only GREPPED the words was admitted as a run, and the rung below is off a record for the same reason — docs/cli/stats.md. */
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
  return said.length ? highest(said) : UNTIERED;
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

/** The consult reading every file the change touched, which is the pass a review is earned by. Told by the flag and never by a `codex.send` setting, which no transcript records: docs/cli/stats-rows.md. */
export const WHOLE_SET_CLASS = "forge codex whole-set";
const WHOLE_SET = /--send[= \t]+bodies\b/u;

/* The binary by path and by name is one row, and what follows has to be a verb this CLI has. */
const forgeClass = (shell) => {
  const found = FORGE.exec(shell)?.groups;
  if (!found || !VERB_NAMES.includes(found.verb)) return null;
  if (found.verb === "codex" && found.sub === "consult") {
    if (shell.includes("--recheck")) return "forge codex recheck";
    return WHOLE_SET.test(shell) ? WHOLE_SET_CLASS : "forge codex consult";
  }
  return SUBBED.has(found.verb) && found.sub ? `forge ${found.verb} ${found.sub}` : `forge ${found.verb}`;
};

/* The class table keeps `forge guide` one row; which part a run read is a table of its own. */
const GUIDE = at(String.raw`(?:\S*/)?forge[ \t]+guide(?:[ \t]+(?<slug>[a-z][\w-]*))?(?:[ \t]+(?<part>[a-z][\w-]*))?`);

export const GUIDE_INDEX = "(index)";

export const guidePartOf = (shell) => {
  const found = GUIDE.exec(shell)?.groups;
  if (!found) return null;
  return [found.slug, found.part].filter(Boolean).join(" ") || GUIDE_INDEX;
};

/* Off the line the part ends with, never this copy's pin — which for a transcript older than the pin
   would be this machine's configuration passed off as that run's fact (ISS-673). */
const SERVED_VERSION = /^Method version (\d+), which this project runs;/mu;

export const guideVersionOf = (body) => SERVED_VERSION.exec(String(body ?? ""))?.[1] ?? null;

/* A heredoc carries a document, not shell: read as commands, the criteria files a run writes named
   `npm run check` 423 times, each counted as a gate run that never happened. */
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1(?:[\s\S]*?^[ \t]*\2[ \t]*$|[\s\S]*)/gmu;

export const shellOf = (command) => command.replaceAll(HEREDOC, "<<");

/* The invocation, never the mention: `pgrep -f "tools/run.mjs ship"` is a run WAITING for one. */
const SHIP = at(String.raw`node[ \t]+\S*tools/run\.mjs[ \t]+ship\b`);

export const POLL = "poll";

export const CLASSES = [
  ["gate", at(String.raw`(?:npm run check|node\s+\S*tools/gates\.mjs)`)],
  ["ship", SHIP],
  ["test", at(String.raw`(?:node --test|npm (?:run )?test|npx vitest|npx playwright)`)],
  ["forge", forgeClass],
  ["git", at(String.raw`git\s`)],
  [POLL, at(String.raw`(?:sleep|until|while|pgrep)\s`)],
  ["edit heredoc", at(String.raw`(?:python3|node) - <<`)],
  ["edit sed", at(String.raw`sed -i\s`)],
  ["edit file", at(String.raw`(?:cat|tee)\s+>`)],
  ["read", at(String.raw`(?:cat|sed -n|head|tail|grep|rg|ls|wc|find)\s`)],
];

const TOOL_CLASS = { Read: "read", Grep: "read", Glob: "read", Edit: "edit", Write: "write", NotebookEdit: "edit" };

/** The routes a run writes a file through, each a class above. */
export const EDIT_ROUTES = ["edit", "write", "edit heredoc", "edit file", "edit sed"];

/** What a call carried, in characters of the model's own output. */
const sizeOf = (name, input) => {
  if (name === "Bash") return string(input?.command).length;
  if (name === "Edit") return string(input?.old_string).length + string(input?.new_string).length;
  if (name === "Write") return string(input?.content).length;
  return 0;
};

export const classOf = (name, shell) => {
  if (name !== "Bash") return TOOL_CLASS[name] ?? name.toLowerCase();
  for (const [label, match] of CLASSES) {
    const found = typeof match === "function" ? match(shell) : match.test(shell) && label;
    if (found) return found;
  }
  return "shell";
};

/* A poll is only in the order, so: off the same function `bash-guard.mjs` refuses with, forgetting
   where that gate forgets — one class here is one refusal there, and the third read is the recovery. */
const polled = (calls) => {
  let before = "";
  for (const call of calls) {
    const key = call.name === "Bash" ? logRead(call.command) : null;
    if (key && key === before) {
      call.class = POLL;
      before = "";
      continue;
    }
    if (key !== NOTHING) before = key ?? "";
  }
  return calls;
};

/* Off the class the call already has, so the two cannot disagree: no run writes a phase into its transcript. `after` is the phase that must have opened first; `last` closes its own phase. The numbers are the method's, read off `PHASES`: this table said 5 for the ship where the contract says 5 for the proving, and a figure is only worth a phase both readings can name (ISS-700). */
export const MARKERS = [
  { phase: 1, classes: ["forge claim"] },
  { phase: 2, classes: ["forge record confirmation"] },
  { phase: 3, classes: ["forge record decision"] },
  { phase: 4, classes: ["forge record plan", "forge record criteria", "forge record baseline"] },
  { phase: 5, classes: [WHOLE_SET_CLASS], after: 4 },
  { phase: 6, classes: ["forge record note"] },
  { phase: 7, classes: ["ship"], last: true },
];

export const markerOf = (label) => MARKERS.find((row) => row.classes.includes(label)) ?? null;

/* A name that is not a string is what a change on the host's side looks like from here. */
const string = (value) => (typeof value === "string" ? value : "");

const textOf = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "object" && part ? part.text ?? "" : "")).join(" ");
};

/** A transcript folded into its calls, the moments it ran between and the brief it opened with. The
 *  bounds are every record's: the opening prompt and the closing report are generation the run spent, and a window it belongs to. */
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
        const name = string(block.name) || "Bash";
        uses.set(block.id, { at: stamp, name, command: string(block.input?.command), size: sizeOf(name, block.input) });
        order.push(block.id);
      } else if (block?.type === "tool_result") {
        results.set(block.tool_use_id, { at: stamp, body: textOf(block.content), error: Boolean(block.is_error) });
      }
    }
  }
  const calls = polled(order.map((id) => {
    const use = uses.get(id);
    const result = results.get(id);
    const shell = use.name === "Bash" ? shellOf(use.command) : "";
    return {
      at: use.at,
      name: use.name,
      command: use.command,
      size: use.size,
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
  }));
  return { calls, brief, firstAt, lastAt: Math.max(lastAt, ...calls.map((one) => one.endedAt)) };
};

export const readTranscript = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};
