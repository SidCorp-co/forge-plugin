#!/usr/bin/env node
// The half no list of shapes reaches: a guarded file that changed with the question never put.

import { basename } from "node:path";

import { FRESH_MS, askedAlready, askedByAnyone, block, how, named, readEvent, settled, touched } from "./_hook.mjs";
import { BRIEF, guarded, swept } from "../src/learning.mjs";

const ev = readEvent();
/* A link out of a guarded directory answers as its target, so the name the call used counts too. */
const spelled = named(ev).filter((one) => guarded(one));
const landed = [...new Set([...touched(ev), ...swept(ev, FRESH_MS)])];

const asked = [];
for (const file of landed) {
  const asLink = spelled.find((one) => settled(one) === file);
  if (!guarded(file) && !asLink) continue;
  if (askedByAnyone(ev, file, "learning-gate", { set: false })) continue;
  if (askedAlready(ev, file, "learning-gate", { set: false })) continue;
  if (askedByAnyone(ev, file, "learning-landed")) continue;
  asked.push(basename(asLink ?? file));
}

if (asked.length) {
  block(
    `${asked.map((one) => `\`${one}\``).join(", ")} changed and nothing asked whether ${
      asked.length > 1 ? "they should" : "it should"
    } exist — a route no check reads.\n\n${BRIEF}\n\nDo this: say in one line which of the four `
      + `conditions each file meets. If none does, remove it — or say it was somebody else's edit, and `
      + `it is not asked again. Reach for Write or Edit next time, where the question comes first.`
      + how(),
  );
}
