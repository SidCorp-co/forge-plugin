/* What the reviewer may do for itself: read, list, search, and see a diff — over the checkouts under
   review and nothing else. The gateway answers with real `tool_use` blocks, so the alternative to
   this is the reviewer guessing at a file it was not handed. hooks/how/codex-second.md, and
   docs/cli/codex-the-request.md for the scope. */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { failuresSaid } from "./check/output.mjs";
import { commentPage, cutIn } from "../tracker/comments.mjs";
import { HUMAN_REF, documentIdIfAny } from "../tracker/issues.mjs";
import { scoped } from "../tracker/rest.mjs";
import { AROUND_CHECK_MS, budgetMs, fromProject, refusing } from "../resolve/settings.mjs";

const NEAREST_UP = 12;
const RESULT_CHARS = 20_000;
const PAGE_ROOM = 512;
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

export const toolsFor = (scope) => [
  ...TOOLS,
  ...(scope?.check ? [CHECK] : []),
  ...(scope?.tracker ? [READ_ISSUE] : []),
];

// The one tool that reads outside the checkouts: an issue off this checkout's own tracker, in this process and through the readers `forge issue` and `forge comment` use, so the token stays here.
export const READ_ISSUE = {
  name: "read_issue",
  description: "Read an issue off this project's tracker by its key: its fields, its body and its comments, "
    + "as one text numbered for anchoring. Read-only. Optional `page` for a long one.",
  input_schema: {
    type: "object",
    properties: {
      key: { type: "string", description: "The issue key, as ISS-45." },
      page: { type: "integer", description: "1-based page; every page says which of how many it is." },
    },
    required: ["key"],
  },
};

// Requests the tracker sees, not the model's calls: ISS-815 cost eleven offset reads, two for its row and one
// for its thread, so a flat twelve refused a live read — hence per key, plus a spare for cited neighbours.
export const PER_KEY = 15;
export const SPARE = 15;
const TRACKER_SECONDS = 20;

// Lifted out of the fields: a finding quotes a line of the body, and `<KEY>/fields:12` would name one of something else.
const BODY = "description";

// Null where the consult named no issue, so the tool is not offered and pays no prompt for an offer nothing could use.
// `read` is this consult's snapshot per key: fetching an issue again for its second page put page three past the budget.
export const trackerFor = (keys = []) =>
  (keys.length ? { keys, left: keys.length * PER_KEY + SPARE, read: new Map() } : null);

// Called by the transport before every attempt, which is what charges a retry and a nested offset lookup.
const spending = (held, signal) => () => {
  if (signal?.aborted) {
    return "read_issue: this consult ran out of time before the request was sent. "
      + "Rule on what you have, and say what you could not read.";
  }
  if (held.left > 0) {
    held.left -= 1;
    return null;
  }
  return "read_issue: this consult has spent its tracker request(s), so nothing was sent. "
    + "Rule on what you have, and say what you could not read.";
};

const linesOf = (text) => String(text ?? "").replace(/\r\n/gu, "\n").split("\n");

// What is read is what is echoed: an answer repeating the padding a key was typed with is past the cap before a page is in it.
const keyIn = (given) => String(given ?? "").trim().toUpperCase();

// Every key the row carries rather than a list kept here, which would leave a field the tracker grows unread.
// Flattened: a `plan` held as one logical line numbers only its first physical one, and the promise is that a finding can anchor to any line it was shown (consult 6a4d1e, F2).
const fieldLines = (row) => Object.entries(row)
  .filter(([name, held]) => name !== BODY && held !== null && held !== undefined)
  .flatMap(([name, held]) => (typeof held === "object"
    ? [`${name}: ${JSON.stringify(held)}`]
    : linesOf(held).map((line, at) => (at ? line : `${name}: ${line}`))));

// The tracker's own id, that being what a finding about this comment names back; the position is in the heading.
const commentPart = (key, one, at, many) => ({
  name: `${key}/comment/${one.documentId ?? one.id ?? at + 1}`,
  head: `${at + 1} of ${many}, by ${one.authorId ?? "an unnamed author"} at ${one.createdAt ?? "an unrecorded time"}`,
  lines: linesOf(one.body),
});

const notAKey = (given, keys) =>
  `read_issue: \`${given ?? ""}\` is not an issue key. They read ISS and digits, as ISS-45; this `
  + `consult is about ${keys.join(", ")}.`;

