/* The landing checkpoint, read as a table. Nothing here reads a lease or reaches the tracker, which
   is what lets the lease import it and not the other way about. docs/cli/the-turn.md. */
import { isCommit, sameCommit, shortSha } from "../../tracker/evidence.mjs";
import { HAND_WRITTEN, handWrittenOf, rebuiltSaid } from "./reconstruction.mjs";

export const LANDING = "landing";
export const LANDING_READY = "ready";
export const LANDING_BUILDER_OWED = "builder-owed";
export const LANDING_RECONCILED = "reconciled";
/* Named for what is owed: the fault the landing met is the branch's own, so the builder answers it
   with a new head and a capture of it, which is a build and no reading of this candidate. */
export const LANDING_HEAD_OWED = "head-owed";
export const LANDING_QA_OWED = "qa-owed";
export const LANDING_JUDGED = "judged";
export const LANDING_MARKED = "marked";
/* Named for what is owed and not for who is: the builder holds two turns and a resume reads which. */
export const LANDING_RECORDS_OWED = "records-owed";
export const LANDING_DONE = "done";

export const LANDING_STATES = {
  /* `done` because a release is a landing that built no candidate for a second one to read. */
  ready: { turn: "lander", next: ["candidate", "done", "head-owed"] },
  candidate: { turn: "lander", next: ["reconciled", "builder-owed", "head-owed"] },
  /* `ready` where the reading finds the candidate wrong: that answer is a head, captured whole. */
  "builder-owed": { turn: "builder", next: ["reconciled", "ready"] },
  /* Left by `--pushed --ready`, which writes the checkpoint whole rather than moving it, or ended by
     `--landed` where the answering head reached the branch by another route. */
  "head-owed": { turn: "builder", next: ["ready", "done"] },
  reconciled: { turn: "lander", next: ["qa-owed", "promoting", "head-owed"] },
  "qa-owed": { turn: "qa", next: ["judged"] },
  judged: { turn: "lander", next: ["promoting", "done", "qa-owed", "records-owed"] },
  promoting: { turn: "lander", next: ["promoted"] },
  promoted: { turn: "lander", next: ["installed"] },
  installed: { turn: "lander", next: ["marked"] },
  marked: { turn: "lander", next: ["qa-owed", "done", "records-owed"] },
  /* The two the status step runs at, the turn being handed back mid-step: returned to `marked` from
     `judged`, an after-merge landing would ask a judge that has answered to answer again. `ready`
     is the capture's, and `reworkRefusal` says what licenses it (ISS-2406). */
  "records-owed": { turn: "builder", next: ["marked", "judged", "ready"] },
  done: { turn: null, next: [] },
};

/* Declared: a key nothing here names is dropped rather than read back as a fact. Every one of them
   is a string; `handWritten` is the one record the checkpoint holds and is read below on its own,
   and `superseded` the list of checkpoints it replaced. */
const CHECKPOINT = ["state", "builder", "branch", "head", "base", "at", "pinned", "intended",
  "candidate", "release", "install", "deployment", "deploymentId", "moved", "reconciled", "judge", "owed"];

export const SUPERSEDED = "superseded";

/* `deployment` is the identity the judging rung compares with the commits a verdict cites, so a value
   that is no commit could match none of them and left every verdict unearnable. A write refuses one
   now; one stored before that is read as what it is, a deployment's own id, which nothing compares
   (ISS-2918). */
const blockOf = (held) => {
  if (!held || typeof held !== "object" || typeof held.state !== "string" || !held.state) return null;
  const files = (Array.isArray(held.files) ? held.files : []).map((one) => String(one).trim());
  const out = { files: files.filter(Boolean) };
  for (const name of CHECKPOINT) if (held[name]) out[name] = String(held[name]);
  if (out.deployment && !isCommit(out.deployment)) {
    out.deploymentId ??= out.deployment;
    delete out.deployment;
  }
  const hand = handWrittenOf(held);
  if (hand) out[HAND_WRITTEN] = hand;
  return out;
};

/* Read here because every landing write spreads what this returns under its own patch: a key this
   drops is gone at the next move, which is how a second landing lost the first (ISS-2526). Oldest
   first; each one is read as a checkpoint of its own and carries no list of its own. */
export const landingOf = (context) => {
  const held = context?.[LANDING];
  const out = blockOf(held);
  if (!out) return null;
  const earlier = (Array.isArray(held[SUPERSEDED]) ? held[SUPERSEDED] : []).map(blockOf).filter(Boolean);
  if (earlier.length) out[SUPERSEDED] = earlier;
  return out;
};

/** The list a checkpoint replacing this one carries: every one it already carried, then this one. */
export const supersededBy = (landing) => {
  if (!landing) return [];
  const { [SUPERSEDED]: earlier = [], ...own } = landing;
  return [...earlier, own];
};

