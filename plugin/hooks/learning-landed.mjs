#!/usr/bin/env node
// The half no list of shapes reaches: a guarded file that changed with the question never put.

import { basename } from "node:path";

import { askedAlready, block, how, readEvent, settled, touched } from "./_hook.mjs";
import { BRIEF, guarded } from "../src/learning.mjs";

const ev = readEvent();

for (const file of touched(ev)) {
  const key = settled(file);
  if (!guarded(file)) continue;
  /* The gate already asked about this one, and asking twice for one write is a false refusal. */
  if (askedAlready(ev, key, "learning-gate", { set: false })) continue;
  if (askedAlready(ev, key, "learning-landed")) continue;
  block(
    `\`${basename(file)}\` changed and nothing asked whether it should exist — a route no check `
      + `reads.\n\n${BRIEF}\n\nDo this: say in one line which of the four conditions this file meets. `
      + `If none does, remove it. Reach for Write or Edit next time, where the question comes first.`
      + how(),
  );
}