const fetched = async (budget, key, signal) => {
  const held = { once: true, waits: TRACKER_SECONDS, signal, spend: spending(budget, signal) };
  const found = await documentIdIfAny(key, { soft: true, ...held });
  if (found.refused) return { refused: `read_issue ${key}: ${found.refused}` };
  // Relations asked for and attachments not: it is the blocker that is context and the bytes it cannot fetch that are not.
  const row = await scoped("forge_issues", { action: "get", documentId: found.id, fields: ["relations"] }, true, held);
  if (row?.refused) return { refused: `read_issue ${key}: ${row.refused}` };
  // `commentPage` and not `readThread`: the thread reader credits the shown ledger, and a reviewer's read is not a session's.
  const page = await commentPage(found.id, true, held);
  if (page?.refused) return { refused: `read_issue ${key}: ${page.refused}` };
  const comments = page.comments ?? [];
  return {
    parts: [
      { name: `${key}/fields`, lines: fieldLines(row) },
      { name: `${key}/body`, lines: linesOf(row[BODY]) },
      ...comments.map((one, at) => commentPart(key, one, at, comments.length)),
    ],
    said: [`${comments.length} comment(s).`, page.stopped, cutIn(page)].filter(Boolean).join(" "),
  };
};

// Inside `refusing`, so a `fail()` under these readers throws rather than ending a review already paid for: a gateway with no tracker credential beside it is a configuration and not a crash (consult 6a4d1e, F3).
export const issueParts = async (scope, given) => {
  const budget = scope?.tracker;
  if (!budget) return { refused: "read_issue: this consult named no issue, so there is nothing here to read." };
  const key = keyIn(given);
  if (!HUMAN_REF.test(key)) return { refused: notAKey(given, budget.keys) };
  const known = budget.read.get(key);
  if (known) return known;
  try {
    const held = await refusing(() => fetched(budget, key, scope.signal));
    if (held.parts) budget.read.set(key, held);
    return held;
  } catch (error) {
    return { refused: `read_issue ${key}: ${error.message}` };
  }
};

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
    description: "What changed in a path, against a ref. Empty output means nothing changed there. With neither, the diff this review is anchored to — the same change you were shown — or the whole checkout against HEAD where it is anchored to nothing.",
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
export const scopeFor = (root, extras = [], check = null, consult = null) => {
  const roots = new Set([canonical(root)]);
  const files = new Set();
  for (const one of extras) {
    const real = canonical(one);
    const owner = gitRootOf(real);
    if (owner) roots.add(owner);
    else files.add(real);
  }
  /* Its own field rather than beside `files`, which means the single paths reachable outside the
     roots. Only the paths this checkout answers for: a sibling project's are diffed by nobody here. */
  const rels = (consult?.files ?? []).filter((one) => !isAbsolute(one));
  return {
    roots: [...roots],
    files: [...files],
    /* The consult's own deadline travels with the check, because the clock the spawn is handed is
       what the budget has left at the call and not what the configuration allowed at the first one:
       five calls can spend the room a static cap assumed was there, and `AbortSignal` cannot reach
       into a synchronous spawn to take it back. A scope built without one is given a deadline from
       here, so there is no path on which a check runs against no budget at all (ISS-2108). */
    check: check
      ? { ...check, root: canonical(root), used: false, by: consult?.by ?? Date.now() + budgetMs() }
      : null,
    diff: consult?.anchor && rels.length ? { anchor: consult.anchor, rels } : null,
    tracker: trackerFor(consult?.issues ?? []),
  };
};

const TAIL_CHARS = 6_000;

/* What bounded the clock decides which key can move it, and naming a key that cannot is the advice
   that costs a run its next consult too. Three answers: the project's own declaration, which its own
   key raises; the ceiling a budget spares a check, which only a larger budget raises; and the room
   this consult had left by the time the check was called, which no configuration reaches at all.
   This string is the whole of what the run that paid for the stopped call is handed, and the seconds
   stay first in it, being what the log's own readers parse back out. */
const clockSaid = (check, ms) => {
  if (ms < check.ms) {
    return `the ${ms / 1000}s this consult had left of its ${budgetMs() / 1000}s budget once the `
      + `${AROUND_CHECK_MS / 1000}s after a check was held back, so no clock in ${fromProject()} `
      + `raises it. Narrow \`codex.check\` to what fits, or raise \`codex.budgetMs\` where the caller `
      + `can wait longer than one call`;
  }
  return check.msFrom === fromProject()
    ? `\`codex.checkMs\` in ${check.msFrom}. Raise it, or narrow \`codex.check\` to what fits ${ms / 1000}s`
    : `${check.msFrom}, which \`codex.checkMs\` cannot raise past. Narrow \`codex.check\` to what fits `
      + `${ms / 1000}s, or raise \`codex.budgetMs\` where the caller can wait longer than one call`;
};

// Composed, not inherited: a check is the project's command and not the run that consulted it.
const checkEnv = () => {
  const env = { ...process.env };
  delete env.FORGE_SESSION_ID;
  return env;
};

