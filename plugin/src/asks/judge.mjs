/* The judge: one typed call to the consult's model, which reads a call's declared questions beside
   the precedents shortlisted for each and says, per question, which offered option those precedents
   point to or that the owner has to answer. What it says is checked against what it was offered, and
   anything outside that is the owner's. plugin/hooks/how/ask-decide.md. */
import { defaultEffort, rungFor, rungIn } from "../codex/codex-plan.mjs";
import { modelBehind } from "../resolve/machine/stores.mjs";
import { modelCall } from "../wire/model-call.mjs";
import { DECISION_KIND, OWNER_KIND, RECOMMENDED } from "./layer.mjs";
import { reversalOf } from "./declared.mjs";

const DECIDE = "decide";
const TO_OWNER = "owner";

const DECIDE_TOOL = {
  name: DECIDE,
  description: "For each question, the option its precedents point to, or `owner` where they do not settle it.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string", description: "The question's text, exactly as given." },
            verdict: { type: "string", enum: [DECIDE, TO_OWNER] },
            option: { type: "string", description: "The label of the option chosen, exactly as offered; absent for `owner`." },
            precedent: { type: "string", description: "The id of the precedent followed; absent for `owner`." },
            precedentsAgree: { type: "boolean", description: "Whether the close precedents point the same way." },
            reason: { type: "string", description: "One sentence: what in the precedent decided it, or why the owner must answer." },
          },
          required: ["question", "verdict", "precedentsAgree", "reason"],
        },
      },
    },
    required: ["questions"],
  },
};

export const JUDGE_ROLE = [
  "You decide questions a coding session wanted to ask its owner, and only from what the owner has already",
  "answered. Each question comes with its options, the option the session recommended, how the session says",
  "the choice is undone, this project's goals, and a shortlist of precedents: earlier questions the owner",
  "answered (with the answer, and whether it matched that question's recommendation) and decisions this",
  "project's runs recorded. Answer by calling the `decide` tool once, one entry per question, and say nothing else.",
  "",
  "Rules:",
  "- Decide only where a precedent is about the same subject and its answer points at one of the offered options.",
  "  Name that precedent's id and give that option's label exactly as offered.",
  "- Where the precedents disagree with the session's recommendation, the precedents win.",
  "- Where no precedent is close enough, the answer is `owner`: a question with no precedent is new ground.",
  "- Where the close precedents disagree with each other, the answer is `owner`, and precedentsAgree is false.",
  "- Where the owner once wrote their own answer instead of choosing an option, read that as the options having",
  "  been wrong for that subject, and answer `owner` unless the offered options now include what they wrote.",
  "- An owner answer outranks a recorded decision. A recorded decision alone settles nothing the owner has not.",
  "- Never decide from the question's wording alone, and never from the recommendation alone.",
].join("\n");

const precedentShown = (one) => (one.kind === DECISION_KIND
  ? { id: one.id, kind: "recorded decision", date: one.at, issue: one.issue, readings: one.readings, closeness: one.score }
  : {
      id: one.id, kind: "owner answer", date: one.at, question: one.question, options: one.options,
      recommended: one.recommended, answer: one.answer, wroteOwnAnswer: one.free,
      matchedRecommendation: one.matched, notes: one.notes, closeness: one.score,
    });

/** What the judge is sent for one call: the questions, each with its options, its declared reversal and
 *  its own shortlist, and the goals once for all of them. */
export const judgeInput = (questions, shortlists, goals) => ({
  goals: goals?.goals?.length ? goals.goals : { none: goals?.why ?? "the project's goals were not read" },
  questions: questions.map((question, at) => ({
    question: question.question,
    header: question.header ?? null,
    options: question.options.map((one) => ({
      label: one.label, description: one.description ?? null, recommended: RECOMMENDED.test(one.label ?? ""),
    })),
    reversal: reversalOf(question),
    precedents: shortlists[at].map(precedentShown),
  })),
});

/** Each question's decision, or the reason the call is the owner's: a call is decided whole or not at
 *  all, since an answer map with a gap skips the dialog for the whole call. `said` is the input the
 *  judge gave its `decide` call. */
export const readVerdicts = (said, questions, shortlists) => {
  const given = Array.isArray(said?.questions) ? said.questions : [];
  const decisions = [];
  for (const [at, question] of questions.entries()) {
    const one = given.find((each) => each?.question === question.question);
    if (!one) return { owner: `the judge said nothing about "${question.question}"` };
    if (one.verdict !== DECIDE) return { owner: `the judge sent "${question.question}" to the owner: ${one.reason ?? "no reason given"}` };
    if (one.precedentsAgree !== true) return { owner: `the close precedents for "${question.question}" do not agree` };
    const option = question.options.find((each) => each.label === one.option);
    if (!option) return { owner: `the judge chose \`${one.option}\`, which "${question.question}" does not offer` };
    const precedent = shortlists[at].find((each) => each.id === one.precedent);
    if (!precedent) return { owner: `the judge followed \`${one.precedent}\`, which is not among the precedents it was given` };
    /* Only an owner answer is followed, and only to the option it names: a judge whose choice its own
       precedent does not bear out has decided from something other than the owner. */
    if (precedent.kind !== OWNER_KIND || precedent.answer !== option.label) {
      return { owner: `the precedent the judge followed for "${question.question}" answered \`${precedent.answer ?? "no option"}\`, not \`${option.label}\`` };
    }
    decisions.push({ question: question.question, option: option.label, precedent, reason: String(one.reason ?? "").trim() });
  }
  return { decisions };
};

/** The model the judge asks: the consult's own rung at the machine's default effort. */
export const judgeModel = (values) => rungFor(defaultEffort(), modelBehind(values));

/* A connection that never opened reached no judge, so it is tried once more inside the same clock; an
   answer the gateway refused, or a clock that ran out, is the owner's at once. The code sits on the
   error fetch threw, which the call keeps as its own error's cause. */
const UNREACHED = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"]);
const unreached = (error) => {
  for (let at = error; at; at = at.cause) {
    if (UNREACHED.has(at.code) || UNREACHED.has(at.errors?.[0]?.code)) return true;
  }
  return false;
};
const ATTEMPTS = 2;

/** One call judged. `send` stands in for `fetch` in the suite; a failure of any kind is the owner's. */
export const judge = async ({ values, model, questions, shortlists, goals, signal, send = fetch }) => {
  const request = {
    endpoint: { url: values.ANTHROPIC_BASE_URL, key: values.ANTHROPIC_AUTH_TOKEN }, model, system: JUDGE_ROLE,
    data: judgeInput(questions, shortlists, goals), tool: DECIDE_TOOL, effort: rungIn(model) ? null : defaultEffort(), signal, send,
  };
  for (let attempt = 1; ; attempt += 1) {
    try {
      const answer = await modelCall(request);
      return readVerdicts(answer.input, questions, shortlists);
    } catch (error) {
      if (attempt < ATTEMPTS && unreached(error) && !signal?.aborted) continue;
      return { owner: `the judge could not be asked: ${error.message}` };
    }
  }
};
