#!/usr/bin/env node
// Nudge once when a checker is about to hard-code the cases it knows. A nudge and not a refusal,
// and silenced by a comment above the literal — how/derive-dont-list.md has the measurement behind both.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { askedAlready, block, readEvent, touched, how } from "./_hook.mjs";

// Only files whose job is to check something; nudging every array literal earns an ignore list.
const CHECKER =
  /(lint|check|guard|rule|verify|validate|audit)[^/]*\.(py|mjs|js|ts)$|\/scripts\/[^/]+\.(mjs|js|py)$|\.test\.(ts|tsx|js|mjs)$/;

const LIST = /(?:const|let|var|^\s*[A-Z_]+\s*=)\s*[\w:[\]<>,\s]*=\s*[[{]([^\]}]{0,400})[\]}]/gm;
const CONSTS = /['"]([A-Z][A-Z0-9_]{2,})['"]/g;

/** The file as it now stands: a `sed -i` leaves no tool_input to read, only a file. */
function contentOf(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function isExplained(text, start) {
  const before = text.slice(0, start).replace(/\s+$/, "");
  const line = before.slice(before.lastIndexOf("\n") + 1).trimStart();
  return ["//", "/*", "*", "#"].some((open) => line.startsWith(open));
}

function offending(text) {
  let worst = [];
  for (const m of text.matchAll(LIST)) {
    if (isExplained(text, m.index)) continue;
    const found = [...m[1].matchAll(CONSTS)].map((c) => c[1]);
    if (found.length > worst.length) worst = found;
  }
  return worst;
}

const ev = readEvent();
for (const path of touched(ev)) {
  if (!CHECKER.test(path)) continue;
  const found = offending(contentOf(path));
  if (found.length < 3 || askedAlready(ev, path, "derive-dont-list")) continue;
  const sample = found.slice(0, 4).join(", ") + (found.length > 4 ? "…" : "");
  block(
    `${basename(path)} — asked once, then this file is yours.\n\n` +
      `This checker is about to hard-code ${found.length} constants (${sample}). A list is silent ` +
      "on the case it never met, and cries wolf when someone extends the thing correctly.\n\n" +
      "Do this: derive them from the source — read the enum, parse the switch, key on the declared " +
      "type. If enumerating IS the point, say so in a comment above the list." +
      how()
  );
}
