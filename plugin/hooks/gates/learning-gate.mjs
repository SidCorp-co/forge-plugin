// Stop once between deciding to record something and recording it: a memory row is project
// knowledge, a skill edit develops the method, and how/learning-gate.md says why they must not merge.

import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { askedAlready, askedByAnyone, deny, how, settled, shellWrites, writtenPaths, done } from "../_hook.mjs";
import { struck } from "../../src/hooks/shell-spans.mjs";
import { readerKey, sayOnce } from "../../src/shown/ledger.mjs";
import { compare, load, sentences } from "../../src/checks/duplication.mjs";
import { BRIEF, FILE_TYPES, FORGE_SOURCES, GUARDED, SKILL_CATEGORIES } from "../../src/checks/learning.mjs";
/* The `.md` half of what the shared reading answers: this gate judges content, and a guarded path with any other extension carries none for it to judge. The reading is `_hook.mjs`'s, so a name it would read is a name this reads. */
const MD_ONLY = "md";

/* One name per refusal, so the harness report counts a refusal met on many files as one cause: the file's name is in the wording, and a refusal naming no cause is keyed on its wording. */
const CAUSE = {
  tracker: "tracker-memory",
  shellHeld: "shell-existing",
  shellNew: "shell-new",
  memory: "memory-file",
  restated: "skill-restated",
  skill: "skill-text",
};

/* Doubt is an action, and the one branch with a tree to name is where this gate can be one. */
const UNSURE =
  " This command could run in more than one tree — a `cd` before `;` or `||` may have failed — and in "
  + "one of them that is the file this write lands on. Join them with `&&` to say which.";

const SHAPE =
  "One file, one fact: `name`, a `description` saying when it applies, `metadata.type` "
  + `(${FILE_TYPES.join("|")}), one pointer line in MEMORY.md.`;

/* A skill's own text under either shape a served method takes: one file, or one directory of parts under the flow that serves them. A selector reading only `guide.md` guards nothing in a copy that has split it, and looks exactly like a copy nobody writes to. */
const OWN_TEXT = /\/(?:SKILL\.md|guide\.md|(?:guide|references)\/[^/]+\.md)$/;

