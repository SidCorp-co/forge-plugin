// The half no list of shapes reaches: a guarded file that changed with the question never put.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { FRESH_MS, askedAlready, askedByAnyone, block, how, named, settled, touched } from "../../_hook.mjs";
import { BRIEF, guarded, installedCopy, shippedSkill, swept } from "../../../src/checks/learning.mjs";
import { digestOf } from "../../../src/keys/digest.mjs";

/* Keyed by the bytes that landed, not the name alone, so this gate's question tracks content as the
   pre-write gate's askOnce does (ISS-58). Unreadable, the name alone. */
const bodyKey = (file) => {
  try {
    return `${file}\0${digestOf(readFileSync(file, "utf8"))}`;
  } catch {
    return file;
  }
};

export const run = (ev) => {
  /* A link out of a guarded directory answers as its target, and that target is the key the gate
     stamps — so the map is keyed by it, and the name the call used is carried alongside to print. */
  const spelled = named(ev).filter((one) => guarded(one));
  const landed = new Map(
    [...touched(ev), ...swept(ev, FRESH_MS)].map((one) => [settled(one), one]),
  );

  const asked = [];
  for (const [file, spelling] of landed) {
    /* Every name the file went by, link or target: any guarded one is a guarded write, and prints. */
    const names = [spelling, spelled.find((one) => settled(one) === file), file].filter(Boolean);
    if (!names.some((one) => guarded(one))) continue;
    if (installedCopy(file)) continue;
    if (shippedSkill(file, ev.cwd)) continue;
    if (askedByAnyone(ev, file, "learning-gate", { set: false })) continue;
    if (askedAlready(ev, file, "learning-gate", { set: false })) continue;
    if (askedByAnyone(ev, bodyKey(file), "learning-landed")) continue;
    asked.push(basename(names.find((one) => guarded(one)) ?? spelling));
  }

  if (asked.length) {
    block(
      "Say in one line which of the five conditions below each file meets. If none does, remove it. If "
        + "this run did not write it — somebody else's edit, or a file the call only read — say which, "
        + "and it is not asked again. Reach for Write or Edit next time, where the question comes first."
        + `\n\n${asked.map((one) => `\`${one}\``).join(", ")} changed `
        + `and nothing asked whether ${asked.length > 1 ? "they should" : "it should"} exist — a route no `
        + `check reads.\n\n${BRIEF}`
        + how(),
    );
  }
};
