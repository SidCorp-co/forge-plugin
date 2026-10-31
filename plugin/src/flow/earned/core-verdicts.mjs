/* Which criteria core holds a verdict on, off its criteria read (`GET /api/issues/:id/criteria`), the
   read whose weighing core's own gate decides by. The thread alone missed a verdict written through
   core's verdict route, which posts no comment: core counted it and `advance --owed` said "no
   verdict" (adminhub-api on 3.36.649). docs/cli/advance-the-ladder.md. */
import { Refusal, refusing } from "../../resolve/settings.mjs";
import { tried } from "../../tracker/rest.mjs";
import { need } from "../machine/owed.mjs";

/* A read that cannot be had — no endpoint, no credential — is answered as refused, in its own words,
   rather than ending a call that only reads it for the owed list. */
const read = async (documentId) => {
  try {
    return await refusing(() => tried("forge_issues.criteria", { documentId }));
  } catch (error) {
    if (error instanceof Refusal) return { refused: error.message };
    throw error;
  }
};

/* Core routes each criterion to its judge (`judge`, REQ-36 BC-13): a code property to the review,
   against the diff, which core refuses a verdict on (VERDICT_JUDGED_BY_REVIEW). */
const REVIEW = "review";

const numbersOf = (rows, keep) => new Set(rows.filter(keep).map((one) => Number(one.n)));

/** `{ judged, review }`, sets of criterion numbers, or `{ refused }` naming why the read failed. */
export const coreJudged = async (documentId) => {
  const answer = await read(documentId);
  if (answer?.refused) return { judged: null, review: null, refused: answer.refused };
  const rows = answer?.criteria;
  if (!Array.isArray(rows)) return { judged: null, review: null, refused: "the criteria read answered no list of criteria" };
  return {
    judged: numbersOf(rows, (one) => one?.latest),
    review: numbersOf(rows, (one) => !one?.latest && one?.judge === REVIEW),
    refused: null,
  };
};

/** The view with core's verdicts counted, a criterion either source judged owing none, and the
 *  criteria core routes to the review set apart: no verdict discharges those. */
export const withCoreVerdicts = (view, read) => {
  const judged = read.judged ?? new Set();
  const review = read.review ?? new Set();
  const open = view.owed.filter((number) => !judged.has(number));
  return {
    ...view,
    owed: open.filter((number) => !review.has(number)),
    reviewOwed: open.filter((number) => review.has(number)),
    coreVerdicts: read,
  };
};

/** What a criterion core routes to the review owes, and whose it is: the review's, never a verdict. */
export const reviewOwedItems = (view, ref) => {
  const numbers = view.reviewOwed ?? [];
  if (!numbers.length) return [];
  const many = numbers.length > 1;
  return [need(`${many ? "criteria" : "criterion"} ${numbers.join(", ")} ${many ? "are code properties" : "is a code property"} `
    + `core routes to the review, judged against the diff: the review owes ${many ? "them" : "it"}, and core refuses `
    + `a verdict on ${many ? "them" : "it"} (VERDICT_JUDGED_BY_REVIEW)`,
  `a run declared --role reviewer records ${many ? "them" : "it"} in its review: forge record review ${ref} `
    + `--base <sha> --head <sha> ${numbers.map((number) => `--criterion ${number} --result pass|fail --reason "<what held>" `
      + "--evidence <path at head>").join(" ")}`)];
};

/** Said under the owed list where core's read could not be had, so a "no verdict" there is the thread's word alone. */
export const coreReadLines = (view) => (view.coreVerdicts?.refused
  ? [`  Core's criteria read was refused (${view.coreVerdicts.refused.split("\n")[0]}), so a verdict written `
    + "through its verdict route alone is not counted in this list."]
  : []);
