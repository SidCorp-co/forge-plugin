/* The goals a project's brief states, and the `Serves:` line a record or a filing names one on. Out
   of `tracker/`, which owns the brief, because `rank/print.mjs` spends only `servesSaid` and must
   not pull the tracker graph in. When the line is written: `forge guide issue-flow`. */
import { clauseOf } from "./spec/index.mjs";
import { parseRef } from "./spec/parse.mjs";
import { specTreeIfAny } from "./spec/tree.mjs";
import { withoutExamples } from "./markdown.mjs";

export const SECTION = "What this project is for";
export const NONE_STATED = "none stated";
export const NOT_STATED = "not stated";
/* A brief line names its source after this, and a goal's words end where its provenance starts. */
export const SOURCE_MARK = "←";

const HEADING = new RegExp(String.raw`^#{1,6}[ \t]*${SECTION}[ \t]*$`, "imu");
const NEXT_HEADING = /^#{1,6}[ \t]/mu;

/* The tree's own notation, emphasised or bare, so a project keeping one writes goals as clauses. */
const GOAL = /^[ \t]*(?:[-*+][ \t]+)?\*{0,2}([A-Z][A-Z0-9]*-\d+(?:-\d+)*)\*{0,2}[ \t.:—-]+(.+)$/u;
const SERVES = /^[ \t]*serves:[ \t]*(.+?)[ \t]*$/gimu;
const ASKS = /serves:/iu;

/* Which reason there is no list, since each has its own way out and *not stated* alone has none. */
export const WHY = {
  endpoint: "no endpoint is saved, so nothing could be asked for this project's brief",
  aimed: "no project is aimed, so no brief was read",
  unread: "the store would not answer for this project's brief",
  stored: "this project has no brief stored",
  section: `this project's brief has no *${SECTION}* section`,
  none: `this project's brief has that section and it identifies no goal`,
};

const sectionIn = (body) => {
  const text = withoutExamples(String(body ?? ""));
  const at = text.search(HEADING);
  if (at < 0) return null;
  const after = text.slice(at).split("\n").slice(1).join("\n");
  const end = after.search(NEXT_HEADING);
  return end < 0 ? after : after.slice(0, end);
};

/** One entry per identified line of the section; `why` names which reason there is none. */
export const goalsIn = (body) => {
  const held = sectionIn(body);
  if (held === null) return { goals: [], why: WHY.section };
  const goals = [];
  for (const line of held.split("\n")) {
    const found = GOAL.exec(line);
    if (!found) continue;
    const at = found[2].lastIndexOf(SOURCE_MARK);
    goals.push({ id: found[1].toUpperCase(), text: (at < 0 ? found[2] : found[2].slice(0, at)).trim() });
  }
  return { goals, why: goals.length ? null : WHY.none };
};

export const servesIn = (body) => {
  const text = String(body ?? "");
  if (!ASKS.test(text)) return [];
  return [...new Set([...withoutExamples(text).matchAll(SERVES)].map((one) => one[1].trim()))];
};

export const isNoneStated = (value) => String(value ?? "").toLowerCase() === NONE_STATED;

/** Which source answers for a value, or null where neither does. The brief is asked first: the tree
 *  costs a directory walk, so a value the brief lists is never looked for twice. */
export const resolvedBy = (value, goals, asksTree = true) => {
  if (isNoneStated(value)) return "the line the method calls legal";
  const asked = String(value ?? "").toUpperCase();
  if (goals.some((one) => one.id === asked)) return `the brief's *${SECTION}* section`;
  if (!asksTree) return null;
  const ref = parseRef(value);
  if (!ref) return null;
  const index = specTreeIfAny();
  return index && clauseOf(index, ref.id) ? "this project's requirements tree" : null;
};

const listed = (read) => read.goals.map((one) => one.id);

const NAMES = "Which goal a decision or a filing names, and when the line is written: "
  + "`forge guide issue-flow`.";

/** A value neither source answers for. Nothing is refused for naming no goal — an absent line and
 *  `none stated` both pass — so a caller reaching here typed a value nothing resolves. */
export const servesRefusal = (values, read, what, asksTree = true) => {
  if (values.length > 1) {
    return `${what} carries ${values.length} \`Serves:\` lines: ${values.join(", ")}. One decision `
      + "or one filing serves one goal, so keep the line it is for and delete the rest.";
  }
  const [value] = values;
  if (value === undefined || resolvedBy(value, read.goals, asksTree)) return null;
  const ids = listed(read);
  return [
    `${what} says \`Serves: ${value}\`, and neither source of this project answers for it:`,
    `  its brief's *${SECTION}* section: ${ids.length ? ids.join(", ") : `${NOT_STATED}, ${read.why}`}`,
    asksTree
      ? `  its requirements tree: no clause \`${value}\` — \`forge spec\` prints what it does hold`
      : "  its requirements tree: not read from here — this write goes to a project this checkout"
        + " is not, and the tree under it answers for some other backlog",
    `Name one of those, or \`Serves: ${NONE_STATED}\`, which is legal and visible; nothing is refused`,
    `for serving no goal. ${NAMES}`,
  ].join("\n");
};

const HOW = {
  [WHY.endpoint]: "Save one: forge doctor --token <pat> --url <endpoint>",
  [WHY.aimed]: "Aim one: a `.forge.json` naming the project's slug",
  [WHY.unread]: "Read it again: forge project",
  [WHY.stored]: "Write one: forge project --refresh <brief.md> --title <one line>",
  [WHY.section]: `Add the section: forge project --refresh <brief.md>, one line per goal under \`## ${SECTION}\``,
  [WHY.none]: "Write the goals Phase 0 discovered: forge project --line <n> <text>",
};

/** The line `forge project` prints and the block a verb's `-h` carries, each naming the way out of
 *  the reason there is no list: *not stated* on its own is a line a run cannot act on. */
export const goalLine = (read) => (read.why
  ? `  goals: ${NOT_STATED} — ${read.why}. ${HOW[read.why]}`
  : `  goals: ${listed(read).join(", ")} — read from the brief's *${SECTION}* section, `
    + "and what a `Serves:` may name beside a clause of this project's tree");

export const goalBlock = (read, what, asksTree = true) => {
  const besides = asksTree ? "or a clause of its requirements tree" : "which is its only source here";
  return read.why
    ? [`${what} may carry a \`Serves:\` line, and this project states no goal one could name:`,
      `${read.why}. ${HOW[read.why]}.`,
      `Until then the line reads \`Serves: ${NONE_STATED}\`${asksTree
        ? " or names a clause of this project's requirements tree"
        : ""}, and nothing is refused for serving no goal. ${NAMES}`]
    : [`${what} may carry one \`Serves:\` line naming a goal of this project ${besides}.`,
      `\`Serves: ${NONE_STATED}\` is legal and nothing is refused for serving no goal. ${NAMES}`,
      "This project's goals, from its brief:",
      ...read.goals.map((one) => `  ${one.id.padEnd(6)}${one.text}`)];
};

/** What a reader is told a body serves: the value it names, or that it names none. */
export const servesSaid = (values) => {
  if (!values.length) return NONE_STATED;
  return values.length > 1 ? `${values.join(", ")} (more than one, and one is owed)` : values[0];
};