const checkOnce = (scope) => {
  if (!scope.check) return { text: "this checkout configures no `codex.check`, so there is nothing to run", error: true };
  if (scope.check.used) return { text: "run_check runs once per consult, and it has run", error: true };
  /* Floored by a refusal and not by a number: `spawnSync` reads a timeout of 0 as no timeout at all,
     so a consult with nothing left to spend would start the one check that can never be stopped. */
  const room = scope.check.by - Date.now() - AROUND_CHECK_MS;
  if (room <= 0) {
    scope.check.used = true;
    scope.check.outcome = "failed";
    return { text: `\`${scope.check.command}\` was not started: this consult's ${budgetMs() / 1000}s `
      + `budget has nothing left to spare it once the ${AROUND_CHECK_MS / 1000}s after a check is `
      + `held back. Raise \`codex.budgetMs\` where the caller can wait longer than one call`, error: true };
  }
  /* The room bounds the clock whatever the check carried, a resolved figure or nothing at all, so a
     check reaching here without one is bounded by the room rather than by the spawn's own absence of
     a timeout. */
  const ms = Math.min(scope.check.ms ?? room, room);
  scope.check.used = true;
  /* Its own process group: the clock kills the shell, and a runner the shell started would outlive
     it — the orphan the rule exists to prevent — unless the group goes with it. */
  const run = spawnSync("sh", ["-c", scope.check.command], {
    cwd: scope.check.root,
    encoding: "utf8",
    env: checkEnv(),
    timeout: ms,
    maxBuffer: 16 << 20,
    detached: true,
  });
  if (run.error) {
    if (run.pid) try { process.kill(-run.pid, "SIGKILL"); } catch { /* already gone */ }
    const stopped = run.error.code === "ETIMEDOUT";
    scope.check.outcome = stopped ? "cut" : "failed";
    const why = stopped
      ? `ran past ${ms / 1000}s and was stopped. That clock is ${clockSaid(scope.check, ms)}`
      : `could not finish: ${run.error.message}`;
    return { text: `\`${scope.check.command}\` ${why}`, error: true };
  }
  scope.check.outcome = run.status === null && run.signal ? "failed" : "ran";
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const tail = out.length > TAIL_CHARS ? `…\n${out.slice(-TAIL_CHARS)}` : out;
  const failed = failuresSaid(out);
  return { text: `\`${scope.check.command}\` exited ${run.status}\n${failed ? `${failed}\n\n` : ""}${tail.trim()}` };
};

/** Which of five states the declared check left this round in, `none` being a word rather than an absence: a row with no field at all is one from before any of this, and a signal that left no exit status is `failed` and not `ran`. docs/cli/codex-the-check.md. */
export const checkState = (scope) => (scope?.check ? scope.check.outcome ?? "declined" : "none");

export const checkCommand = (scope) => scope?.check?.command ?? null;

export const checkRow = (scope) => ({ check: checkState(scope), ...(checkCommand(scope) ? { checkCommand: checkCommand(scope) } : {}) });

/* Not `resolve/canonical.mjs`'s: a relative path falls inside any root it would be matched against. */
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

const clip = (text, at) => (text.length > at ? `${text.slice(0, at)}\n… clipped at ${at} characters` : text);
const clipped = (text) => clip(text, RESULT_CHARS);

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
  const all = lines.map((line) => line.replace(`${scope.roots[0]}/`, ""));
  const shown = fitting(all);
  if (shown.length === all.length) return shown.join("\n");
  return `${all.length} matches, the first ${shown.length} shown:\n${shown.join("\n")}\n`
    + `… ${all.length - shown.length} more not shown. Narrow it with a tighter pattern, or with a \`path\` to one directory or file.`;
};

/* The matches that fit under both caps, whole. A grep clipped mid-list by characters loses the
   count of what it hid, and unlike a read there is no range to page on, so the list is cut at a
   line and the count is said instead (ISS-326). A first match alone past the room is cut where it
   sits, as a read's would be. */
const fitting = (lines) => {
  const room = RESULT_CHARS - PAGE_ROOM;
  const shown = [];
  let size = 0;
  for (const line of lines.slice(0, GREP_LINES)) {
    if (size + line.length + 1 > room) break;
    shown.push(line);
    size += line.length + 1;
  }
  return shown.length ? shown : [clip(lines[0], room - PAGE_ROOM)];
};

const headed = (part, again) => `${part.name}${part.head ? ` — ${part.head}` : ""}, ${part.lines.length}`
  + ` line(s)${again ? ", continued" : ""}:`;

const marked = (parts) => parts.flatMap((part) => [
  { part, text: headed(part, false), opens: true },
  ...part.lines.map((line, at) => ({ part, text: `${at + 1}: ${line}` })),
  { part, text: "" },
]);

