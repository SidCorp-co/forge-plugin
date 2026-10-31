/* Core's review of an issue (`POST /api/issues/:id/review`, REQ-36 BC-8): the diff `base..head` read
   against each checklist line of the patterns the design chose and against each code-property
   criterion, which core routes to the review and refuses a verdict on (VERDICT_JUDGED_BY_REVIEW).
   Built off the route's schema (`@forge/contracts/issue-review:recordReviewRequestSchema`), and reached
   as `forge record review` given `--head`: without it the kind is the thread's code-review record, a
   different payload this verb has always written. docs/cli/record-review-route.md. */
import { fail } from "../../../resolve/settings.mjs";
import { write } from "../../../tracker/rest.mjs";
import { issueOf } from "../thread/posting.mjs";

export const REVIEW_ROUTE_FLAG = "--head";

export const REVIEW_ROUTE_ROW = "  review       --base <40-hex> --head <40-hex> [--criterion N --result pass|fail --reason R "
  + "--evidence E...]... [--line <pattern>:<n> --result pass|fail|not_applicable --note N]... [--run R] [--started-at T]";

/* The route's own bounds (`REVIEW_LIMITS`), each refused here rather than by its 400. */
const LIMITS = { note: 400, lines: 200, criteria: 200, evidence: 10, citation: 400 };
const WHOLE_SHA = /^[0-9a-f]{40}$/iu;
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/u;
const LINE_RESULTS = ["pass", "fail", "not_applicable"];
const CRITERION_RESULTS = ["pass", "fail"];
const SINGLE = { "--base": "base", "--head": "head", "--run": "run", "--started-at": "startedAt" };
const ENTRY = { "--result": "result", "--reason": "reason", "--note": "note", "--evidence": "evidence" };

const refused = (ref, why) => fail(`record review on ${ref}: ${why}\n${REVIEW_ROUTE_ROW.trim()}`);

const positive = (ref, flag, value) => {
  if (!/^[1-9]\d*$/u.test(value)) refused(ref, `${flag} takes a whole number from 1, not \`${value}\`.`);
  return Number(value);
};

const lineOf = (ref, value) => {
  const [pattern, at] = String(value).split(":");
  if (!SLUG.test(pattern ?? "") || at === undefined) {
    refused(ref, `--line takes <pattern>:<n>, a catalog slug and its checklist line's number, not \`${value}\`.`);
  }
  return { pattern, line: positive(ref, "--line", at) };
};

/* In the order typed: a --criterion or a --line opens an entry, and the flags after it are that
   entry's until the next one opens. */
const parsed = (ref, argv) => {
  const got = { checklist: [], criteria: [] };
  let open = null;
  for (let at = 0; at < argv.length; at += 2) {
    const [flag, value] = [argv[at], argv[at + 1]];
    if (value === undefined || value.startsWith("--")) refused(ref, `${flag} takes a value.`);
    if (SINGLE[flag]) {
      got[SINGLE[flag]] = value.trim();
    } else if (flag === "--criterion") {
      open = { criterion: positive(ref, flag, value), evidence: [] };
      got.criteria.push(open);
    } else if (flag === "--line") {
      open = lineOf(ref, value);
      got.checklist.push(open);
    } else if (ENTRY[flag]) {
      if (!open) refused(ref, `${flag} belongs to the --criterion or --line before it, and none opened.`);
      if (flag === "--evidence") (open.evidence ??= []).push(value.trim());
      else open[ENTRY[flag]] = value.trim();
    } else {
      refused(ref, `no review flag named ${flag}.`);
    }
  }
  return got;
};

const noteChecked = (ref, what, text, label) => {
  if (!text) refused(ref, `${what} owes ${label}: what in the diff or the evidence it was checked against.`);
  if ([...text].length > LIMITS.note) refused(ref, `${what}'s ${label} is ${[...text].length} code points and core takes ${LIMITS.note}.`);
};

const criterionChecked = (ref, one) => {
  const what = `criterion ${one.criterion}`;
  if (!CRITERION_RESULTS.includes(one.result)) refused(ref, `${what} takes --result ${CRITERION_RESULTS.join("|")}.`);
  if ("note" in one) refused(ref, `${what} takes --reason, and --note belongs to a --line.`);
  noteChecked(ref, what, one.reason, "--reason");
  if (!one.evidence.length) refused(ref, `${what} cites what it was judged from: --evidence, a path at --head, a URL or an attachment name.`);
  if (one.evidence.length > LIMITS.evidence) refused(ref, `${what} cites ${one.evidence.length} and core takes ${LIMITS.evidence}.`);
  const long = one.evidence.find((cited) => !cited || [...cited].length > LIMITS.citation);
  if (long !== undefined) refused(ref, `${what}'s --evidence \`${long.slice(0, 40)}\` is empty or over ${LIMITS.citation} code points.`);
  return { criterion: one.criterion, result: one.result, reason: one.reason, evidence: one.evidence };
};

const lineChecked = (ref, one) => {
  const what = `line ${one.pattern}:${one.line}`;
  if (!LINE_RESULTS.includes(one.result)) refused(ref, `${what} takes --result ${LINE_RESULTS.join("|")}.`);
  if ("reason" in one || "evidence" in one) refused(ref, `${what} takes --note; --reason and --evidence belong to a --criterion.`);
  noteChecked(ref, what, one.note, "--note");
  return { pattern: one.pattern, line: one.line, result: one.result, note: one.note };
};

/** The request body, every bound of the route's schema measured before anything is sent. */
const reviewBody = (ref, argv) => {
  const got = parsed(ref, argv);
  for (const end of ["base", "head"]) {
    if (!WHOLE_SHA.test(got[end] ?? "")) refused(ref, `--${end} takes the whole 40-hex commit, not \`${got[end] ?? ""}\`.`);
  }
  if (!got.criteria.length && !got.checklist.length) refused(ref, "a review records at least one --criterion or --line.");
  if (got.criteria.length > LIMITS.criteria || got.checklist.length > LIMITS.lines) {
    refused(ref, `core takes ${LIMITS.criteria} criteria and ${LIMITS.lines} checklist lines a review.`);
  }
  if (got.startedAt !== undefined && Number.isNaN(Date.parse(got.startedAt))) {
    refused(ref, `--started-at takes an ISO 8601 date-time with its offset, not \`${got.startedAt}\`.`);
  }
  return {
    base: got.base.toLowerCase(),
    head: got.head.toLowerCase(),
    checklist: got.checklist.map((one) => lineChecked(ref, one)),
    criteria: got.criteria.map((one) => criterionChecked(ref, one)),
    ...(got.run ? { run: got.run } : {}),
    ...(got.startedAt ? { startedAt: got.startedAt } : {}),
  };
};

/** `forge record review <ref> --base <sha> --head <sha> ...`: one review, through core's route. */
export const recordReviewRoute = async (ref, argv) => {
  const data = reviewBody(ref, argv);
  const { documentId } = await issueOf(ref);
  const answer = await write("forge_issues.review", { documentId, data }, undefined, true);
  if (answer?.refused) fail(`Core refused the review of ${ref}:\n${answer.refused}`);
  const review = answer?.review ?? {};
  console.log(`${ref}  review ${review.id ?? "recorded"} of ${data.base.slice(0, 12)}..${data.head.slice(0, 12)}: ${review.result ?? "recorded"}`);
  for (const one of review.failed ?? []) console.log(`  failed: ${one}`);
};
