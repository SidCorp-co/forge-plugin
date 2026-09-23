/* A park before it writes anything. Apart from `../advance.mjs`, which spends it, so the rehearsal that
   prints it and the move that writes it read the one composition (ISS-12). */
import { lengthOf } from "../../tracker/field-write.mjs";
import { attachmentNames, evidenceProblem } from "../../tracker/evidence.mjs";
import { SHOWS_EVIDENCE, commandAt } from "../machine.mjs";
import { Refused, refuse } from "../../refusal.mjs";
import { render } from "../record/page.mjs";
import { ANSWERED_BY_COMMENT, PARK_STATUS, answersByComment, atLeast, payloadOwed, setForm } from "../earned.mjs";
import { undoForm } from "../record/merged.mjs";

/* A needs_info park owes the readings only the question shape carries. */
export const ASKS_A_QUESTION = "question";
const ASKED_AT = ["open", "confirmed"];

/* Every park kind landing in `waiting` asks a person to decide, so the kind the tracker demands is
   derived; one that waited on a thing would need a row of its own. */
const WAITING = "waiting";
export const waitsFor = (status) => (status === WAITING ? { waitingKind: "needs_decision" } : {});

/* The one field of this payload the tracker mints an answer box from, where `reason` is why the work stopped: neither is ever written from the other, and a text over the endpoint's cap is refused here rather than sent to take the status write down with it — docs/cli/advance-what-it-sends.md. */
const NEEDS_CAP = 2000;
const ASKS = "Which of these readings is the one to take?";

export const needsProblem = (text) => {
  if (!text) return "is blank after trim, and a question with no text is an answer box asking nothing";
  const held = lengthOf(text);
  return held > NEEDS_CAP
    ? `is ${held} code points and the transition body takes ${NEEDS_CAP}, which refuses the whole call `
      + "and the status write with it"
    : null;
};

/* The readings are what `--park question` is already refused without, so the question that travels is built from them rather than asked for twice; the stem is a constant and never the park's own reason. */
const asksFor = (view, asked, ref) => {
  if (asked) return { needs: asked };
  const held = view.latest?.question?.record.fields.reading ?? [];
  if (!held.length) return {};
  const text = [ASKS, ...held.map((one) => `- ${one}`)].join("\n");
  const bad = needsProblem(text);
  if (bad) {
    refuse(`the readings on this issue's question record come to a text that ${bad}. Nothing was sent. `
      + `Say what would settle it in fewer words than the readings take:\n`
      + `  forge advance ${ref} --park ${ASKS_A_QUESTION} --why "<why>" --needs "<what would settle it>"`);
  }
  return { needs: text };
};

/** The status a park enters, the fields its move sends beside it and the record it posts, composed
 *  before either write: at the status where the record goes first, a refusal after it would leave a
 *  comment claiming a move nothing attempted. */
export const parkPayload = (view, ref, kind, why, evidence = [], { left = null, asked = null } = {}) => {
  const status = PARK_STATUS[kind];
  const said = { reason: why, ...waitsFor(status), ...(status === ANSWERED_BY_COMMENT ? asksFor(view, asked, ref) : {}) };
  return { status, said, body: render("park", { kind, why, evidence }, left ?? view.issue.status) };
};

/** Every refusal a typed park or drop answers to, raised before its first write. */
export const parkChecked = (view, ref, kind, evidence) => {
  const to = PARK_STATUS[kind];
  if (!to) refuse(`--park takes one of ${Object.keys(PARK_STATUS).join(", ")}, not \`${kind}\`.`);
  if (to === ANSWERED_BY_COMMENT && !ASKED_AT.includes(view.issue.status)) {
    refuse(`a question goes to the reporter, and ${ref} is ${view.issue.status}: the readings it would `
      + `offer are the triage ones. Ask from ${ASKED_AT.join(" or ")}, or park for a reviewer instead.`);
  }
  if (to === "dropped" && atLeast(view.issue.status, "developed")) {
    refuse(`${ref} is ${view.issue.status}, and dropped means no code landed. Revert first, then drop `
      + `from approved:\n  ${setForm(ref, "approved")}`);
  }
  if (to === "dropped" && view.issue.mergedAt) {
    refuse(`${ref} was marked merged at ${view.issue.mergedAt}, and dropped means no code landed. `
      + `Revert the commit, clear the mark, then drop from approved:\n  ${undoForm(ref)}`);
  }
  if (kind === ASKS_A_QUESTION) {
    const owed = payloadOwed(
      view,
      "question",
      "a needs_info park is a question: two or more readings, each with the outcome it produces",
      `forge record question ${ref} --reading "<reading -> outcome>" --reading "<reading -> outcome>"`,
    );
    if (owed.length) refuse(`${owed[0].what}. Write it first:\n  ${commandAt(owed[0].command, "  ")}`);
  }
  if (SHOWS_EVIDENCE.includes(kind) && !evidence.length) {
    refuse(`a ${kind} park names what the reviewer is to look at:\n`
      + `  forge advance ${ref} --park ${kind} --why "<why>" --evidence <attachment|url|sha>`);
  }
  const bad = evidence.length ? evidenceProblem(evidence, attachmentNames(view.issue, view.comments)) : null;
  if (bad) refuse(bad);
};

const indented = (value) => String(value).split("\n").join("\n    ");

/** `--owed` beside a park or a drop: the same checks and the same composition the move makes, printed
 *  and not sent. A refusal is the answer rather than a failure, as a shortfall is to `--owed`; the
 *  record comes last and whole, so what follows its heading is the text the move would post. */
export const rehearsePark = (view, ref, kind, why, evidence, asked) => {
  const move = kind === "dropped" ? "drop" : `${kind} park`;
  let composed;
  try {
    parkChecked(view, ref, kind, evidence);
    composed = parkPayload(view, ref, kind, why, evidence, { asked });
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    console.log(`Rehearsed, and nothing was written: the ${move} of ${ref} would be refused.\n${error.message}`);
    return;
  }
  const { status, said, body } = composed;
  console.log(`Rehearsed, and nothing was written: the ${move} of ${ref}.`);
  console.log(`  ${ref}  ${view.issue.status} -> ${status}`);
  console.log("Sent with the move:");
  for (const [field, value] of Object.entries(said)) console.log(`  ${field}: ${indented(value)}`);
  const when = answersByComment(status) ? "before the move, a comment there being read as the answer" : "after the move";
  console.log(`The park record, posted ${when}:\n\n${body}`);
};
