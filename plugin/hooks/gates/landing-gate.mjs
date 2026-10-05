// Under ship `ready` the landing runs the project's whole-tree gate, and nothing before it does. how/landing-gate.md.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { commandsAt, opensWithAny } from "../../src/hooks/declared-at.mjs";
import { offReach } from "../../src/hooks/hook-switch.mjs";
import { enumOf, projectFileAt } from "../../src/resolve/settings.mjs";
import { gitDirAt, runFor, runIdAt } from "../../src/resolve/session/run-id.mjs";
import { declaredClasses, declaredCommands } from "../../src/stats/corpus/declared.mjs";
import { deny, done, how, shellText } from "../_hook.mjs";

const GATE = "landing-gate";

/* Both halves are the project's own: a tree that never said `ready`, or never named its gate, has not
   decided that a gate run is the landing's alone, and is refused nothing (G-12). The source is passed
   so that reading another tree's mode resolves nothing about this process's own project. */
const heldIn = (tree) => {
  const parsed = projectFileAt(tree);
  if (enumOf("ship", parsed, tree).value !== "ready") return { classes: [], said: [] };
  const declared = parsed?.stats?.commands ?? null;
  return {
    classes: declaredClasses(declared).filter(([label]) => label === "gate"),
    said: declaredCommands("gate", declared),
  };
};

const BRANCHED = /^ref: refs\/heads\/(iss-\d+)(?:-|$)/iu;

/* The issue the tree is working, so the hand-over line is one a run can send as it stands: the run id
   a dispatch minted beside the tree's git directory, else a branch named for the issue. */
const keyOf = (tree) => {
  const minted = runFor(runIdAt(tree));
  if (minted) return minted.toUpperCase();
  const dir = gitDirAt(tree);
  let head = "";
  try {
    head = dir ? readFileSync(join(dir, "HEAD"), "utf8") : "";
  } catch {
    head = "";
  }
  return BRANCHED.exec(head.trim())?.[1].toUpperCase() ?? "ISS-nn";
};

export const run = (ev) => {
  if (ev.tool_name !== "Bash") done();
  const cwd = ev.cwd ?? process.cwd();
  /* A destination no reading names is not judged: refusing it would rest on a guess at whose gate it is. */
  const hit = commandsAt(shellText((ev.tool_input ?? {}).command), cwd, heldIn)
    .find(({ tree, held, here }) => tree && opensWithAny(held.classes, here));
  if (!hit) done();
  const key = keyOf(hit.tree);
  deny(
    "Run the suites that exercise the files this change touched, then hand it over: "
      + `\`forge claim ${key} --pushed --ready\`.\n\n`
      + `Refused: ${hit.held.said.map((one) => `\`${one}\``).join(" or ")} is this project's whole-tree gate, and under `
      + "ship `ready` the landing gates every change on the base as it is, so a builder's run of it measures "
      + "nothing the landing will not. "
      + `Past the gate: \`forge hooks --off ${GATE}\`, ${offReach(GATE)}.`
      + how(),
  );
};
