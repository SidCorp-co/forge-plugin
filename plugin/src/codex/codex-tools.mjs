/* What the reviewer may do for itself: read, list, search, and see a diff — over the checkouts under
   review and nothing else. The gateway answers with real `tool_use` blocks, so the alternative to
   this is the reviewer guessing at a file it was not handed. hooks/how/codex-second.md, and
   docs/FORGE-CLI.md for the scope. */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const NEAREST_UP = 12;
const RESULT_CHARS = 20_000;
const LIST_ENTRIES = 400;
const GREP_LINES = 200;
const TOOL_MS = 10_000;
const SKIP = /(?:^|\/)(?:node_modules|\.git|dist|coverage|\.next)(?:\/|$)/;

/* One command the checkout named, once, with a clock on it — not a shell. The version that could run
   commands took eleven minutes and spawned its own subagents; a project's own `npm test` is the one
   claim a reviewer keeps saying it could not verify. */
const CHECK = {
  name: "run_check",
  description: "Run this checkout's own check command once — the one the project configured, not one you choose. Returns the exit code and the output's tail.",
  input_schema: { type: "object", properties: {} },
};

export const toolsFor = (scope) => (scope?.check ? [...TOOLS, CHECK] : TOOLS);

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
    description: "List a directory under review, one name per line, directories marked with a slash. The checkout's own root by default.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Repo-relative; the repository root if you omit it." } },
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
    description: "What changed in a path, against a ref. Empty output means nothing changed there. The whole checkout by default.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative; the whole checkout if you omit it." },
        base: { type: "string", description: "Ref to diff against; HEAD by default." },
      },
    },
  },
];

/** The roots a model-initiated read may reach, and the single files allowed outside them. A reply
 *  that could read any path could read `~/.config/forge/config.json`, which holds a live token. */
export const scopeFor = (root, extras = [], check = null) => {
  const roots = new Set([canonical(root)]);
  const files = new Set();
  for (const one of extras) {
    const real = canonical(one);
    const owner = gitRootOf(real);
    if (owner) roots.add(owner);
    else files.add(real);
  }
  return { roots: [...roots], files: [...files], check: check ? { ...check, root: canonical(root), used: false } : null };
};

const CHECK_MS = 300_000;
const TAIL_CHARS = 6_000;

const checkOnce = (scope) => {
  if (!scope.check) return { text: "this checkout configures no `codex.check`, so there is nothing to run", error: true };
  if (scope.check.used) return { text: "run_check runs once per consult, and it has run", error: true };
  scope.check.used = true;
  /* Its own process group: the clock kills the shell, and a runner the shell started would outlive
     it — the orphan the rule exists to prevent — unless the group goes with it. */
  const run = spawnSync("sh", ["-c", scope.check.command], {
    cwd: scope.check.root,
    encoding: "utf8",
    timeout: scope.check.ms ?? CHECK_MS,
    maxBuffer: 16 << 20,
    detached: true,
  });
  if (run.error) {
    if (run.pid) try { process.kill(-run.pid, "SIGKILL"); } catch { /* already gone */ }
    const why = run.error.code === "ETIMEDOUT"
      ? `ran past ${(scope.check.ms ?? CHECK_MS) / 1000}s and was stopped`
      : `could not finish: ${run.error.message}`;
    return { text: `\`${scope.check.command}\` ${why}`, error: true };
  }
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const tail = out.length > TAIL_CHARS ? `…\n${out.slice(-TAIL_CHARS)}` : out;
  return { text: `\`${scope.check.command}\` exited ${run.status}\n${tail.trim()}` };
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
  return { refused: `${given} is not a readable path in ${scope.roots.join(", ")}; ${nearestOf(scope, given)}` };
};

/* A refusal that names what is there: `grep test` was refused five times and retried blind, because
   the directory is `plugin/test` and nothing said so. */
const TOP_ENTRIES = 24;
const entriesOf = (dir) => {
  try {
    return readdirSync(dir).filter((one) => one !== ".git").sort().slice(0, TOP_ENTRIES).join(", ");
  } catch {
    return null;
  }
};

const topOf = (scope) => {
  const names = entriesOf(scope.roots[0]);
  return names ? `at its top: ${names}` : "its top level could not be listed";
};

/* Beside where the path would have been, not at the root: a leaf six levels down has siblings, and
   the root's own top says nothing about them. */
const nearestOf = (scope, given) => {
  let dir = isAbsolute(given) ? resolve(given) : resolve(scope.roots[0], given);
  for (let up = 0; up < NEAREST_UP; up += 1) {
    dir = join(dir, "..");
    const real = canonical(dir);
    if (!scope.roots.some((root) => withinRoot(root, real)) && !scope.roots.includes(real)) break;
    if (statSafe(real)?.isDirectory()) {
      const names = entriesOf(real);
      if (names) return `${relative(scope.roots[0], real) || "the root"} holds: ${names}`;
    }
  }
  return topOf(scope);
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
  const rel = relative(owner, held.real);
  const run = spawnSync(
    "git",
    ["diff", "--no-color", "--no-ext-diff", "--end-of-options", ref, ...(rel ? ["--", rel] : [])],
    { cwd: owner, encoding: "utf8", timeout: TOOL_MS },
  );
  if (run.status !== 0) return `git diff failed: ${(run.stderr ?? "").trim().slice(0, 200)}`;
  return clipped((run.stdout ?? "").trim() || "no change against that ref");
};

/** One tool call, run here. Every failure comes back as text the reviewer can act on: a refusal it
 *  cannot read is indistinguishable from a file that does not exist. */
export const runTool = (scope, name, given = {}) => {
  /* A default catches undefined and not `null`, which is what `"input": null` parses to — and a
     throw here ends the consult, where a refusal is something the reviewer can answer. */
  const input = given && typeof given === "object" ? given : {};
  if (name === "run_check") return checkOnce(scope);
  /* Optional for three of the four: the checkout is what a reviewer means by no path, and 34
     refusals in the log were that argument left out (ISS-65). read_file has no such default. */
  const rooted = name !== "read_file";
  const held = input.path ? located(scope, input.path) : (rooted ? { real: scope.roots[0], in: scope.roots[0] } : null);
  if (!held) return { text: `read_file needs a \`path\`; ${topOf(scope)}`, error: true };
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
