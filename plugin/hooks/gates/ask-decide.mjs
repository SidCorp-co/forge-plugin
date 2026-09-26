// Answer a question the session declared reversible from the owner's own precedent, where the project
// opted in, and leave every other question to the owner. how/ask-decide.md.

import { answer, askedAlready, context, remaining } from "../_hook.mjs";
import { asksOwnerTerms, asksScope } from "../../src/resolve/settings.mjs";
import { gateway } from "../../src/resolve/machine/stores.mjs";
import { DECLARE_FORM, ownerCategories, ownersBefore, reversalOf } from "../../src/asks/declared.mjs";
import { DECIDED, OWNER, asksRoom, decidedIds, decidedPath, logOutcome } from "../../src/asks/decided.mjs";
import { OWNER_KIND, layerPaths, precedentsIn, refreshLayer, shortlistFor } from "../../src/asks/layer.mjs";
import { judge, judgeModel } from "../../src/asks/judge.mjs";

const ASKS = "AskUserQuestion";
/* What the build and the goals may take of the clock, so the judge keeps the larger part of it. */
const BUILD_SHARE = 0.4;
const GOALS_MS = 6_000;
const MARGIN_MS = 3_000;

const TEACH = "The ask-decide gate: this project decides a question from the owner's own precedent when the question "
  + `ends with ${DECLARE_FORM} and names nothing that is always the owner's. This one declared nothing, so it went `
  + "to the owner. How: `forge hooks --how ask-decide`";

/* The project's goals, bounded: a tracker that does not answer costs the judge its goals, not the question. */
const goalsWithin = async (ms) => {
  const { briefGoals } = await import("../../src/tracker/knowledge/brief.mjs");
  const timeout = new Promise((done) => {
    setTimeout(() => done({ goals: [], why: "the tracker did not answer in time" }), ms).unref();
  });
  try {
    return await Promise.race([briefGoals(), timeout]);
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

const decide = async (ev, questions, room) => {
  const categories = ownerCategories(asksOwnerTerms());
  const before = questions.map((one) => ownersBefore(one, categories));
  const held = before.findIndex(Boolean);
  if (held >= 0) {
    toOwner(ev, questions, `"${questions[held].question}": ${before[held]}`, room);
    if (!reversalOf(questions[held]) && !askedAlready(ev, "ask-decide", "ask-declare")) context(TEACH);
    return;
  }
  const decided = decidedIds(room);
  if (decided.unreadable) return toOwner(ev, questions, decided.unreadable, room);
  const paths = layerPaths(room);
  const built = refreshLayer(paths, { skip: decided.ids, until: Date.now() + remaining() * BUILD_SHARE });
  if (!built.complete) return toOwner(ev, questions, "the precedent layer is not yet read to the end of its transcripts", room);
  const rows = precedentsIn(paths);
  const shortlists = questions.map((one) => shortlistFor(one, rows));
  const bare = shortlists.findIndex((list) => !list.some((one) => one.kind === OWNER_KIND));
  if (bare >= 0) return toOwner(ev, questions, `"${questions[bare].question}" has no close owner precedent`, room);
  const { problem, values } = gateway();
  if (problem) return toOwner(ev, questions, `no judge to ask: ${problem}`, room);
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

export const run = async (ev) => {
  if (ev.tool_name !== ASKS) return;
  if (asksScope().value !== "decide") return;
  const questions = ev.tool_input?.questions;
  if (!Array.isArray(questions) || !questions.length) return;
  const room = asksRoom();
  if (!room) return;
  await decide(ev, questions, room);
};
