#!/usr/bin/env node
// Stop once between deciding to record something and recording it. A memory row is project
// knowledge; a skill edit develops the method. docs/HOOKS.md explains why the two must not merge.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { askedAlready, deny, readEvent } from "./_hook.mjs";
import { compare, load, sentences } from "../scripts/skill-dup.mjs";

const FORGE_SOURCES = {
  note: "episodic — why THIS issue happened, what one debugging run cost",
  knowledge: "how this codebase actually works, traced and verified",
  decision: "a choice among alternatives, with the reason it was chosen",
  policy: "a rule that binds future work",
};
const GUARDED = /\/memory\/|\/skills\//;
// Naming one of those files is not touching it: reading a skill must stay free, so a write shape
// is asked about only as its own token — unanchored, `-i` matched inside `erp-issue-workflow.md`
// and `>` a commit trailer's `<noreply@anthropic.com>`. A redirect is judged by its target, since
// coexistence is not aim: `2>/dev/null` writes nothing, a read sent to `/tmp` writes nowhere near.
const REDIRECT = /(?:^|[\s;&|(])\d?>>?\s*(?!&\d)("[^"]*"|'[^']*'|[^\s;&|<>]+)/gu;
// These carry their target as an argument, so a guarded file beside one is asked about.
const WRITES =
  /\bsed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)|\btee\b|\bcp\b|\bmv\b|\btruncate\b|open\([^)]*['"]w/;
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1/u;

/** A heredoc body is data, not command. The operator's own line survives, so `cat <<EOF > x.md`
 *  keeps its target; an unterminated body runs to the end. */
const bodiless = (text) => {
  let out = "";
  let rest = text;
  for (let m = HEREDOC.exec(rest); m; m = HEREDOC.exec(rest)) {
    const after = m.index + m[0].length;
    const nl = rest.indexOf("\n", after);
    if (nl < 0) return `${out}${rest.slice(0, m.index)} ${rest.slice(after)}`;
    out += `${rest.slice(0, m.index)} ${rest.slice(after, nl + 1)}`;
    rest = rest.slice(nl + 1);
    const end = new RegExp(`^[ \\t]*${m[2]}[ \\t]*$`, "mu").exec(rest);
    rest = end ? rest.slice(end.index + end[0].length) : "";
  }
  return out + rest;
};
// `M=…/memory` then `cat > $M/x.md` named no guarded directory in any single token and walked
// past this gate. An assignment and a `cd` resolve here; `$(…)` and `eval` cannot.
const ASSIGN = /(?:^|[;&|\n]|\bexport\s+)\s*([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|]*)/gu;
const CHDIR = /(?:^|[;&|\n])\s*(?:cd|pushd)\s+("[^"]*"|'[^']*'|[^\s;&|]+)/gu;
const MD_TOKEN = /[A-Za-z0-9_./@~-]+\.md/g;
const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

const expanded = (command) => {
  const vars = new Map();
  for (const [, name, value] of command.matchAll(ASSIGN)) vars.set(name, unquote(value));
  return command.replace(/\$\{?([A-Za-z_]\w*)\}?/gu, (whole, name) => vars.get(name) ?? whole);
};

/** The last directory the command changes to, so a relative write resolves against it. */
const chdir = (text) => {
  let target = null;
  for (const [, path] of text.matchAll(CHDIR)) target = unquote(path);
  return target;
};

const SKILL_CATEGORIES = {
  trap: "the environment or a tool behaved unexpectedly -> prefer a check in the plugin",
  method: "a phase produced the wrong outcome, or had no branch for what happened",
  invariant: "holds in EVERY project, not just this one -> a rule, and only if it outranks a phase",
  discovery: "Phase 0 should have established this and did not",
  boundary: "the skill asserted what a project decides -> DELETE it, say what replaced it",
};
const FILE_TYPES = {
  user: "who the user is — role, expertise, standing preferences",
  feedback: "guidance on how to work, with the why",
  project: "ongoing work, goals, constraints not derivable from the code",
  reference: "a pointer to something external — URL, dashboard, ticket",
};

const TEST = `Recording is the exception, not the closing ritual. All four must hold:
  1. it cost a cycle, not a thought
  2. it will recur — a property of the tool, repo or domain, not of this issue
  3. its failure is silent (a thing that reports its own cause needs no note)
  4. it is not already written — search first; a second copy drifts from the first
Fail any one and write nothing. That is the normal outcome of a round.

Before either destination: does the wrong state have a SHAPE — a command pattern, a
missing field, a violated ordering? Then it is a check waiting to be written, and a
check cannot be missed the way a sentence can.`;

const catalogue = (entries) =>
  Object.entries(entries)
    .map(([k, v]) => `  ${k.padEnd(10)} ${v}`)
    .join("\n");

/** Walk up to the directory holding SKILL.md, or null if this is not a skill file. */
function skillRoot(path) {
  let dir = dirname(resolve(path));
  for (let i = 0; i < 4; i += 1) {
    if (existsSync(join(dir, "SKILL.md"))) return dir;
    dir = dirname(dir);
  }
  return null;
}

/** Sentences in the proposed text that the rest of the skill already says.
 *
 *  Run before the write, not after: the point is that the second copy never lands. The file
 *  being edited is excluded, or every unchanged line would match itself. */
function duplicates(root, path, text) {
  if (!text.trim()) return [];
  const incoming = sentences(text).map((s) => ["<proposed>", s]);
  if (incoming.length === 0) return [];
  const rel = relative(root, resolve(path));
  return compare(incoming, load(root, new Set([rel])), 0.34, 5);
}

const ev = readEvent();
const tool = ev.tool_name ?? "";
const ti = ev.tool_input ?? {};

if (tool.endsWith("forge_memory_write") || tool.endsWith("forge_memory.write")) {
  const src = ti.source ?? "";
  if (!(src in FORGE_SOURCES)) process.exit(0); // issue/comment/job are system-authored
  const md = ti.metadata;
  if (md && typeof md === "object" && md.checked) process.exit(0);
  deny(
    `Hold — you are about to write project memory as \`${src}\`.\n\n${TEST}\n\n` +
      `If it survives, put it in the right category rather than all of it in one:\n${catalogue(FORGE_SOURCES)}\n\n` +
      "Re-send with metadata.checked set to the category you chose, and say in one line which of " +
      "the four conditions made it worth keeping.",
  );
}

// A memory or a skill written through the shell passes every check below unseen: `sed -i` and a
// heredoc carry no content to read, and this gate's question has to be answered BEFORE the write.
// So the shell route is closed for these two kinds of file rather than approximated.
if (tool === "Bash") {
  const text = bodiless(expanded(ti.command ?? ""));
  const base = chdir(text);
  const named = WRITES.test(text) ? (text.match(MD_TOKEN) ?? []) : [];
  const aimed = [...text.matchAll(REDIRECT)]
    .flatMap(([, path]) => unquote(path).match(MD_TOKEN) ?? []);
  if (named.length === 0 && aimed.length === 0) process.exit(0);
  for (const token of [...aimed, ...named]) {
    if (basename(token) === "MEMORY.md") continue;
    const resolved = [token, ...(base && !token.startsWith("/") ? [`${base}/${token}`] : [])].find(
      (path) => GUARDED.test(path),
    );
    if (resolved) {
      deny(
        `Refused: \`${resolved}\` is a memory or skill file, and this writes it through the shell.\n\n` +
          "This gate reads the content to ask whether the fact is worth keeping and which category " +
          "it belongs to. A `sed -i` or a heredoc carries no content to read, so going that way " +
          "skips the question rather than answering it.\n\n" +
          "Use Write or Edit for this file.",
      );
    }
  }
  process.exit(0);
}

if (!["Write", "Edit", "MultiEdit"].includes(tool)) process.exit(0);
const path = ti.file_path ?? "";

// --- a memory file: project knowledge ---
// MEMORY.md is the index, not a memory: it carries pointers and no frontmatter.
if (path.includes("/memory/") && path.endsWith(".md") && basename(path) !== "MEMORY.md") {
  let body = ti.content ?? "";
  if (!body) {
    // An Edit sends only the changed span, so the type lives in the file already; gating on the
    // span would refuse every legitimate revision of an existing fact.
    try {
      body = readFileSync(path, "utf8");
    } catch {
      body = "";
    }
    if (!body) process.exit(0);
  }
  // `type:` sits under `metadata:` in the documented frontmatter, so it is indented: anchored to
  // column zero this never matched, and every correctly-shaped memory file was asked about anyway.
  const m = /^\s*type:\s*([a-z]+)\s*$/m.exec(body);
  if ((m && m[1] in FILE_TYPES) || askedAlready(ev, path, "learning-gate")) process.exit(0);
  deny(
    `Hold — you are about to write a memory file.\n\n${TEST}\n\n` +
      "If it survives, one file is one fact, and the frontmatter must declare which kind it is:\n" +
      `${catalogue(FILE_TYPES)}\n\nAdd a valid \`type:\` to the frontmatter and re-send.`,
  );
}

// --- a skill's own text: a skill learning ---
if (path.includes("/skills/") && /\/(SKILL\.md|references\/[^/]+\.md)$/.test(path)) {
  const root = skillRoot(path);
  const proposed = `${ti.content ?? ""}\n${ti.new_string ?? ""}`;
  if (root) {
    const dups = duplicates(root, path, proposed);
    if (dups.length) {
      const joined = dups
        .slice(0, 3)
        .map(
          ([score, [, a], [lb, b]]) =>
            `  ${score.toFixed(2)}  you are writing: ${a.slice(0, 140)}\n` +
            `        ${lb} already says: ${b.slice(0, 140)}`,
        )
        .join("\n");
      deny(
        "This repeats what the skill already says — that is a defect, not a style preference: two " +
          "authorities for one rule diverge the first time someone corrects only the copy they " +
          `found.\n\n${joined}\n\n` +
          "Keep it in one place and cite it from the other. If the existing wording is the worse " +
          "one, replace it rather than adding beside it.\n" +
          "Audit the whole skill with: scripts/skill-dup.mjs <skill-dir>",
      );
    }
  }
  if (askedAlready(ev, path, "learning-gate")) process.exit(0);
  deny(
    "Hold — you are about to change a skill's own text. That is a skill learning, not project " +
      "knowledge: it develops the method, so it must not be a note about this one repository.\n\n" +
      `${TEST}\n\nIf it survives, it lands in a specific place, not on a pile:\n` +
      `${catalogue(SKILL_CATEGORIES)}\n\n` +
      "Two more before you re-send. (a) Could a check in the plugin enforce this instead? A check " +
      "cannot be missed the way a sentence can. (b) What does this displace? A skill that only " +
      "accumulates stops being read — name the rule it replaces, or say that it adds without " +
      "replacing.\n\n" +
      "Re-send the same edit once you have answered both — say the category and what it displaces " +
      "in your reply, not in the file.",
  );
}