export const landingTurn = (landing) => LANDING_STATES[landing?.state]?.turn ?? null;

/** Whether the latest review on the record approved this head. With `unjudgedAt`, the one reading of
 *  which records a head carries: the capture out of `head-owed` refuses on it and the resume narrows
 *  the phase owed by it, so the two cannot disagree about one head (ISS-2439). */
export const approvedAt = (head, latest) => {
  const review = latest?.review?.record.fields;
  return Boolean(review?.commit && sameCommit(review.commit, head) && review.outcome === "approved");
};

/** The criteria whose latest verdict does not pass this head: none, one at another commit, or a fail. */
export const unjudgedAt = (head, { verdicts, criteria }) => criteria.map((one) => one.number)
  .filter((number) => {
    const held = verdicts.get(number)?.record.fields;
    return !held?.commit || !sameCommit(held.commit, head) || held.verdict === "fail";
  });

const READ_ON = ["state", "branch", "head"];

export const landingMoved = (was, held) => {
  if (!was) return null;
  if (!held) return "there is no checkpoint on it any more";
  const off = READ_ON.filter((name) => (was[name] ?? null) !== (held[name] ?? null));
  return off.length ? off.map((name) => `${name} reads \`${held[name] ?? "nothing"}\` and not \`${was[name] ?? "nothing"}\``).join(", ") : null;
};

/* The one move the table above cannot carry, being backwards, and never past the push. */
export const LANDING_CANDIDATE = "candidate";
const REBUILDS = new Set([LANDING_CANDIDATE, LANDING_RECONCILED, LANDING_QA_OWED, LANDING_JUDGED, "promoting"]);

/** Blank rather than absent: `landingOf` drops what is falsy, so this is how a field is cleared. */
export const landingVoided = (pinned) => ({
  state: LANDING_CANDIDATE, pinned, candidate: "", intended: "", moved: "", reconciled: "",
  deployment: "", deploymentId: "", judge: "", release: "",
});

export const landingNext = (held, to) => {
  if (!held) return `no landing checkpoint is on it, so there is no state for \`${to}\` to follow`;
  if (!LANDING_STATES[to]) return `\`${to}\` is no landing state this version knows`;
  const row = LANDING_STATES[held.state];
  if (!row) return `it reads \`${held.state}\`, which is no state this version knows`;
  if (to === LANDING_CANDIDATE && REBUILDS.has(held.state)) return null;
  if (!row.next.includes(to)) {
    return `it reads \`${held.state}\`, whose next is ${row.next.join(" or ") || "nothing at all"}`;
  }
  return null;
};

export const takeRoute = (ref) => `forge claim ${ref} --take`;

/* The identity a verdict is judged against, and a deployment's own id said to be one, so a reader
   told which commit to cite is never handed the id instead (ISS-2918). */
const deploymentSaid = (landing) => [
  landing.deployment ? `; deployment ${shortSha(landing.deployment)}` : "",
  landing.deploymentId ? `; deployment id \`${landing.deploymentId}\`, which is no commit a verdict can cite` : "",
].join("");

/* The landing this one replaced, whose verdicts are read against its own identity (ISS-2526). */
const supersededSaid = (landing) => {
  const earlier = landing[SUPERSEDED] ?? [];
  const last = earlier.at(-1);
  if (!last) return "";
  return `; supersedes ${earlier.length} earlier landing(s), the last at ${shortSha(last.head) || "no head"}`
    + `${last.deployment ? ` with deployment ${shortSha(last.deployment)}` : ""}`;
};

export const landingLine = (landing) =>
  `landing \`${landing.state}\`: ${landing.branch ?? "no branch"} at ${shortSha(landing.head)}, `
  + `base ${shortSha(landing.base)}, ${landing.files.length} file(s), built by `
  + `${landing.builder || "nobody the record can name"}${rebuiltSaid(landing)}`
  + `${deploymentSaid(landing)}${supersededSaid(landing)}`;

/** The builder's two writes out of `head-owed`, one per line under whatever sentence leads to them. */
export const RECAPTURE = (ref, indent = "  ") =>
  `${indent}forge claim ${ref} --take\n`
  + `${indent}... commit the answer, review that head (and judge it, where this run is the judge), push it, then:\n`
  + `${indent}forge claim ${ref} --pushed --ready`;

export const READ_THE_STATE = (ref) =>
  `Read where the landing is, and take it when the state names your turn:\n  forge resume ${ref}`;

/* Keyed by the state a hand-back writes, valued by the builder's state it was taken at. */
export const SPENT_AT = {
  [LANDING_RECONCILED]: LANDING_BUILDER_OWED,
  [LANDING_MARKED]: LANDING_RECORDS_OWED,
  [LANDING_JUDGED]: LANDING_RECORDS_OWED,
};
