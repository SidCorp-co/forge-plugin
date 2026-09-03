// The half no list of shapes reaches: a guarded file that changed with the question never put.

import { basename } from "node:path";

import { FRESH_MS, askedAlready, askedByAnyone, block, how, named, settled, touched } from "../_hook.mjs";
import { BRIEF, guarded, swept } from "../../src/checks/learning.mjs";

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
    if (askedByAnyone(ev, file, "learning-gate", { set: false })) continue;
    if (askedAlready(ev, file, "learning-gate", { set: false })) continue;
    if (askedByAnyone(ev, file, "learning-landed")) continue;
    asked.push(basename(names.find((one) => guarded(one)) ?? spelling));
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
};
