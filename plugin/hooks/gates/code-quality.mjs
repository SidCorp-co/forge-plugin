// Hands every code file a call wrote to the linter the project configured. Owns the routes, never the rules; how/code-quality.md says why the split falls there.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";

import { configuresLint, linting, MAX_FILES } from "../../src/hooks/lint-delegate.mjs";
import { askedAlready, block, context, remaining, touched } from "../_hook.mjs";

const SPARE_MS = 5_000;

/* Once per content: two of seventeen blocks landed on a grep naming a file written a moment before. */
const shaOf = (file) => {
  try {
    return createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
};

const WHY = {
  cap: `past the first ${MAX_FILES} code files in path order, which is as many as one call's gate lints`,
  clock: "the event's clock ran out before them",
  timeout: "the linter did not answer within its time limit",
};

/* Said rather than refused: a file never read and a file that passed were the same silence (ISS-38). */
const unlinted = (ev, files) => {
  const shown = (file) => {
    const near = relative(ev.cwd || process.cwd(), file);
    return near.startsWith("..") || isAbsolute(near) ? file : near;
  };
  const lines = Object.entries(WHY)
    .map(([why, text]) => [text, files.filter((one) => one.unread === why).map((one) => shown(one.file))])
    .filter(([, names]) => names.length)
    .map(([text, names]) => `  ${text}: ${names.join(", ")}`);
  return `Not linted, so nothing here says these pass:\n${lines.join("\n")}\n`
    + `  Clear it: run the project's linter on them, or write them across calls of at most ${MAX_FILES} code files.`;
};

export const run = (ev) => {
  const asked = (file) => {
    const before = shaOf(file);
    return Boolean(before) && askedAlready(ev, `${file}@${before}`, "code-quality", { set: false });
  };
  const reasons = [];
  const unread = [];
  for (const one of linting(ev, touched(ev), () => remaining() - SPARE_MS, { skip: asked })) {
    const { file, said } = one;
    if (one.unread && configuresLint(file)) unread.push(one);
    if (!said) continue;
    reasons.push(said);
    /* Stamped as it stands after the delegate, which may have formatted it. */
    const after = shaOf(file);
    if (after) askedAlready(ev, `${file}@${after}`, "code-quality");
  }
  const note = unread.length ? unlinted(ev, unread) : "";
  if (reasons.length) block([...reasons, note].filter(Boolean).join("\n\n"));
  if (note) context(note);
};
