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
const GROUP = `${LABEL}-group`;
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

/** The other thing two runs agree a finding is: the step it was in and the content it ran at, which
 *  is the pair an attribution already compares a case against. Every finding of one pass carries it,
 *  so a pass whose membership drifts as a cause is partly fixed still lands where the last one did,
 *  and never the set of cases — the grouping is the run and the digest, and two cases that merely
 *  read alike are not one finding while two attributed together are. */
export const passMarkerFor = ({ step, digest }) =>
  `[${GROUP} ${createHash("sha1").update(`${step}\t${digest ?? ""}`).digest("hex").slice(0, NAMED)}]`;

export const passTitleFor = (found) =>
  `Cases in the ${found[0].step} step pass in company as they do alone ${passMarkerFor(found[0])}`;

export const byHand = (title) =>
  `forge new - --title ${JSON.stringify(title)} --category ${KIND}`;

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

/* Which of the two keys turned the settled row up is not carried here, and a pass of one can reach a
   settled grouped row as a pass of several can: one wording true of every combination rather than a
   sentence that names a case over a row holding twenty-seven. */
const past = (settled) => (settled
  ? `\n\nAn earlier issue this finding reaches, ${settled.issueId}, is \`${settled.status}\`, so this `
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

const passFacts = (found) => [
  `- gate step: \`${found[0].step}\``,
  `- tree content, as the gate's ledger digests it: \`${found[0].digest ?? "unread"}\``,
  `- this attribution: ${found[0].at}`,
  `- cases attributed together in it: ${found.length}`,
  `- what a later pass of this step at this content finds this by: ${passMarkerFor(found[0])}`,
].join("\n");

/* The per-case marker under each case and not only in a list: it is what a reader searches for and
   what a later recurrence of that one case is found by, so the row that took its place lists it. */
const perCase = (finding) => [
  `- case: ${finding.one.name}`,
  `  - file: \`${finding.one.file}\``,
  `  - the attribution before it: ${when(finding.before)}`,
  `  - reproduced alone: no, at either attribution`,
  `  - what a later run finds this case by: ${markerFor(finding.one)}`,
].join("\n");

const PASS_HAPPENED = ({ found, settled }) => `## What happened

The gate's test step \`${found[0].step}\` failed with the ${found.length} cases below among its
failures, and re-running each of them alone at the same content passed. The previous attribution of
the same step at the same content had already named every one of them, so this is the second time
running that each has failed in company and passed alone with nothing about the tree having moved.

${passFacts(found)}

${found.map(perCase).join("\n\n")}${past(settled)}`;

const PASS_CAUSE = ({ found }) => `## Why it happens

Not known, and one re-run per case cannot read it. What is known is where to look: the cases above,
run inside the whole of \`${found[0].step}\` rather than on their own. A case that fails only in
company is reading something the cases around it leave behind — a shared temporary directory, a
module-level value, an environment variable, a clock, a port — and the discriminator that produced
these findings says only that running each of them alone does not fail. That they are one row is a
claim about one pass of one step at one content, and not a claim that one cause reaches them all.`;

const PASS_OUTCOME = ({ found }) => `## Outcome

Every case above passes inside the whole of \`${found[0].step}\` as reliably as it passes alone.`;

const PASS_RULES = `## Rules

- No case above is quarantined, skipped, or retried into green: a suite that retries cannot answer
  this question again.
- What is found is fixed in those cases or in what they share with their neighbours, never in the
  gate.
- The gate did not refuse for this and is not made to: a recurrence files and vetoes no landing.
- One attribution pass is one row. A later pass of this step at this content comments here however
  its membership has drifted, and a case above that recurs on its own reaches this row too unless it
  has a row of its own.`;

const passFiles = (found) => [...new Set(found.map((one) => one.one.file))];

const PASS_WHERE = ({ found }) => `## Where

${passFiles(found).map((one) => `\`${one}\``).join(", ")}, the cases named above, inside the gate
step \`${found[0].step}\`.`;

/** One pass's row: the step, the content, and every case it named, each carrying the marker a later
 *  recurrence of that one case is still found by. */
export const passBodyFor = (pass) =>
  [PASS_HAPPENED(pass), PASS_CAUSE(pass), PASS_OUTCOME(pass), PASS_RULES, SCOPE, PASS_WHERE(pass)]
    .join("\n\n");

export const passCommentFor = (found) => `## The same step's cases failed in the suite and passed alone again

${passFacts(found)}

${found.map(perCase).join("\n\n")}

The gate did not refuse for them. This is an attribution after the one this issue was filed for, on
the same step at the same content, and it is a comment rather than a second issue.`;

const held = async () => {
  const [{ fileIssue }, { postComment }, { everyIssue }, { refusing }, { firstLine }] =
    await Promise.all([ROUTE, COMMENTS, ISSUES, SETTINGS, FLAGS]
      .map((one) => import(new URL(one, import.meta.url).href)));
  return { fileIssue, postComment, everyIssue, refusing, firstLine };
};

const unreached = (subject, why) => ({
  key: null,
  how: "unreached",
  why,
  lines: [`    the filing could not be made: ${why}`,
    `    file it by hand, the body being the block below: ${byHand(subject.title)}`,
    ...subject.body.split("\n").map((one) => `      ${one}`)],
});

const reached = (subject, key, how) => ({
  key,
  how,
  why: null,
  lines: [`    ${how} as ${key}: ${subject.title}`],
});

/** What one finding would file, comment and be found under, as a function of the settled row a
 *  lookup turned up — so the two routes differ in their three texts and their keys and in nothing
 *  else that follows. */
