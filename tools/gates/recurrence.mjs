/* What a recurring suite-interaction finding does. Printed and lost was the state ISS-925 was filed
   over; ruled 2026-09-09 between four readings, three of which refuse. This one files and vetoes no
   landing, so nothing here may change a status the gate exits with. Why the identity is a marker and
   not the CLI's duplicate check, and what a third recurrence does: `node tools/gates.mjs -h`. */

import { createHash } from "node:crypto";
import { basename } from "node:path";

const ROUTE = "../../plugin/src/tracker/filing/route.mjs";
const COMMENTS = "../../plugin/src/tracker/comments.mjs";
const ISSUES = "../../plugin/src/tracker/issues.mjs";
const SETTINGS = "../../plugin/src/resolve/settings.mjs";
const FLAGS = "../../plugin/src/resolve/flags.mjs";

const KIND = "bug";
const LABEL = "gate-recurrence";
const NAMED = 12;
const SETTLED = new Set(["closed", "dropped"]);

/** The one thing two runs agree a finding is: a digest of the case's whole file and whole name, in a
 *  bracket of its own so containing it is being it. Digested because the shape check refuses a path
 *  or an extension in a title and a case name holds either; the body carries both whole, where a
 *  reader acts. A rename or a move is a new finding. */
export const markerFor = ({ file, name }) =>
  `[${LABEL} ${createHash("sha1").update(`${file}\t${name}`).digest("hex").slice(0, NAMED)}]`;

const shortOf = (file) => basename(String(file)).split(".")[0];

export const titleFor = (one) =>
  `A case in the ${shortOf(one.file)} suite passes in company as it does alone ${markerFor(one)}`;

export const byHand = ({ one }) =>
  `forge new - --title ${JSON.stringify(titleFor(one))} --category ${KIND}`;

const NO_TIME = "not recorded, the row predating the field";

const when = (row) => (row?.at ? row.at : NO_TIME);

const facts = ({ step, one, before, digest, at }) => [
  `- case: ${one.name}`,
  `- file: \`${one.file}\``,
  `- gate step: \`${step}\``,
  `- tree content, as the gate's ledger digests it: \`${digest ?? "unread"}\``,
  `- this attribution: ${at}`,
  `- the attribution before it: ${when(before)}`,
  `- reproduced alone: no, at either attribution`,
  `- what a later run finds this by: ${markerFor(one)}`,
].join("\n");

const past = (settled) => (settled
  ? `\n\nAn earlier issue for this same case, ${settled.issueId}, is \`${settled.status}\`, so this `
    + `finding is filed rather than left on it.`
  : "");

const HAPPENED = (finding) => `## What happened

The gate's test step \`${finding.step}\` failed with the case below among its failures, and re-running
that case alone at the same content passed. The previous attribution of the same step at the same
content had already named it, so this is the second time running that the case has failed in company
and passed alone with nothing about the tree having moved.

${facts(finding)}${past(finding.settled)}`;

const CAUSE = (finding) => `## Why it happens

Not known, and one re-run per case cannot read it. What is known is where to look: \`${finding.one.file}\`,
run inside the whole of \`${finding.step}\` rather than on its own. A case that fails only in company
is reading something the cases around it leave behind — a shared temporary directory, a module-level
value, an environment variable, a clock, a port — and the discriminator that produced this finding
says only that running the case alone does not fail.`;

const OUTCOME = (finding) => `## Outcome

The case passes inside the whole of \`${finding.step}\` as reliably as it passes alone.`;

const RULES = `## Rules

- The case is not quarantined, skipped, or retried into green: a suite that retries cannot answer
  this question again.
- What is found is fixed in the case or in what it shares with its neighbours, never in the gate.
- The gate did not refuse for this and is not made to: a recurrence files and vetoes no landing.`;

const SCOPE = `## Out of scope

The machine's load and the suite's speed. This finding is a claim about how the suite runs at one
unchanged tree content, and not about spare capacity.`;

const WHERE = (finding) => `## Where

\`${finding.one.file}\`, the case named above, inside the gate step \`${finding.step}\`.`;

/** Enough to work the defect without the log it was buried in. Every value is the case's own or the
 *  gate's, so no outside path reaches here; `write()` refuses a credential in any payload anyway. */
export const bodyFor = (finding) =>
  [HAPPENED(finding), CAUSE(finding), OUTCOME(finding), RULES, SCOPE, WHERE(finding)].join("\n\n");

export const commentFor = (finding) => `## The same case failed in the suite and passed alone again

${facts(finding)}

The gate did not refuse for it. This is the attribution after the one this issue was filed for, on
the same case, and it is a comment rather than a second issue.`;

