// Hands every code file a call wrote to the linter the project configured. Owns the routes, never
// the rules; how/code-quality.md says why the split falls there.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { CODE, FILE_MS, SKIP, lintOne } from "../../src/hooks/lint-delegate.mjs";
import { askedAlready, block, remaining, touched } from "../_hook.mjs";

const MAX_FILES = 5;
const SPARE_MS = 5_000;

/* Once per content: two of seventeen blocks landed on a grep naming a file written a moment before. */
const shaOf = (file) => {
  try {
    return createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
};

export const run = (ev) => {
  const files = touched(ev)
    .filter((f) => CODE.test(f) && !SKIP.test(f))
    .slice(0, MAX_FILES);
  const reasons = [];
  for (const file of files) {
    const left = remaining() - SPARE_MS;
    if (left < 1000) break;
    const before = shaOf(file);
    if (before && askedAlready(ev, `${file}@${before}`, "code-quality", { set: false })) continue;
    const said = lintOne(ev, file, Math.min(FILE_MS, left));
    if (!said) continue;
    reasons.push(said);
    /* Stamped as it stands after the delegate, which may have formatted it. */
    const after = shaOf(file);
    if (after) askedAlready(ev, `${file}@${after}`, "code-quality");
  }
  if (reasons.length) block(reasons.join("\n\n"));
};