const caseSubject = (finding) => (settled) => ({
  title: titleFor(finding.one),
  body: bodyFor({ ...finding, settled }),
  comment: commentFor(finding),
});

const passSubject = (found) => (settled) => ({
  title: passTitleFor(found),
  body: passBodyFor({ found, settled }),
  comment: passCommentFor(found),
});

/* Narrowed on the marker the title and the body both carry, then matched in the title where it is
   exact. Paged to the end: a short page is a ceiling, not an absence. A live row beats a settled
   one — a case closed once and filed again has both, and the live one takes the attribution. */
const earlier = async (bound, marker) => {
  const read = await bound.everyIssue({ search: marker.slice(1, -1) });
  const found = read.rows.filter((row) => String(row.title ?? "").includes(marker));
  return {
    whole: Boolean(read.whole) && !read.refused,
    why: read.refused ?? null,
    row: found.find((row) => !SETTLED.has(row.status)) ?? found[0] ?? null,
  };
};

/** The rows a subject may already have, in the order it prefers them. A case's own row first, which
 *  no content moves, and the row for its step at its content behind it: a case with a home of its
 *  own belongs there, and a case with none belongs with the pass it was attributed in rather than
 *  beside it. Settled rows are kept and never taken — the first of them names the close in the body
 *  a filing then writes. */
const homeOf = async (bound, markers) => {
  let whole = true;
  let why = null;
  let settled = null;
  for (const marker of markers) {
    const read = await earlier(bound, marker);
    whole = whole && read.whole;
    why = why ?? read.why;
    if (read.row && !SETTLED.has(read.row.status)) return { row: read.row, live: true, whole, why };
    settled = settled ?? read.row;
  }
  return { row: settled, live: false, whole, why };
};

const UNREAD = "so whether this already has an issue is unread and a second one is not filed";

const commented = async (bound, subject, row) => {
  const answer = await bound.postComment(row.documentId, subject.comment, null, true);
  return answer?.refused
    ? unreached(subject, `${row.issueId} would not take a comment: ${bound.firstLine(answer.refused)}`)
    : reached(subject, row.issueId, "commented");
};

/* The fold declined and the duplicate check off, both deliberately: the fold would land a machine's
   finding on whatever open issue reads nearest, and the duplicate check scores title similarity at
   0.34, which two different cases' titles clear against each other. Identity is `earlier`'s. */
const created = async (bound, subject) => {
  const made = await bound.fileIssue({
    title: subject.title,
    body: subject.body,
    kind: KIND,
    duplicates: false,
    fresh: true,
    soft: true,
  });
  if (made.refusal) return unreached(subject, `the filing was refused: ${bound.firstLine(made.refusal.text)}`);
  if (made.answer?.refused) return unreached(subject, `the tracker refused the filing: ${bound.firstLine(made.answer.refused)}`);
  const key = made.answer?.issueId ?? null;
  return key ? reached(subject, key, "filed") : unreached(subject, "the filing answered with no issue key");
};

const through = async (bound, markers, of) => {
  const found = await homeOf(bound, markers);
  if (found.live) return commented(bound, of(null), found.row);
  const subject = of(found.row);
  if (!found.whole) {
    return unreached(subject, `the backlog did not come back whole, ${UNREAD}${found.why ? `: ${found.why}` : ""}`);
  }
  return created(bound, subject);
};

/** One subject's filing, and the lines a caller prints. Nothing throws and nothing exits: the tracker
 *  is reached inside `refusing()`, where `fail()` becomes a value a caller prints. */
const filing = async (markers, of) => {
  let bound;
  try {
    bound = await held();
  } catch (error) {
    return unreached(of(null), `the filing route could not be loaded: ${error.message}`);
  }
  try {
    return await bound.refusing(() => through(bound, markers, of));
  } catch (error) {
    return unreached(of(null), String(error?.message ?? error));
  }
};

export const fileRecurrence = async (finding) =>
  filing([markerFor(finding.one), passMarkerFor(finding)], caseSubject(finding));

/** The recurrences among what one attribution judged: a case not reproduced alone that the previous
 *  attribution of the same step named at the same digest. A first non-reproduction is not one. */
export const recurrencesIn = (said, step) => said.judged
  .filter((each) => !each.reproduced && each.repeat)
  .map((each) => ({ step: step.label, digest: step.digest ?? null, at: said.at,
    one: each.one, before: each.repeat }));

/** What one attribution's recurrences reach, and the lines a caller prints beside them. Two or more
 *  of them are not two subjects but one — the grouping is the run and the digest, which is the pass
 *  marker — so they cost one lookup and one row between them, and each is named as having reached
 *  that row, which is what the verdict block reads (ISS-2251). One row per case was twenty-seven
 *  rows for one cause, filed by the very run that could see they arrived together. */
export const fileRecurrences = async (found) => {
  if (found.length === 0) return { named: [], lines: [] };
  const said = found.length > 1
    ? await filing([passMarkerFor(found[0])], passSubject(found))
    : await fileRecurrence(found[0]);
  return { named: found.map((one) => ({ ...one, ...said })), lines: said.lines };
};

/** What the end-of-run block says beside a case: the issue it reached, or nothing at all for a case
 *  this run saw for the first time, which is no recurrence and filed nothing. */
export const reachedBy = (named, { step, one }) => {
  const found = named.find((each) =>
    each.step === step && each.one.file === one.file && each.one.name === one.name);
  if (!found) return "";
  return found.key ? `  → ${found.key}, ${found.how}` : `  → no issue: ${found.why}`;
};