/** Named parts as one text, cut at a line boundary and never mid-line, a page opening inside a part
 *  restating its heading: a numbered line whose part nobody named anchors nothing. The cap is `read_file`'s. */
export const pagedParts = (parts, asked = 1) => {
  const pages = [[]];
  let size = 0;
  // Under the cap rather than at it: the heading a page restates and the line naming it are answered too.
  const room = RESULT_CHARS - PAGE_ROOM;
  for (const one of marked(parts)) {
    const row = one.text.length < room ? one : { ...one, text: clip(one.text, room - PAGE_ROOM) };
    const cost = row.text.length + 1;
    if (size + cost > room && pages.at(-1).length) {
      pages.push([]);
      size = 0;
    }
    pages.at(-1).push(row);
    size += cost;
  }
  const at = Math.min(Math.max(1, Math.trunc(Number(asked)) || 1), pages.length);
  const page = pages[at - 1];
  const opened = page[0]?.opens ? null : page[0]?.part;
  return {
    at,
    pages: pages.length,
    text: [...(opened ? [headed(opened, true)] : []), ...page.map((row) => row.text)].join("\n").trim(),
  };
};

const issueRead = async (scope, input) => {
  const held = await issueParts(scope, input.key);
  if (held.refused) return { text: held.refused, error: true };
  const page = pagedParts(held.parts, input.page);
  return { text: `${keyIn(input.key)} — page ${page.at} of ${page.pages}, `
    + `${scope.tracker.left} tracker request(s) left. ${held.said}\n\n${page.text}` };
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

/** The diff tool's answer where the files under review have not moved since the anchor. */
export const unchangedSince = (anchor) => `no change against ${anchor} in the file(s) this consult named`;

/* Asked for the diff with nothing to narrow it, a reviewer means the change under review. Where the
   consult named a base, or a recheck anchored to a logged head, the whole checkout against HEAD is a
   different question, and answering it had a review judge the branch for code it never touched
   (ISS-51). A scoped diff that will not run says so rather than widening to what it exists to hold. */
const ownDiff = (scope, held) => {
  const own = scope.diff;
  if (!own) return diffOf(held, null);
  const run = spawnSync(
    "git",
    ["diff", "--no-color", "--no-ext-diff", "--end-of-options", own.anchor, "--", ...own.rels],
    { cwd: scope.roots[0], encoding: "utf8", timeout: TOOL_MS },
  );
  if (run.status !== 0) return `git diff failed: ${(run.stderr ?? "").trim().slice(0, 200)}`;
  const loose = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "--", ...own.rels],
    { cwd: scope.roots[0], encoding: "utf8", timeout: TOOL_MS });
  const New = (loose.stdout ?? "").split("\n").filter(Boolean);
  const also = New.length
    ? `\n\n${New.join(", ")} ${New.length === 1 ? "is" : "are"} untracked, so git shows no diff for `
      + `${New.length === 1 ? "it" : "them"} — the whole text is the change, and it travelled with the prompt.`
    : "";
  const text = (run.stdout ?? "").trim();
  if (!text) return `${unchangedSince(own.anchor)}${also}`;
  return clipped(`This review's own diff, from ${own.anchor.slice(0, 7)} over ${own.rels.length} file(s):\n${text}${also}`);
};

/** One tool call, run here, its answer ending on how many calls the round has left where the round
 *  said (`scope.left`, the calls after the one that reads this). `said` is the tool's own answer, for
 *  the operator: the count is the model's to plan on, not a line of a refusal. */
export const runTool = async (scope, name, given = {}) => {
  const ran = await answered(scope, name, given);
  if (!Number.isInteger(scope?.left)) return ran;
  const left = scope.left > 0 ? `calls left: ${scope.left} after this one` : "last call — answer now";
  return { ...ran, text: `${ran.text}\n\n${left}`, said: ran.text };
};

/* Every failure comes back as text the reviewer can act on: a refusal it cannot read is
   indistinguishable from a file that does not exist. */
const answered = async (scope, name, given = {}) => {
  /* A default catches undefined and not `null`, which is what `"input": null` parses to — and a
     throw here ends the consult, where a refusal is something the reviewer can answer. */
  const input = given && typeof given === "object" ? given : {};
  if (name === "run_check") return checkOnce(scope);
  /* Before the path reading below, as `run_check` is: this tool's subject is a key, and the reader
     that answers "not a readable path in" would refuse the one argument it takes. */
  if (name === "read_issue") return issueRead(scope, input);
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
    if (name === "git_diff") return { text: input.path || input.base ? diffOf(held, input.base) : ownDiff(scope, held) };
  } catch (error) {
    return { text: `${name} failed: ${error.message}`, error: true };
  }
  return { text: `no tool named ${name}`, error: true };
};
