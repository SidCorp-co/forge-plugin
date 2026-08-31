#!/usr/bin/env node
// Stop once between deciding to record something and recording it. A memory row is project
// knowledge; a skill edit develops the method. docs/HOOKS.md explains why the two must not merge.

import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { REDIRECT, WRITES, askedAlready, bodiless, deny, readEvent } from "./_hook.mjs";
import { compare, load, sentences } from "../src/duplication.mjs";

const FORGE_SOURCES = {
  note: "episodic — why THIS issue happened, what one debugging run cost",
  knowledge: "how this codebase actually works, traced and verified",
  decision: "a choice among alternatives, with the reason it was chosen",
  policy: "a rule that binds future work",
};
const GUARDED = /\/memory\/|\/skills\//;
// Naming one of those files is not touching it: reading a skill must stay free, so a write shape
// is asked about only as its own token — unanchored, `-i` matched inside `erp-issue-workflow.md`
// and `>` a commit trailer's `<noreply@anthropic.com>`.
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

/* The test, the categories and the destinations are one document already, and a refusal that
   reprints them spends the same 300 tokens on every edit — eight times in one session, measured.
   So the message points at the document and the pointer goes out once. */
const LEARNING_REF = join(
  dirname(fileURLToPath(import.meta.url)), "..", "skills", "issue-flow", "references", "learning.md",
);

const pointer = (ev) => {
  if (askedAlready(ev, "learning-ref", "learning-gate", { set: false })) return "";
  askedAlready(ev, "learning-ref", "learning-gate");
  return `\n\nThe four-part test and where each category lands: ${LEARNING_REF}\n`
    + "Read it once — this pointer is printed for the first refusal of a session only.";
};

const BRIEF =
  "Record only what cost a cycle, will recur, fails silently, and is not already written. Most "
  + "rounds record nothing.";

const SHAPE =
  "One file, one fact: `name`, a `description` saying when it applies, `metadata.type` "
  + `(${Object.keys(FILE_TYPES).join("|")}), one pointer line in MEMORY.md.`;

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

/** Condition 4 made a check. Calibrated on six real memories: the closest related pair scores 0.27,
 *  a paraphrase re-filed under a new name scores 1.00. */
function restated(dir, path, text) {
  if (!text.trim()) return null;
  const incoming = sentences(text).map((one) => ["<proposed>", one]);
  if (incoming.length === 0) return null;
  let others = [];
  // A first memory, or a directory that is not there yet: nothing to restate.
  try {
    others = load(dir, new Set([basename(path), "MEMORY.md"]), "prose");
  } catch {
    return null;
  }
  const [top] = compare(incoming, others, 0.45, 5).sort((a, b) => b[0] - a[0]);
  if (!top) return null;
  return { file: top[2][0], score: top[0], sentence: top[2][1].replace(/^["\u201c]|["\u201d]$/gu, "") };
}

const action = (twin, exists) => {
  if (twin) {
    return `Already in \`${twin.file}\` (${twin.score.toFixed(2)}): "${twin.sentence.slice(0, 100)}"\n\n`
      + "Do this: fix that file if its rule is wrong. Re-send only if this fact is a different one.";
  }
  if (exists) {
    return "Do this: replace the wrong rule in place, or delete the file if it no longer holds — never "
      + "append a second version. Otherwise re-send.";
  }
  return "Do this: if a memory already states this, fix that file. Otherwise re-send.";
};

const ev = readEvent();
const tool = ev.tool_name ?? "";
const ti = ev.tool_input ?? {};

if (tool.endsWith("forge_memory_write") || tool.endsWith("forge_memory.write")) {
  const src = ti.source ?? "";
  if (!(src in FORGE_SOURCES)) process.exit(0); // issue/comment/job are system-authored
  const md = ti.metadata;
  if (md && typeof md === "object" && md.checked) process.exit(0);
  deny(
    `Hold — you are about to write project memory as \`${src}\`.\n\n${BRIEF}\n\n` +
      `If it survives, put it in the right category rather than all of it in one:\n${catalogue(FORGE_SOURCES)}\n\n` +
      "Re-send with metadata.checked set to the category you chose, and say in one line which of " +
      `the four conditions made it worth keeping.${pointer(ev)}`,
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
      // Being sent to another tool teaches nothing about whether the fact belongs in a file at all.
      const memory = resolved.includes("/memory/");
      deny(
        `Hold — \`${resolved}\` is ${memory ? "a memory file" : "a skill's own text"}, written `
          + `through the shell.\n\n${BRIEF}\n\n`
          + (memory
            ? `Do this: if all four hold, write it with Write and declare \`type:\` — ${Object.keys(FILE_TYPES).join(" | ")}. Otherwise write nothing.`
            : `Do this: if all four hold, use Edit and name the kind — ${Object.keys(SKILL_CATEGORIES).join(" | ")}. Otherwise change nothing.`),
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
  // Once per file: a refusal that also refuses the re-send forbids the write outright.
  if (askedAlready(ev, path, "learning-gate")) process.exit(0);
  const twin = restated(dirname(resolve(path)), path, ti.content ?? ti.new_string ?? "");
  const fresh = !twin && !existsSync(path);
  deny(
    `Hold — \`${basename(path)}\`${fresh ? ", a new memory. Why should it exist, and will it still matter later?" : "."}`
      + `\n\n${BRIEF}\n\n${fresh ? `${SHAPE}\n\n` : ""}`
      + action(twin, existsSync(path)),
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
    `Hold — \`${basename(path)}\` is a skill's own text: it develops the method, so it must not be ` +
      `a note about this one repository.\n\n${BRIEF}\n\n` +
      "Do this: change nothing unless the test holds. If it does, re-send and answer three things " +
      `in your reply — which category (${Object.keys(SKILL_CATEGORIES).join(" | ")}), whether a ` +
      "check in the plugin could enforce it instead, and what it displaces." +
      pointer(ev),
  );
}
