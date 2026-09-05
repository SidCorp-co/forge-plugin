// Stop once between deciding to record something and recording it: a memory row is project
// knowledge, a skill edit develops the method, and how/learning-gate.md says why they must not merge.

import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { askedAlready, askedByAnyone, deny, how, nameLike, settled, shellText, shellWrites, writtenPaths, done } from "../_hook.mjs";
import { compare, load, sentences } from "../../src/checks/duplication.mjs";
import { BRIEF, FILE_TYPES, FORGE_SOURCES, GUARDED, SKILL_CATEGORIES } from "../../src/checks/learning.mjs";
/* The `.md` half of what the shared reading answers: this gate judges content, and a guarded path with any other extension carries none for it to judge. The class is `_hook.mjs`'s, so a name it would read is a name this reads. */
const MD_TOKEN = nameLike("~", "md");

/* Doubt is an action, and the one branch with a tree to name is where this gate can be one. */
const UNSURE =
  " This command could run in more than one tree — a `cd` before `;` or `||` may have failed — and in "
  + "one of them that is the file this write lands on. Join them with `&&` to say which.";

const SHAPE =
  "One file, one fact: `name`, a `description` saying when it applies, `metadata.type` "
  + `(${FILE_TYPES.join("|")}), one pointer line in MEMORY.md.`;

/** Walk up to the directory holding SKILL.md, or null if this is not a skill file. */
function skillRoot(path) {
  let dir = dirname(resolve(path));
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

const action = (twin, exists) => {
  if (twin) {
    /* One line: a sentence can run from a frontmatter description into the next key. */
    const quoted = twin.sentence.split("\n")[0].replace(/^\w+:\s*"?/u, "").trim();
    return `Already in \`${twin.file}\` (${twin.score.toFixed(2)}): "${quoted.slice(0, 100)}"\n\n`
      + "Do this: fix that file if its rule is wrong. Re-send only if this fact is a different one.";
  }
  if (exists) {
    return "Do this: replace the wrong rule in place, or delete the file if it no longer holds — never "
      + "append a second version. Otherwise re-send.";
  }
  return "Do this: if a memory already states this, fix that file. Otherwise re-send.";
};

export const run = (ev) => {
  const tool = ev.tool_name ?? "";
  const ti = ev.tool_input ?? {};

  const TRACKER = /forge[_.]memory[_.]write/;
  /* Through the shell the CLI is the caller, so the verb has to be there: a grep is a read. */
  const CALLED = /\bforge\s+call\s+forge[_.]memory[_.]write\b/;
  const PAYLOAD = /(?:^|\s)('(\{[\s\S]*\})'|"(\{[\s\S]*\})")/u;

  /** What the CLI was handed; one it reads from a file or stdin is judged as a write, not waved through. */
  const payloadIn = (text) => {
    const held = PAYLOAD.exec(text);
    try {
      return JSON.parse(held?.[2] ?? held?.[3] ?? "");
    } catch {
      return { source: FORGE_SOURCES[0] };
    }
  };

  const tracker = (src) =>
    deny(
      `Hold — project memory${src ? `, written as \`${src}\`` : ""}.\n\n${BRIEF}\n\n` +
        `Re-send with metadata.checked set to the category it belongs in (${FORGE_SOURCES.join(" | ")}), ` +
        `and say in one line which of the five conditions made it worth keeping.${how()}`,
    );

  /** One rule for one endpoint, whichever route reached it: the tool's arguments or the CLI's payload. */
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
    const text = shellText(ti.command);
    if (CALLED.test(text)) decide(payloadIn(text));
    const written = writtenPaths(shellWrites(ti.command), ev.cwd || process.cwd(), MD_TOKEN);
    if (written.length === 0) done();
    for (const { token, trees, paths } of written) {
      if (basename(token) === "MEMORY.md") continue;
      const resolved = paths.find((path) => GUARDED.test(path));
      if (resolved) {
        // Being sent to another tool teaches nothing about whether the fact belongs in a file at all.
        const memory = resolved.includes("/memory/");
        deny(
          `Hold — \`${basename(resolved)}\` is ${memory ? "a memory file" : "a skill's own text"}, written `
            + `through the shell.\n\n${BRIEF}\n\n`
            + (memory
              ? `Do this: if all five hold, write it with Write and declare \`type:\` — ${FILE_TYPES.join(" | ")}. Otherwise write nothing.`
              : `Do this: if all five hold, use Edit and name the kind — ${SKILL_CATEGORIES.join(" | ")}. Otherwise change nothing.`)
            + (resolved === token || trees.length < 2 ? "" : UNSURE)
            + how(),
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
    deny(
      `Hold — \`${basename(path)}\`${fresh ? ", a new memory. Why should it exist, and will it still matter later?" : "."}`
        + `\n\n${BRIEF}\n\n${fresh ? `${SHAPE}\n\n` : ""}`
        + action(twin, held) + how(),
    );
  }

  // --- a skill's own text: a skill learning ---
  if (path.includes("/skills/") && /\/(SKILL\.md|guide\.md|references\/[^/]+\.md)$/.test(path)) {
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
            "Do this: keep it in one place and cite it from the other. If the existing wording is " +
            "the worse one, replace it rather than adding beside it." + how(),
        );
      }
    }
    if (askedAlready(ev, settled(path), "learning-gate")) done();
    askedByAnyone(ev, settled(path), "learning-gate");
    deny(
      `Hold — \`${basename(path)}\` is a skill's own text: it develops the method, so it must not be ` +
        `a note about this one repository.\n\n${BRIEF}\n\n` +
        "Do this: change nothing unless the test holds. If it does, re-send and answer three things " +
        `in your reply — which category (${SKILL_CATEGORIES.join(" | ")}), whether a ` +
        "check in the plugin could enforce it instead, and what it displaces." +
        how(),
    );
  }
};
