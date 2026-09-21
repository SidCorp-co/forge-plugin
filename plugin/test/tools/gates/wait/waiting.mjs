/* What a case about the gate wait needs of a tree and of a wait's own output, shared by the two files that ask: one about the answers a wait can give, one about the deadline it may be given to give them in. The minutes are a tick fast enough that a case waits on the state under test rather than on a constant, and the ceiling is the one the case declares rather than the one this repository does — a suite reading this machine's record of the project would answer to the box it runs on. */
import { waitForVerdict } from "../../../../../tools/gates/verdict.mjs";
import { placeFor } from "../../../../../tools/gates/machine.mjs";
import { HANGS_IN, scratch } from "../scratch.mjs";

export const BRIEFLY = 0.02;
export const TICK = 40;

export const heard = () => {
  const lines = [];
  const collect = lines.push.bind(lines);
  return { lines, say: collect, warn: collect };
};

export const waited = (work, said, minutes = BRIEFLY) => waitForVerdict(work, { minutes, tick: TICK, ...said });

export const holding = (name, runs = null) => scratch(name, null, null, { hanging: HANGS_IN, runs });

export const ofOne = (ours) => placeFor(ours, { declared: { value: 1, from: "the case" } });
