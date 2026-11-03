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

/* Core's own weighing, keyed so a brief reads the mark off it rather than the thread's superseded row (FB-19). */
const verdictsOf = (rows) => new Map(rows.filter((one) => one?.latest).map((one) => [Number(one.n), one.latest]));

/* The design class each criterion carries and whether it keeps a probe, off the same read: the class
   routes the clip and probe rules core refuses a verdict by, which the record write mirrors before it
   uploads and the owed list names ahead of the write (ISS-7). A row with no class reads `null`, which
   owes neither. */
const classesOf = (rows) => new Map(rows.map((one) =>
  [Number(one.n), { klass: one.class ?? null, kept: Boolean(one.probe) }]));

/** `{ judged, earned, review, verdicts }` — criteria core holds any latest verdict on, criteria its
 *  weighing counts earned, criteria the review owes, and core's latest verdict per criterion — or
 *  `{ refused }` naming why the read failed. `judged` trims the "no verdict" list (a fail is a verdict),
 *  `earned` is what the thread is no longer weighed for (a fail core counts unearned still is). */
export const coreJudged = async (documentId) => {
  const answer = await read(documentId);
  if (answer?.refused) return { judged: null, earned: null, review: null, verdicts: null, classes: null, refused: answer.refused };
  const rows = answer?.criteria;
  if (!Array.isArray(rows)) return { judged: null, earned: null, review: null, verdicts: null, classes: null, refused: "the criteria read answered no list of criteria" };
  return {
    judged: numbersOf(rows, (one) => one?.latest),
    earned: numbersOf(rows, (one) => one?.weighing?.earned),
    review: numbersOf(rows, (one) => !one?.latest && one?.judge === REVIEW),
    verdicts: verdictsOf(rows),
    classes: classesOf(rows),
    refused: null,
  };
};

/** The `classesOf` map alone, for the record write that reads it before any upload (ISS-7):
 *  `{ classes }` keyed by number, or `{ refused }` naming why the read failed — a write that cannot
 *  read it refuses nothing locally, which leaves the uploaded-names lead to report what core says. */
export const coreClasses = async (documentId) => {
  const answer = await read(documentId);
  if (answer?.refused) return { classes: null, refused: answer.refused };
  const rows = answer?.criteria;
  if (!Array.isArray(rows)) return { classes: null, refused: "the criteria read answered no list of criteria" };
  return { classes: classesOf(rows), refused: null };
};

/** The thread's verdicts core's weighing has not earned, by the `earned` set above: a row for a
 *  criterion core counts earned is superseded whatever it says, and not the CLI's to weigh again
 *  (FB-19). A no-op wherever core's read was not had — `view.coreVerdicts` is set only by
 *  `withCoreVerdicts`, which `advance --owed` and `resume` alone apply. */
export const weighable = (view) => {
  const earned = view.coreVerdicts?.earned;
  if (!earned?.size) return view.verdicts;
  return new Map([...view.verdicts].filter(([number]) => !earned.has(number)));
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

/** Per observable criterion still owed a verdict, what that verdict will owe beyond the verdict
 *  itself: a kept probe sent through the verdicts door — or none, where the criterion keeps one
 *  already — and a screen clip in `--evidence`, or `--without-clip` saying why none (ISS-7). Said at
 *  the owed list so the write carries them, rather than being refused for them by core after a clip is
 *  already up. A criterion no design classes, or one not observable, owes neither and says nothing. */
export const observableOwed = (view, ref) => {
  const classes = view.coreVerdicts?.classes;
  if (!classes) return [];
  return (view.owed ?? []).flatMap((number) => {
    const held = classes.get(number);
    if (held?.klass !== "observable") return [];
    const probe = held.kept
      ? "a probe is kept on it already, so a pass or short sends none"
      : "a pass or short rests on a kept probe, sent with the verdict through the verdicts door "
        + "(VERDICT_PROBE_REQUIRED)";
    return [need(
      `criterion ${number} is observable on the running build: ${probe}, and a pass, short or fail owes `
        + "a screen clip cited in --evidence (a WebM or MP4), or --without-clip saying why none "
        + "(VERDICT_CLIP_REQUIRED)",
      `forge record verdict ${ref} --criterion ${number} --verdict pass <identity>`
        + `${held.kept ? "" : " --probe '<request or command json>'"} --evidence <clip.webm>`,
    )];
  });
};

/** Said under the owed list where core's read could not be had, so a "no verdict" there is the thread's word alone. */
export const coreReadLines = (view) => (view.coreVerdicts?.refused
  ? [`  Core's criteria read was refused (${view.coreVerdicts.refused.split("\n")[0]}), so a verdict written `
    + "through its verdict route alone is not counted in this list."]
  : []);
