#!/usr/bin/env node
// The half no list of shapes reaches: a guarded file that changed with the question never put.

import { basename } from "node:path";

import { askedAlready, block, how, named, readEvent, settled, touched } from "./_hook.mjs";
import { BRIEF, guarded } from "../src/learning.mjs";

const ev = readEvent();
/* A link out of a guarded directory answers as its target, so the name the call used counts too. */
const spelled = named(ev).filter((one) => guarded(one));

for (const file of touched(ev)) {
  const asLink = spelled.find((one) => settled(one) === file);
  if (!guarded(file) && !asLink) continue;
  if (askedAlready(ev, file, "learning-gate", { set: false })) continue;
  if (askedAlready(ev, file, "learning-landed")) continue;
  block(
    `\`${basename(asLink ?? file)}\` changed and nothing asked whether it should exist — a route no `
      + `check reads.\n\n${BRIEF}\n\nDo this: say in one line which of the four conditions this file `
      + `meets. If none does, remove it. Reach for Write or Edit next time, where the question comes first.`
      + how(),
  );
}
