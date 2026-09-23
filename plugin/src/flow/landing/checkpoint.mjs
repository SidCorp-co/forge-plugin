/* The landing checkpoint, read as a table. Nothing here reads a lease or reaches the tracker, which
   is what lets the lease import it and not the other way about. docs/cli/the-turn.md. */
import { shortSha } from "../../tracker/evidence.mjs";
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
  "builder-owed": { turn: "builder", next: ["reconciled"] },
  /* Left by `--pushed --ready` alone, which writes the checkpoint whole rather than moving it. */
  "head-owed": { turn: "builder", next: ["ready"] },
  reconciled: { turn: "lander", next: ["qa-owed", "promoting", "head-owed"] },
  "qa-owed": { turn: "qa", next: ["judged"] },
  judged: { turn: "lander", next: ["promoting", "done", "qa-owed", "records-owed"] },
  promoting: { turn: "lander", next: ["promoted"] },
  promoted: { turn: "lander", next: ["installed"] },
  installed: { turn: "lander", next: ["marked"] },
  marked: { turn: "lander", next: ["qa-owed", "done", "records-owed"] },
  /* The two the status step runs at, the turn being handed back mid-step: returned to `marked` from
     `judged`, an after-merge landing would ask a judge that has answered to answer again. */
  "records-owed": { turn: "builder", next: ["marked", "judged"] },
  done: { turn: null, next: [] },
};

/* Declared: a key nothing here names is dropped rather than read back as a fact. Every one of them
   is a string; `handWritten` is the one record the checkpoint holds and is read below on its own. */
const CHECKPOINT = ["state", "builder", "branch", "head", "base", "at", "pinned", "intended",
  "candidate", "release", "install", "deployment", "moved", "reconciled", "judge", "owed"];

export const landingOf = (context) => {
  const held = context?.[LANDING];
  if (!held || typeof held !== "object" || typeof held.state !== "string" || !held.state) return null;
  const files = (Array.isArray(held.files) ? held.files : []).map((one) => String(one).trim());
  const out = { files: files.filter(Boolean) };
  for (const name of CHECKPOINT) if (held[name]) out[name] = String(held[name]);
  const hand = handWrittenOf(held);
  if (hand) out[HAND_WRITTEN] = hand;
  return out;
};

export const landingTurn = (landing) => LANDING_STATES[landing?.state]?.turn ?? null;

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
  deployment: "", judge: "", release: "",
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

export const landingLine = (landing) =>
  `landing \`${landing.state}\`: ${landing.branch ?? "no branch"} at ${shortSha(landing.head)}, `
  + `base ${shortSha(landing.base)}, ${landing.files.length} file(s), built by `
  + `${landing.builder || "nobody the record can name"}${rebuiltSaid(landing)}`;

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
