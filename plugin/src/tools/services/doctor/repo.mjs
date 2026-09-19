/* What `forge doctor repo` reports: what this checkout's CLAUDE.md claims. docs/cli/doctor.md. */
import { checkoutRoot } from "../../../resolve/settings.mjs";
import {
  MAX_CLAUDE_MD_LINES,
  checkClaims,
  checkStructure,
  checkerOwned,
  checkerRestated,
  readClaudeMd,
} from "../../../checks/claude-md.mjs";
import { BAD, NOTE, OK, block, line } from "./showing.mjs";

/* The guide is the authority, so it is named first and the CLAUDE.md line second. Nothing here
   claims which of the two a pair is — the measurement is blind to negation, so a contradiction and
   a restatement score alike, and saying which would be a resolution it does not have. */
export const reportClaudeMd = (review, path) => {
  for (const marker of review.overrides) {
    const where = `CLAUDE.md:${marker.line}`;
    if (marker.known) line(OK, "claude.md override", `${marker.slug} — ${marker.reason} (${where})`);
    else line(BAD, "claude.md override", `${where} names no guide called ${marker.slug}`);
  }
  for (const { slug, evidence } of review.misScoped) {
    line(NOTE, "guide scope", `${slug} is global and names ${evidence.join(", ")} — one project's tools`);
  }
  if (!review.overlaps.length) {
    line(OK, "claude.md", `${path} restates no guide`);
    return;
  }
  line(NOTE, "claude.md", `${review.overlaps.length} statement(s) a guide already owns — ${path}`);
  for (const hit of review.overlaps) {
    block(`      ${hit.score.toFixed(2)}  guide ${hit.slug}\n            ${hit.theirs}`);
    block(`            CLAUDE.md:${hit.line}\n            ${hit.ours}`);
  }
  block(
    "\nThe guide is the authority and the project file is the copy. Where the two agree, delete the\n" +
      "CLAUDE.md line and let the guide carry it; where the project means to differ, say so on that\n" +
      "line — `overrides: <guide-slug> — <why this project differs>` — and doctor stops asking.\n" +
      "This is a measure of shared wording, not of meaning: a restatement and a contradiction score\n" +
      "alike, and only reading the pair tells you which you have.",
  );
};

/* A claim about the repo is the kind that rots without anyone noticing, and the kind a command can
   settle. Measured over 28 real CLAUDE.md files; the shapes that produced only false positives —
   a CIDR block, a date mask, a bare extension, a git ref — are excluded before this runs. */
const CLAIMS = [
  ["missingPaths", "claude.md path", "names no such path, and no file of that name anywhere"],
  ["missingScripts", "claude.md script", "is in no package.json this project holds"],
  ["missingHelp", "claude.md -h", "is told to answer `-h`, and handles no such flag"],
  ["missingTools", "claude.md tool", "is told to answer `-h`, and is not on PATH"],
  ["missingRefs", "claude.md ref", "is a git ref that does not resolve here"],
  ["presentForbidden", "claude.md absence", "is said not to exist, and it does"],
  ["strandedShas", "claude.md sha", "is cited and is no ancestor of HEAD"],
  ["uncitedIdentifiers", "claude.md id", "is cited and is defined nowhere else in the repo"],
  ["uncitedGoals", "claude.md goal", "is named and this project's requirements tree holds no clause for it"],
];

/* Imprecise rather than dangling — the file exists, under another path. Volume is the reason this is
   a count: port-plan.md for the read tree's `<project>/docs/port-plan.md` is one line, not twenty-nine. */
const reportStale = (stale) => {
  if (!stale.length) return;
  const shown = stale.slice(0, 3).join(", ");
  const rest = stale.length > 3 ? `, +${stale.length - 3} more` : "";
  line(NOTE, "claude.md stale path", `${shown}${rest} — exists, under another path`);
};

/* The published rules, not taste: code.claude.com/docs/en/memory gives the line target and the
   emphasis rule, docs/en/best-practices the include/exclude table. */
const reportStructure = (root, text) => {
  const found = checkStructure(text, root);
  if (found.overLineTarget) {
    line(BAD, "claude.md size", `${found.lines} lines — target is under ${MAX_CLAUDE_MD_LINES}`);
  }
  for (const rel of found.brokenImports) {
    line(BAD, "claude.md import", `@${rel} resolves to no file, and an import loads at launch`);
  }
  if (found.emphasisDiluted) {
    line(NOTE, "claude.md emphasis", `${found.emphasised} of ${found.bullets} bullets are bold — emphasise many and none stands out`);
  }
  if (found.vague.length) {
    line(NOTE, "claude.md vague", `${found.vague.join(", ")} — write what is concrete enough to verify`);
  }
  if (found.absentTopics.length) {
    line(NOTE, "claude.md covers", `nothing on ${found.absentTopics.join(", ")} — a gap to look at, not a fault`);
  }
};

const reportClaims = (root, text) => {
  const found = checkClaims(text, root);
  let named = 0;
  for (const [key, label, why] of CLAIMS) {
    for (const name of found[key]) {
      named += 1;
      line(BAD, label, `\`${name}\` ${why}`);
    }
  }
  reportStale(found.stalePaths);
  for (const { rule, line: at } of checkerOwned(text, root)) {
    line(NOTE, "claude.md restates", `\`${rule}\` has a checker (CLAUDE.md:${at})`);
  }
  if (named) block(CLAIM_REMEDY);
  else line(OK, "claude.md claims", "every path, script, `-h`, ref and id it names is real");
};

/* Printed once for the group: the move is the same whichever claim broke, and a report that names a
   defect without it leaves the reader to guess which of the two sides is wrong. */
const CLAIM_REMEDY = "\nA claim like these is read as fact by every session this file opens. Correct the claim, or\n"
  + "delete it — the file it names is the authority, and a claim it has outlived is worse than silence.";

/* Printed once, not per rule: the remedy is the same for all of them. */
const RESTATES = "\nA rule with a checker is documented by the checker's own message, which is what a\n" +
  "developer reads at the moment it fails. Delete the prose, or keep one line stating the invariant\n" +
  "behind it and no more — an explanation in two places diverges at the first correction.";

/* The comment is named first for the same reason the guide is: it is the authority, being what a
   developer reads at the moment the checker fires. */
const reportRestated = (hits) => {
  if (!hits.length) return;
  line(NOTE, "claude.md comment", `${hits.length} statement(s) a comment already owns`);
  for (const hit of hits) {
    block(`      ${hit.score.toFixed(2)}  ${hit.where}\n            ${hit.theirs}`);
    block(`            CLAUDE.md:${hit.line}\n            ${hit.ours}`);
  }
  block(
    "\nDelete the CLAUDE.md line and let the comment carry it. Where both copies have to exist, put\n" +
      "`restated: deliberate — <why>` above the comment and this stops asking.",
  );
};

export const checkClaudeMdLocally = () => {
  const root = checkoutRoot();
  const found = readClaudeMd(root);
  if (!found) return;
  reportStructure(root, found.text);
  reportClaims(root, found.text);
  if (checkerOwned(found.text, root).length) block(RESTATES);
  reportRestated(checkerRestated(found.text, root));
};
