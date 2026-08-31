/* What the reviewer may do for itself: read, list, search, and see a diff — over the checkouts under
   review and nothing else. The gateway answers with real `tool_use` blocks, so the alternative to
   this is the reviewer guessing at a file it was not handed. hooks/why/codex-second.md, and
   docs/FORGE-CLI.md for the scope. */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const RESULT_CHARS = 20_000;
const LIST_ENTRIES = 400;
const GREP_LINES = 200;
const TOOL_MS = 10_000;
const SKIP = /(?:^|\/)(?:node_modules|\.git|dist|coverage|\.next)(?:\/|$)/;

export const TOOLS = [
  {
    name: "read_file",
    description: "Read a file under review. Optional `from` line and `lines` count for a long one.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative, or absolute for a file named to you." },
        from: { type: "integer", description: "1-based first line." },
        lines: { type: "integer", description: "How many lines from there." },
      },
      required: ["path"],
    },
  },
  {
    name: "list_dir",
    description: "List a directory under review, one name per line, directories marked with a slash.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "grep",
    description: "Search the checkout for a regular expression. Returns `path:line:text` matches.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "Directory or file to search; the repository root by default." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "git_diff",
    description: "What changed in a path, against a ref. Empty output means nothing changed there.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        base: { type: "string", description: "Ref to diff against; HEAD by default." },
      },
      required: ["path"],
    },
  },
];

/** The roots a model-initiated read may reach, and the single files allowed outside them. A reply
 *  that could read any path could read `~/.config/forge/config.json`, which holds a live token. */
export const scopeFor = (root, extras = []) => {
  const roots = new Set([canonical(root)]);
  const files = new Set();
  for (const one of extras) {
    const real = canonical(one);
    const owner = gitRootOf(real);
    if (owner) roots.add(owner);
    else files.add(real);
  }
  return { roots: [...roots], files: [...files] };
};

const canonical = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

export const gitRootOf = (path) => {
  const asked = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: statSafe(path)?.isDirectory() ? path : join(path, ".."),
    encoding: "utf8",
    timeout: TOOL_MS,
  });
  return asked.status === 0 ? canonical(asked.stdout.trim()) : null;
};

const statSafe = (path) => {
  try {
    return statSync(path);
  } catch {
    return null;
  }
};

const withinRoot = (root, real) => real === root || real.startsWith(root + sep);

/** Where a path the model asked for lands, or the reason it is refused. Realpath'd for the reason
 *  codex-api.mjs states, and it admits a directory, which `inside` there does not. */
export const located = (scope, given) => {
  if (typeof given !== "string" || !given.trim()) return { refused: "no path given" };
  const bases = isAbsolute(given) ? [""] : scope.roots;
  for (const base of bases) {
    const real = canonical(base ? resolve(base, given) : given);
    if (!statSafe(real)) continue;
    if (scope.files.includes(real) || scope.roots.some((root) => withinRoot(root, real))) {
      return { real, in: scope.roots.find((root) => withinRoot(root, real)) ?? null };
    }
    return { refused: `${given} is outside the checkouts under review` };
  }
  return { refused: `${given} is not a readable path in ${scope.roots.join(", ")}` };
};

const clipped = (text) =>
  text.length > RESULT_CHARS ? `${text.slice(0, RESULT_CHARS)}\n… clipped at ${RESULT_CHARS} characters` : text;

const readOne = (held, { from, lines }) => {
  const text = readFileSync(held.real, "utf8");
  if (!from && !lines) return clipped(text);
  const all = text.split("\n");
  const start = Math.max(1, Number(from) || 1);
  const count = Math.max(1, Number(lines) || all.length);
  return clipped(all.slice(start - 1, start - 1 + count).map((line, at) => `${start + at}: ${line}`).join("\n"));
};

const listOne = (held) =>
  clipped(
    readdirSync(held.real, { withFileTypes: true })
      .filter((entry) => !SKIP.test(entry.name))
      .slice(0, LIST_ENTRIES)
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .join("\n") || "(empty)",
  );

const grepIn = (scope, held, pattern) => {
  const where = held ?? { real: scope.roots[0] };
  const run = spawnSync(
    "grep",
    ["-rnI", "--exclude-dir=node_modules", "--exclude-dir=.git", "--exclude-dir=dist", "-e", pattern, where.real],
    { encoding: "utf8", timeout: TOOL_MS, maxBuffer: 8 << 20 },
  );
  if (run.error) return `grep failed: ${run.error.message}`;
  const lines = (run.stdout ?? "").split("\n").filter(Boolean);
  if (!lines.length) return "no matches";
  const shown = lines.slice(0, GREP_LINES).map((line) => line.replace(`${scope.roots[0]}/`, ""));
  const more = lines.length > GREP_LINES ? `\n… ${lines.length - GREP_LINES} more matches` : "";
  return clipped(shown.join("\n") + more);
};

/* `--output=<path>` is an option to `git diff`, and the ref sat in option position: a base the model
   chose was a write primitive inside a read-only tool. Refused by shape and by `--end-of-options`,
   because one of those is a judgement about which prefixes are dangerous and the other is not. */
const diffOf = (held, base) => {
  const ref = String(base ?? "").trim() || "HEAD";
  /* Thrown, not returned: `runTool` marks a thrown failure an error, and a refusal the operator
     never sees in the refused list is one nobody knows the reviewer attempted. */
  if (ref.startsWith("-")) throw new Error(`${ref} is not a ref this will pass to git`);
  const owner = held.in ?? gitRootOf(held.real);
  if (!owner) return "not in a git repository, so it has no diff";
  const run = spawnSync(
    "git",
    ["diff", "--no-color", "--no-ext-diff", "--end-of-options", ref, "--", relative(owner, held.real)],
    { cwd: owner, encoding: "utf8", timeout: TOOL_MS },
  );
  if (run.status !== 0) return `git diff failed: ${(run.stderr ?? "").trim().slice(0, 200)}`;
  return clipped((run.stdout ?? "").trim() || "no change against that ref");
};

/** One tool call, run here. Every failure comes back as text the reviewer can act on: a refusal it
 *  cannot read is indistinguishable from a file that does not exist. */
export const runTool = (scope, name, input = {}) => {
  const needsPath = name !== "grep";
  const held = input.path ? located(scope, input.path) : null;
  if (needsPath && !held) return { text: "this tool needs a `path`", error: true };
  if (held?.refused) return { text: held.refused, error: true };
  try {
    if (name === "read_file") return { text: readOne(held, input) };
    if (name === "list_dir") return { text: listOne(held) };
    if (name === "grep") return { text: grepIn(scope, held, String(input.pattern ?? "")) };
    if (name === "git_diff") return { text: diffOf(held, input.base) };
  } catch (error) {
    return { text: `${name} failed: ${error.message}`, error: true };
  }
  return { text: `no tool named ${name}`, error: true };
};
