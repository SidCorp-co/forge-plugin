// Hands every code file a call wrote to the linter the project configured. Owns the routes, never the rules; how/code-quality.md says why the split falls there.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { linting } from "../../src/hooks/lint-delegate.mjs";
import { askedAlready, block, remaining, touched } from "../_hook.mjs";

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
  const asked = (file) => {
    const before = shaOf(file);
    return Boolean(before) && askedAlready(ev, `${file}@${before}`, "code-quality", { set: false });
  };
  const reasons = [];
  for (const { file, said } of linting(ev, touched(ev), () => remaining() - SPARE_MS, { skip: asked })) {
    if (!said) continue;
    reasons.push(said);
    /* Stamped as it stands after the delegate, which may have formatted it. */
    const after = shaOf(file);
    if (after) askedAlready(ev, `${file}@${after}`, "code-quality");
  }
  if (reasons.length) block(reasons.join("\n\n"));
};
