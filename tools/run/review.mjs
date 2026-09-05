/* Where the mark lives, what a write of it has to prove, what the count over it reads, and what a
   batch reading is OWED — the last of these here and in no prompt, so the run reads it off its own
   issue and a person types none of it. The counting and the filing are the runner's;
   `docs/cli/knowledge.md` says why this half moved. */
import { gitOut, REMOTE } from "../checkout.mjs";

export const REVIEWED = "refs/forge/reviewed";
export const REVIEW_PATHS = ["plugin/src", "plugin/hooks", "plugin/bin"];
/* Volume alone, because the release count fired first on both readings it ever triggered — three
   releases at thirty-six changed lines the first time — so the trigger was the calendar of
   releases and not the code there is to read (ISS-112). Releases are still printed. */
export const REVIEW_LINES = 500;

const KEY = /ISS-\d+/gu;

/** The issues whose work the range carries, ascending, read off the subjects rather than from any
 *  list a person keeps: a release commit names no issue, and the commits it released do. */
const spanned = (tree, from) => {
  const subjects = gitOut(["log", "--first-parent", "--format=%s", `${from}..HEAD`], tree) ?? "";
  return [...new Set(subjects.match(KEY) ?? [])].sort((one, two) => Number(one.slice(4)) - Number(two.slice(4)));
};

export const reviewBody = ({ tree, from, to, volume, self }) => {
  const keys = spanned(tree, from);
  const paths = REVIEW_PATHS.join(" ");
  return [
    "## Outcome",
    "",
    `The whole of ${from.slice(0, 7)}..${to.slice(0, 7)} is read once, as one batch, by a run that`,
    `wrote none of it: ${volume} under ${REVIEW_PATHS.join(", ")}. What that reading finds is landed`,
    `or filed, and ${REVIEWED} then names the head it read to, so the next batch counts from there.`,
    "",
    "## Rules",
    "",
    `- The range is a commit pair and the reading is its diff under those three paths, from the run's`,
    `  own tree: \`git diff ${from}..${to} -- ${paths}\`.`,
    "- What it looks for is what no single issue's review can see: a helper two runs each wrote, a",
    "  simplification two changes apart, a parameter nothing passes any more, a shape one run left",
    "  half moved.",
    "- Behaviour stays as it is. A finding lands as one commit that only simplifies, reviewed like any",
    "  other commit; anything that would alter what the code does is filed as its own issue naming",
    "  this one, never fixed here.",
    "- The reading ends by writing what it learned of this codebase to the project's knowledge store,",
    "  one entry per module or area it read: `forge knowledge write module-<name> <file.md> --kind",
    "  reference`, saying what the module owns, which of its helpers are the shared ones, its traps,",
    "  and the issues that shaped it. An entry says what is and cites where it was read; a convention",
    "  two runs each half-followed is an entry of kind `rule` with the two places in its body. The",
    "  project brief is refreshed through `forge project --refresh`, which stamps the digests of the",
    "  files it was read from in the same call, where this reading changed what it says.",
    "  `forge knowledge -h` carries the shape, and the run's verification cites the entries written.",
    `- Issues whose releases this range spans: ${keys.join(", ") || "none, so the range is unreleased work"}.`,
    `- The run ends from its own tree with \`${self} review --done ${to}\`, after its own ship. The ref`,
    "  is named and not defaulted: it is this range's end, which is the head the reading reached, and",
    "  other runs land on this branch while the reading is read (ISS-146).",
    "",
    "## Out of scope",
    "",
    "Each issue's own diff, which its own run already reviewed, and any change of behaviour, which is",
    "a filing rather than a fix.",
    "",
    "## Why",
    "",
    "Every delegated run reviews its own diff and stops there, so what two runs each wrote is inside",
    "no run's range and is found by nobody (ISS-95). The ship step counts the volume since the mark",
    `and files this reading itself once ${REVIEW_LINES} changed line(s) have landed, so nobody has to`,
    "notice.",
    "",
  ].join("\n");
};

const OFF = "is on no history reaching this tree's head";
const BACK = (from) => `is not a descendant of the mark at ${from.slice(0, 7)}`;
const BY_HAND = (to, from) =>
  `git update-ref ${REVIEWED} ${to.slice(0, 7)}${from ? ` ${from.slice(0, 7)}` : ""}`;

/** What a target has to be for the range it opens to be countable: on the history this tree's head
 *  reaches, and ahead of the mark. The second implies nothing about the first — a side branch rooted
 *  after the mark passes it and reaches no head, as does one fetched but never merged (ISS-159). */
export const markRefused = ({ tree, from, to, reaches, forward, self }) => {
  const at = to.slice(0, 7);
  const dead = `so the range it opens is not this repository's work and the count over it would `
    + `measure nothing.`;
  if (!from) {
    return `${at} ${OFF}, ${dead} Name a commit this head descends from — a tree that has not `
      + `fetched is the usual reason: git -C ${tree} fetch ${REMOTE}. Where the commit is right and `
      + `this tree is not the one to read it from, plant it by hand and say so: ${BY_HAND(to)}`;
  }
  const byHand = `move it by hand and say so: ${BY_HAND(to, from)}`;
  if (reaches) {
    return `${at} ${BACK(from)}, and a mark that moves backwards hands the next reading a range `
      + `already read. Name a commit ahead of it — or, where the mark itself is the mistake, ${byHand}`;
  }
  if (forward) {
    return `${at} ${OFF}, ${dead} It descends from the mark at ${from.slice(0, 7)}, which is the `
      + `other question and does not answer this one: a side branch rooted after the mark, and a `
      + `commit this tree holds but has not merged, both pass it. Read which of the two it is — `
      + `git -C ${tree} log --left-right --oneline HEAD...${at} — and where it marks nothing \`<\`, `
      + `this head holds nothing the target lacks and can be brought to it: `
      + `git -C ${tree} merge --ff-only ${at}. Where it marks one, the target is a branch, and what `
      + `to name is the head on this history the reading reached: ${self} review --done <that head>. `
      + `Where the commit is right and this tree is not the one to read it from, ${byHand}`;
  }
  return `${at} ${OFF}, and it ${BACK(from)} either, ${dead} Neither fix on its own reaches it: a `
    + `commit ahead of the mark this head does not reach is refused, and one this head reaches that `
    + `sits behind the mark is refused too. Name a commit that is both — ${self} review --done <that `
    + `head> — or, where the mark itself is the mistake, ${byHand}`;
};
