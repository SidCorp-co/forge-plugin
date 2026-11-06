// Off a strict project, deny a question that names no owner subject, so the session decides and
// records it; under `asks.mode=decide`, answer a question declared reversible from the owner's own
// precedent. Every other question goes to the owner. how/ask-decide.md.

import { answer, askedAlready, context, deny, how, remaining } from "../../_hook.mjs";
import { howPage } from "../../../src/refusal.mjs";
import { asksOwnerTerms, asksScope } from "../../../src/resolve/settings.mjs";
import { gateway } from "../../../src/resolve/machine/stores.mjs";
import { DECLARE_FORM, ownerCategories, ownersAlways, ownersBefore, reversalOf } from "../../../src/asks/declared.mjs";
import { STRICT, aimAt, profileOf } from "../../../src/brief/waived.mjs";
import { DECIDED, OWNER, asksRoom, decidedIds, decidedPath, logOutcome } from "../../../src/asks/decided.mjs";
import { OWNER_KIND, layerPaths, refreshLayer, shortlister } from "../../../src/asks/layer.mjs";

const ASKS = "AskUserQuestion";
/* What the build and the goals may take of the clock, so the judge keeps the larger part of it. */
const BUILD_SHARE = 0.4;
const GOALS_MS = 6_000;
const MARGIN_MS = 3_000;

const TEACH = "The ask-decide gate: this project decides a question from the owner's own precedent when the question "
  + `ends with ${DECLARE_FORM} and names nothing that is always the owner's. This one declared nothing, so it went `
  + `to the owner. How: ${howPage("ask-decide")}`;

/* The project's goals, bounded: a tracker that does not answer costs the judge its goals, not the
   question. The read is aborted at the bound, since one left running holds the process open after the
   hook has answered. */
const goalsWithin = async (ms) => {
  const { briefGoals } = await import("../../../src/tracker/knowledge/brief.mjs");
  try {
    return await briefGoals({ once: true, signal: AbortSignal.timeout(ms) });
  } catch (error) {
    return { goals: [], why: error.message };
  }
};

const toOwner = (ev, questions, reason, room) => {
  logOutcome({ session: ev.session_id ?? "", toolUseId: ev.tool_use_id ?? null, outcome: OWNER, reason,
    questions: questions.map((one) => one.question) }, room);
};

const precedentSaid = (one) => (one.kind === OWNER_KIND
  ? `the owner's answer of ${String(one.at ?? "").slice(0, 10)} to "${one.question}" (${one.answer})`
  : `the decision recorded on ${one.issue ?? "an issue"} on ${String(one.at ?? "").slice(0, 10)}`);

const noteFor = (decision, question, log) =>
  `Decided without the owner by the ask-decide gate, following ${precedentSaid(decision.precedent)}: `
  + `${decision.reason} Undo: ${reversalOf(question)}. Logged in ${log}.`;

/* The owner's precedent as it stands now, or the doubt that stops the gate using it. The decision log is
   read again once the build is done: another session's gate may have answered a call, and the host
   written it down, while this build was reading, and that answer must not stand as the owner's. */
const precedentRows = (room) => {
  const decided = decidedIds(room);
  if (decided.unreadable) return { doubt: decided.unreadable };
  const built = refreshLayer(layerPaths(room), { skip: decided.ids, until: Date.now() + remaining() * BUILD_SHARE });
  if (built.unreadable) return { doubt: built.unreadable };
  if (!built.complete) return { doubt: "the precedent layer is not yet read to the end of its transcripts" };
  const after = decidedIds(room);
  if (after.unreadable) return { doubt: after.unreadable };
  return { held: built.rows.filter((one) => !after.ids.has(one.id.split("#")[0])) };
};

const decide = async (ev, questions, room) => {
  const categories = ownerCategories(asksOwnerTerms());
  const before = questions.map((one) => ownersBefore(one, categories));
  const held = before.findIndex(Boolean);
  if (held >= 0) {
    toOwner(ev, questions, `"${questions[held].question}": ${before[held]}`, room);
    if (!reversalOf(questions[held]) && !askedAlready(ev, "ask-decide", "ask-declare")) context(TEACH);
    return;
  }
  const rows = precedentRows(room);
  if (rows.doubt) return toOwner(ev, questions, rows.doubt, room);
  const shortlist = shortlister(rows.held);
  const shortlists = questions.map((one) => shortlist(one));
  const bare = shortlists.findIndex((list) => !list.some((one) => one.kind === OWNER_KIND));
  if (bare >= 0) return toOwner(ev, questions, `"${questions[bare].question}" has no close owner precedent`, room);
  const { problem, values } = gateway();
  if (problem) return toOwner(ev, questions, `no judge to ask: ${problem}`, room);
  /* Loaded only here, so a question the owner answers before any judge is asked loads none of it. */
  const { judge, judgeModel } = await import("../../../src/asks/judge.mjs");
  const model = judgeModel(values);
  if (!model) return toOwner(ev, questions, "no model is named for the judge", room);
  const goals = await goalsWithin(Math.min(GOALS_MS, remaining() / 4));
  const verdict = await judge({ values, model, questions, shortlists, goals,
    signal: AbortSignal.timeout(Math.max(1, remaining() - MARGIN_MS)) });
  if (verdict.owner) return toOwner(ev, questions, verdict.owner, room);
  const log = decidedPath(room);
  const logged = logOutcome({ session: ev.session_id ?? "", toolUseId: ev.tool_use_id ?? null, outcome: DECIDED, model,
    questions: verdict.decisions.map((one, at) => ({ question: one.question, option: one.option, reason: one.reason,
      reversal: reversalOf(questions[at]),
      precedent: { id: one.precedent.id, at: one.precedent.at, question: one.precedent.question ?? one.precedent.readings?.[0] ?? null,
        answer: one.precedent.answer ?? null } })) }, room);
  /* A decision the owner could not review later is not one this gate takes. */
  if (!logged) return undefined;
  const answers = Object.fromEntries(verdict.decisions.map((one) => [one.question, one.option]));
  const annotations = Object.fromEntries(verdict.decisions.map((one, at) => [one.question, { notes: noteFor(one, questions[at], log) }]));
  return answer({ ...ev.tool_input, answers, annotations }, "The ask-decide gate answered this from the owner's precedent");
};

const routine = (slug, profile, categories) => deny(
  `Decide it and carry on — ${slug} is gated \`${profile}\`, so a question naming none of the owner's subjects is the `
    + "session's to settle. Take the reading cheapest to reverse and record it on the item it shapes:\n"
    + '  forge record decision ISS-nn --decision "reading | assumption | undo"\n\n'
    + `Still the owner's here: ${categories.map((one) => one.name).join("; ")}. Name the subject in the question `
    + "and ask again where it is one of these." + how(),
);

/* One short read per question: a profile nobody read sends the question to the owner. */
const recorded = async (ev, questions) => {
  const aimed = aimAt(ev.cwd || process.cwd(), "question");
  if (aimed.unread) return;
  const read = await profileOf();
  if (read.unread || read.profile === STRICT) return;
  const categories = ownerCategories(asksOwnerTerms());
  if (questions.some((one) => ownersAlways(one, categories))) return;
  routine(aimed.slug, read.profile, categories);
};

export const run = async (ev) => {
  if (ev.tool_name !== ASKS) return;
  const mode = asksScope().value;
  if (mode === "off") return;
  const questions = ev.tool_input?.questions;
  if (!Array.isArray(questions) || !questions.length) return;
  if (mode !== "decide") return recorded(ev, questions);
  const room = asksRoom();
  if (!room) return;
  await decide(ev, questions, room);
};
