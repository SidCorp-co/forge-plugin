/* What belongs to one `forge record` call rather than to one of its kinds: the flags saying what the
   run is doing, and the split into a block per kind. What a rung cites is `CITED`'s and the move
   that set earns is `advance.mjs`'s. docs/cli/record.md. */
import { FLAG_WORD, noValue, pullRepeated } from "../../resolve/flags.mjs";
import { refuse } from "../../refusal.mjs";
import { didYouMean } from "../../suggest.mjs";
import { KINDS, kindUsage } from "./record-rows.mjs";
import { nextLine } from "../lease.mjs";
import { patchFrom } from "../worklog.mjs";

/* Named once: `pullRun` strips them, and `criteria` offers them back to a caller who typed one. */
export const RUN_FLAGS = ["--open", "--next", "--pushed", "--review"];
const [OPEN, NEXT, ...TOGGLES] = RUN_FLAGS;

export const ALSO = "--also";

const pullOne = (argv, flag) => {
  const at = argv.indexOf(flag);
  if (at < 0) return { value: undefined, rest: argv };
  const value = argv[at + 1];
  if (value === undefined || FLAG_WORD.test(value)) refuse(noValue("record", flag, value));
  return { value, rest: [...argv.slice(0, at), ...argv.slice(at + 2)] };
};

/** The run flags of a whole call, and what is left of each block. Pulled block by block so a flag is
 *  judged against the usage of the kind it stands under, and merged: they are the call's, not one payload's. */
export const pullRun = (blocks) => {
  const open = [];
  const took = Object.fromEntries(TOGGLES.map((flag) => [flag.slice(2), false]));
  let next;
  const rest = blocks.map((one) => {
    const usage = kindUsage(one.kind);
    const lines = pullRepeated(one.argv, OPEN, `record ${one.kind}`, { usage });
    open.push(...lines.values);
    const line = pullOne(lines.rest, NEXT);
    if (line.value !== undefined) next = line.value;
    let held = line.rest;
    for (const flag of TOGGLES) {
      took[flag.slice(2)] = took[flag.slice(2)] || held.includes(flag);
      held = held.filter((two) => two !== flag);
    }
    return { kind: one.kind, argv: held };
  });
  return { next: nextLine(next), patch: patchFrom({ ...took, open }), rest };
};

/** Every kind of one call: the first is the positional one, each `--also <kind>` opens another, and
 *  what stands after a kind and before the next `--also` is that kind's own payload. */
export const kindBlocks = (first, argv) => {
  const blocks = [{ kind: first, argv: [] }];
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] !== ALSO) {
      blocks.at(-1).argv.push(argv[at]);
      continue;
    }
    const kind = argv[at + 1];
    if (kind === undefined || FLAG_WORD.test(kind)) refuse(noValue("record", ALSO, kind));
    if (!KINDS.includes(kind)) {
      refuse(`${ALSO} opens another kind of this same rung. `
        + `${didYouMean("record kind", kind, KINDS)} Kinds: ${KINDS.join(", ")}.`);
    }
    if (blocks.some((one) => one.kind === kind)) {
      refuse(`This call names the kind \`${kind}\` twice. A rung cites each kind once, and one call `
        + `writing two of a kind leaves the record saying only what the second one said.`);
    }
    blocks.push({ kind, argv: [] });
    at += 1;
  }
  return blocks;
};