/** The directory whose text is served together, which is what a duplicate is judged within: one flow's own for served text, since two flows carrying a part word for word is the expected shape; the one holding SKILL.md for a stub. */
function skillRoot(path) {
  const held = dirname(resolve(path));
  if (basename(held) === "guide" || basename(held) === "references") return dirname(held);
  let dir = held;
  for (let i = 0; i < 4; i += 1) {
    if (existsSync(join(dir, "SKILL.md")) || existsSync(join(dir, "guide.md"))) return dir;
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

/* The route first and what was found after it, so the sentence a reader stops at is the one that says what to do. */
const action = (twin, exists) => {
  if (twin) {
    /* One line: a sentence can run from a frontmatter description into the next key. */
    const quoted = twin.sentence.split("\n")[0].replace(/^\w+:\s*"?/u, "").trim();
    return {
      route: `fix \`${twin.file}\` if its rule is wrong. Re-send only if this fact is a different one.`,
      found: `Already in \`${twin.file}\` (${twin.score.toFixed(2)}): "${quoted.slice(0, 100)}"`,
    };
  }
  if (exists) {
    return {
      route: "replace the wrong rule in place, or delete the file if it no longer holds — never append a "
        + "second version. Otherwise re-send.",
      found: null,
    };
  }
  return { route: "fix the memory that already states this, if one does. Otherwise re-send.", found: null };
};

export const run = (ev) => {
  const tool = ev.tool_name ?? "";
  const ti = ev.tool_input ?? {};

  /* Reached by a connected MCP client and nothing else: no verb sends a payload, and the declared table serves no route for the write, so no shell line can make one. */
  const TRACKER = /forge[_.]memory[_.]write/;

  const tracker = (src) =>
    deny(
      `Hold — re-send with metadata.checked set to the category it belongs in (${FORGE_SOURCES.join(" | ")}), ` +
        "and say in one line which of the five conditions below made it worth keeping.\n\n" +
        `This is project memory${src ? `, written as \`${src}\`` : ""}.\n\n${BRIEF}${how(null, CAUSE.tracker)}`,
    );

  const decide = (payload) => {
    const src = payload?.source ?? "";
    if (!FORGE_SOURCES.includes(src)) done(); // issue/comment/job are system-authored
    const md = payload?.metadata;
    if (md && typeof md === "object" && md.checked) done();
    tracker(src);
  };

  if (TRACKER.test(tool)) decide(ti);

  // Through the shell the content cannot be read — `sed -i` carries none — and the question has to be answered BEFORE the write, so the route is closed for these two kinds of file, not approximated.
  if (tool === "Bash") {
    const written = writtenPaths(struck(shellWrites(ti.command)), ev.cwd || process.cwd(), MD_ONLY);
    if (written.length === 0) done();
    for (const { token, trees, paths } of written) {
      if (basename(token) === "MEMORY.md") continue;
      const resolved = paths.find((path) => GUARDED.test(path));
      if (resolved) {
        const memory = resolved.includes("/memory/");
        const kind = memory ? "a memory file" : "a skill's own text";
        const doubt = resolved === token || trees.length < 2 ? "" : UNSURE;
        /* A file that exists is a correction, and Edit is where that file's own question is asked: the new-file bar here would read as "write nothing" to a run fixing a wrong line. */
        if (existsSync(resolved)) {
          deny(
            `Hold — re-send this change with Edit, which asks what a change to this file owes.${doubt}\n\n`
              + `\`${basename(resolved)}\` is ${kind} that already exists, written through the shell, which `
              + "carries no content for that question to be asked of."
              + how(null, CAUSE.shellHeld),
          );
        }
        // Being sent to another tool teaches nothing about whether a new fact belongs in a file at all.
        deny(
          (memory
            ? `Hold — write it with Write and declare \`type:\` — ${FILE_TYPES.join(" | ")} — if all five `
              + "conditions below hold. Otherwise write nothing."
            : `Hold — write it with Write and name the kind — ${SKILL_CATEGORIES.join(" | ")} — if all five `
              + "conditions below hold. Otherwise change nothing.")
            + `${doubt}\n\n\`${basename(resolved)}\` would be ${kind}, new, written through the shell.\n\n${BRIEF}`
            + how(null, CAUSE.shellNew),
        );
      }
    }
    done();
  }

  if (!["Write", "Edit", "MultiEdit"].includes(tool)) done();
  const path = ti.file_path ?? "";

  // --- a memory file: project knowledge ---
  // MEMORY.md is the index, not a memory: it carries pointers and no frontmatter.
  if (path.includes("/memory/") && path.endsWith(".md") && basename(path) !== "MEMORY.md") {
    // Once per file: a refusal that also refuses the re-send forbids the write outright.
    if (askedAlready(ev, settled(path), "learning-gate")) done();
    askedByAnyone(ev, settled(path), "learning-gate");
    const twin = restated(dirname(resolve(path)), path, ti.content ?? ti.new_string ?? "");
    const held = existsSync(path);
    const fresh = !twin && !held;
    const { route, found } = action(twin, held);
    deny(
      `Hold — ${route}\n\n`
        + `\`${basename(path)}\`${fresh ? " is a new memory. Why should it exist, and will it still matter later?" : " is a memory."}`
        + `${found ? `\n\n${found}` : ""}\n\n${BRIEF}${fresh ? `\n\n${SHAPE}` : ""}`
        + how(null, CAUSE.memory),
    );
  }

  // --- a skill's own text: a skill learning ---
  if (path.includes("/skills/") && OWN_TEXT.test(path)) {
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
        const full = "Keep it in one place and cite it from the other. If the existing wording is "
          + "the worse one, replace it rather than adding beside it.\n\n"
          + "This repeats what the skill already says — that is a defect, not a style "
          + "preference: two authorities for one rule diverge the first time someone corrects only "
          + `the copy they found.\n\n${joined}` + how(null, CAUSE.restated);
        deny(sayOnce(readerKey(ev), "learning-gate", full, {
          route: "learning-gate",
          shape: `\`${basename(path)}\` repeats what the skill already says: keep it in one place and cite it from the other.`,
          cause: `learning-gate/${CAUSE.restated}`,
        }));
      }
    }
    if (askedAlready(ev, settled(path), "learning-gate")) done();
    askedByAnyone(ev, settled(path), "learning-gate");
    deny(
      "Hold — change nothing unless the test below holds. If it does, re-send and answer three things " +
        `in your reply — which category (${SKILL_CATEGORIES.join(" | ")}), whether a ` +
        "check in the plugin could enforce it instead, and what it displaces.\n\n" +
        `\`${basename(path)}\` is a skill's own text: it develops the method, so it must not be ` +
        `a note about this one repository.\n\n${BRIEF}` +
        how(null, CAUSE.skill),
    );
  }
};
