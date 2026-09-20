/* What this project has not decided, which is a different question from what it has. The rows that
   report a value in force stay silent where a project decided nothing, and that silence is right: a
   default printed as a decision is a decision nobody made. This is the second question — which
   decisions are open — and it is a reading of its own, off the same table the writes are read from.
   docs/cli/the-subjects.md. */
import { BRIEF_ROUTE } from "../../../tracker/knowledge/brief.mjs";
import { declarablePaths, setCall } from "../project-file.mjs";
import { projectFileHere } from "../../../resolve/settings.mjs";

/* How a value of each shape is typed on a command line, and the name a project chooses for itself
   where the path takes one. A shape this does not hold is spelled as text, which is what the word
   reader falls back to for it. */
const SPELLS = { text: "<text>", number: "<number>", list: "<one,two>", commands: "<command>" };
const A_NAME = "<name>";

/* Whether the document holds a value at this path, a `*` standing for any one name the project
   chose: the question is what it wrote, never what its absence resolves to. */
const held = (at, segments) => {
  if (!at || typeof at !== "object" || Array.isArray(at)) return false;
  const [head, ...rest] = segments;
  const names = head === "*" ? Object.keys(at) : (Object.hasOwn(at, head) ? [head] : []);
  return names.some((one) => (rest.length ? held(at[one], rest) : at[one] !== undefined));
};

const rowFor = (one) => {
  const path = one.path.replaceAll("*", A_NAME);
  return { label: path,
    detail: `not set — ${one.routed ?? setCall(path, SPELLS[one.takes] ?? SPELLS.text)}` };
};

/** Every path of this project's own file it has written no value to, each with the call that writes
 *  it. The parse is the one every reader of a single key takes, so this reading and those cannot
 *  disagree about which file is the project's. */
export const undecidedKeyRows = (parsed = projectFileHere()) =>
  declarablePaths().filter((one) => !held(parsed, one.path.split("."))).map(rowFor);

/** The brief as a decision rather than as prose, so a project reads what it has not stored in the
 *  same call as the keys it has not set. A read the store refused is no absence: `carried` says
 *  whether the brief's own reading is in this one and will report that refusal itself, and where it
 *  is not, this row is the finding that this reading is short — a diagnosis that gave up on half of
 *  what it was asked for and printed nothing is the one outcome it may not have. */
export const briefUndecided = (read, carried = false) => {
  if (!read || read.entry) return [];
  if (!read.refused) return [{ label: "project brief", detail: `none stored — ${BRIEF_ROUTE}` }];
  return carried ? [] : [{ level: "miss", label: "project brief",
    detail: `unread, so whether one is stored was not read here — ${read.refused}` }];
};
