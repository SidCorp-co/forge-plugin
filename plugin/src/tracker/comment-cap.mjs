/* One record write posts one comment, and the tracker caps what a comment holds. The body is
   measured where it is rendered, ahead of every upload: the tracker refuses a longer one only after
   the files it cites are up, and there is no delete for those (ISS-489). Beside the writer whose
   caps it reads, and importing the record's shape upward as `field-write.mjs` imports the lease. */
import { SHAPES, criterionNumber } from "../flow/machine.mjs";
import { render } from "../flow/record/page.mjs";
import { capsOf, lengthOf } from "./field-write.mjs";
import { refuse } from "../refusal.mjs";

/** Null where nothing declares one, which measures nothing rather than guessing a number. */
export const bodyCap = () => capsOf("forge_comments").body?.self ?? null;

const nameOf = (per, got) => String(criterionNumber(got[per]) ?? got[per]);

/* In the order written, so each write is the typed command with blocks removed. A block over the
   cap by itself fits no write: it is set apart with the amount it is over by, and does not close
   the group around it, which would only owe one more write. */
const packed = (kind, blocks, stamp, cap) => {
  const groups = [];
  const alone = [];
  let open = [];
  for (const got of blocks) {
    const self = lengthOf(render(kind, [got], stamp));
    if (self > cap) {
      alone.push({ got, over: self - cap });
      continue;
    }
    if (open.length && lengthOf(render(kind, [...open, got], stamp)) > cap) {
      groups.push(open);
      open = [];
    }
    open.push(got);
  }
  if (open.length) groups.push(open);
  return { groups, alone };
};

const splitLines = (kind, blocks, stamp, { cap, uploads }) => {
  const per = SHAPES[kind].per;
  const { groups, alone } = packed(kind, blocks, stamp, cap);
  const names = (group) => group.map((got) => nameOf(per, got)).join(", ");
  const lines = [];
  if (groups.length) {
    /* Named as blocks and never as a flag to paste: a block carries its own values after its
       --criterion, and a line reading `--criterion 1, 2` retyped would be one value, not two. */
    lines.push(groups.length > 1
      ? `Split it into ${groups.length} writes, each this command keeping only the blocks on its line, whole:`
      : "The rest fit one write, this command keeping only these blocks, whole:");
    for (const group of groups) {
      lines.push(`  the --${per} blocks ${names(group)}  (${lengthOf(render(kind, group, stamp))} code points)`);
    }
  }
  for (const { got, over } of alone) {
    lines.push(`--${per} ${nameOf(per, got)} is over the cap by itself, so no split carries it: `
      + `shorten its own values by ${over} and write it alone.`);
  }
  if (groups.length > 1 && uploads.length) {
    lines.push("A file goes up with the first of these writes that cites it. Every write after that "
      + "cites it by name, because sending the path again would collide with the name already there:",
    `  --evidence ${uploads.join(" --evidence ")}`);
  }
  return lines;
};

/** The comment the write posts, or a refusal of the one the tracker would refuse, naming the cap, the
 *  length, how much has to come off and, for a kind that opens a block per value, the writes it
 *  splits into. `uploads` are the files this write would send, each named as it would go up. */
export const renderedWithin = (kind, blocks, stamp, { reference, uploads }) => {
  const body = render(kind, blocks, stamp);
  const cap = bodyCap();
  const length = lengthOf(body);
  if (cap === null || length <= cap) return body;
  const opening = `record ${kind} on ${reference} would post a comment of ${length} code points, and the `
    + `tracker caps a comment at ${cap}. It refuses a longer one only after this write's uploads and `
    + `field writes have landed, and an upload cannot be deleted. Nothing was sent. ${length - cap} `
    + "has to come off.";
  const per = SHAPES[kind].per;
  const names = (uploads ?? []).map((one) => one.name);
  const more = per ? splitLines(kind, blocks, stamp, { cap, uploads: names }) : ["Shorten it by that much."];
  return refuse([opening, ...more].join("\n"));
};