const held = async () => {
  const [{ fileIssue }, { postComment }, { everyIssue }, { refusing }, { firstLine }] =
    await Promise.all([ROUTE, COMMENTS, ISSUES, SETTINGS, FLAGS]
      .map((one) => import(new URL(one, import.meta.url).href)));
  return { fileIssue, postComment, everyIssue, refusing, firstLine };
};

const unreached = (finding, why) => ({
  key: null,
  how: "unreached",
  why,
  lines: [`    the filing could not be made: ${why}`,
    `    file it by hand, the body being the block below: ${byHand(finding)}`,
    ...bodyFor(finding).split("\n").map((one) => `      ${one}`)],
});

const reached = (finding, key, how) => ({
  key,
  how,
  why: null,
  lines: [`    ${how} as ${key}: ${titleFor(finding.one)}`],
});

/* Narrowed on the marker the title and the body both carry, then matched in the title where it is
   exact. Paged to the end: a short page is a ceiling, not an absence. A live row beats a settled
   one — a case closed once and filed again has both, and the live one takes the attribution. */
const earlier = async (bound, one) => {
  const marker = markerFor(one);
  const read = await bound.everyIssue({ search: marker.slice(1, -1) });
  const found = read.rows.filter((row) => String(row.title ?? "").includes(marker));
  return {
    whole: Boolean(read.whole) && !read.refused,
    why: read.refused ?? null,
    row: found.find((row) => !SETTLED.has(row.status)) ?? found[0] ?? null,
  };
};

const UNREAD = "so whether this case already has an issue is unread and a second one is not filed";

const commented = async (bound, finding, row) => {
  const answer = await bound.postComment(row.documentId, commentFor(finding), null, true);
  return answer?.refused
    ? unreached(finding, `${row.issueId} would not take a comment: ${bound.firstLine(answer.refused)}`)
    : reached(finding, row.issueId, "commented");
};

/* The fold declined and the duplicate check off, both deliberately: the fold would land a machine's
   finding on whatever open issue reads nearest, and the duplicate check scores title similarity at
   0.34, which two different cases' titles clear against each other. Identity is `earlier`'s. */
const created = async (bound, finding, settled) => {
  const made = await bound.fileIssue({
    title: titleFor(finding.one),
    body: bodyFor({ ...finding, settled }),
    kind: KIND,
    duplicates: false,
    fresh: true,
    soft: true,
  });
  if (made.refusal) return unreached(finding, `the filing was refused: ${bound.firstLine(made.refusal.text)}`);
  if (made.answer?.refused) return unreached(finding, `the tracker refused the filing: ${bound.firstLine(made.answer.refused)}`);
  const key = made.answer?.issueId ?? null;
  return key ? reached(finding, key, "filed") : unreached(finding, "the filing answered with no issue key");
};

const through = async (bound, finding) => {
  const { whole, why, row } = await earlier(bound, finding.one);
  if (row && !SETTLED.has(row.status)) return commented(bound, finding, row);
  if (!whole) return unreached(finding, `the backlog did not come back whole, ${UNREAD}${why ? `: ${why}` : ""}`);
  return created(bound, finding, row);
};

/** One finding's filing, and the lines a caller prints. Nothing throws and nothing exits: the tracker
 *  is reached inside `refusing()`, where `fail()` becomes a value a caller prints. */
export const fileRecurrence = async (finding) => {
  let bound;
  try {
    bound = await held();
  } catch (error) {
    return unreached(finding, `the filing route could not be loaded: ${error.message}`);
  }
  try {
    return await bound.refusing(() => through(bound, finding));
  } catch (error) {
    return unreached(finding, String(error?.message ?? error));
  }
};

/** The recurrences among what one attribution judged: a case not reproduced alone that the previous
 *  attribution of the same step named at the same digest. A first non-reproduction is not one. */
export const recurrencesIn = (said, step) => said.judged
  .filter((each) => !each.reproduced && each.repeat)
  .map((each) => ({ step: step.label, digest: step.digest ?? null, at: said.at,
    one: each.one, before: each.repeat }));

/* One at a time and never together: the second finding's lookup has to see what the first filed. */
export const fileRecurrences = async (found) => {
  const named = [];
  const lines = [];
  for (const one of found) {
    const said = await fileRecurrence(one);
    named.push({ ...one, ...said });
    lines.push(...said.lines);
  }
  return { named, lines };
};

/** What the end-of-run block says beside a case: the issue it reached, or nothing at all for a case
 *  this run saw for the first time, which is no recurrence and filed nothing. */
export const reachedBy = (named, { step, one }) => {
  const found = named.find((each) =>
    each.step === step && each.one.file === one.file && each.one.name === one.name);
  if (!found) return "";
  return found.key ? `  → ${found.key}, ${found.how}` : `  → no issue: ${found.why}`;
};
