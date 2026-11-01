/* A question record asks a person on the issue's own screen, through the tracker's ask route, before
   its comment goes up: a comment alone reached nobody (ISS-2317). The ask is built and measured while
   the record is prepared, so every refusal it can earn here comes before any write of the call; the
   tracker's own refusal of it comes before the comment. docs/cli/record-question.md. */
import { capsOf } from "../../tracker/field-write.mjs";
import { scoped, write } from "../../tracker/rest.mjs";
import { refuse } from "../../refusal.mjs";
import { ONE_READ } from "../../brief/waived.mjs";
import { ASKS } from "./compose.mjs";

/* The run asked it and the run acts on the answer, which is the binding `forge-runner question ask`
   sends; `this_call` is refused by the route without a fingerprint of a call, which a reading is not. */
const OPTION = { authority: "writer", bindsTo: "session", executedBy: "agent" };

const optionId = (at) => `reading-${at}`;

/* Counted as the route counts a string, in UTF-16 units, so what passes here is what passes there. */
const over = (text, cap) => cap !== null && cap !== undefined && text.length > cap;

const measured = (reference, prompt, readings) => {
  const caps = capsOf("forge_questions");
  if (over(readings, caps.options?.self)) {
    refuse(`record question: ${reference}'s question would offer ${readings.length} readings and the question `
      + `route takes ${caps.options.self} options. Nothing was sent. Ask between fewer readings.`);
  }
  if (over(prompt, caps.prompt?.self)) {
    refuse(`record question: the question for ${reference} is ${prompt.length} characters and the route takes `
      + `${caps.prompt.self}. Nothing was sent. Shorten the issue's title.`);
  }
};

/* The project's agent-gating profile, off the tracker for the reason `brief/waived.mjs` reads it there
   (REQ-76). `known` is false where the read did not answer, so a question core alone can judge is left
   for core rather than refused on a profile nobody read. */
const strictOf = async () => {
  const gates = await scoped("forge_config", { action: "gates" }, true, ONE_READ);
  return gates?.refused ? { known: false, strict: false } : { known: true, strict: gates?.profile === "strict" };
};

/* Core refuses a question an agent may decide for itself where the project is not strict, or where it
   is strict and the question is not serious (QUESTION_AGENT_DECIDES, REQ-79 BC-14/BC-18). A question
   addressed to the master waits on no person and is taken on any project; a decision the run may make
   is recorded, not asked. Refused here, before the ask writes anything, so the route out is the one a
   run reads rather than core's bare code. */
const DECIDE = (reference) => `  forge record decision ${reference} --decision "reading | assumption | undo"`;
const MASTER = (reference) => `  forge record question ${reference} --reading "<reading -> outcome>" `
  + "--reading \"<reading -> outcome>\" --recommend <n> --to master";

const agentDecides = (got, reference, strict) => {
  if (got.to === "master") return;
  if (!got.serious) {
    refuse(`record question: ${reference} asks a person to decide what this run may decide itself, which `
      + `the tracker refuses (QUESTION_AGENT_DECIDES). Nothing was sent. Take the reading cheaper to `
      + `reverse and record it on the item it shapes, or add --serious and ask on a strict project where `
      + `the decision cannot be undone:\n${DECIDE(reference)}\nAsk the master instead where the call is `
      + `the master's and not this run's:\n${MASTER(reference)}`);
  }
  if (strict.known && !strict.strict) {
    refuse(`record question: ${reference} is marked --serious, and on a project that is not strict even a `
      + `serious decision is this run's to make or the master's to take, never a person's `
      + `(QUESTION_AGENT_DECIDES). Nothing was sent. Record the decision, or ask the master with `
      + `--to master:\n${DECIDE(reference)}`);
  }
};

/** The question one record asks, refused here on anything the route's declared caps would refuse, and
 *  on a decision core leaves to the agent rather than a person. */
const askOf = (got, { documentId, title, reference }, strict) => {
  const prompt = `${reference}: ${title}. ${ASKS}`;
  measured(reference, prompt, got.reading);
  agentDecides(got, reference, strict);
  return {
    issueId: documentId,
    prompt,
    options: got.reading.map((label, at) => ({ id: optionId(at + 1), label, ...OPTION })),
    recommendedOptionId: optionId(Number(got.recommend)),
    ...(got.serious ? { serious: true } : {}),
    ...(got.to === "master" ? { blockerKind: "master_or_peer" } : {}),
  };
};

const sameReadings = (held, options) => (held ?? []).length === options.length
  && options.every((one, at) => held[at]?.label === one.label);

/* Who an ask is put to and how, off either the open row or this call's payload, so the retry that
   reuses a standing question is the one that would ask the same person the same way. Readings and the
   recommendation alone matched a person-directed question to a `--to master` retry, which recorded a
   recipient no question held (codex F1). */
const addressed = (one) => `${one.blockerKind === "master_or_peer" ? "the master" : "a person"}`
  + `${one.serious ? ", marked serious" : ""}`;
const sameAddress = (held, data) =>
  (held.blockerKind ?? null) === (data.blockerKind ?? null) && Boolean(held.serious) === Boolean(data.serious);

/** Sent, unless an open question on the issue already offers these readings in this order: that is
 *  the one a call before this one asked before its comment failed, and asking again would put two in
 *  front of the person. Either way the id is printed, which is where the person answers. */
const asked = async (data, reference) => {
  const listed = await scoped("forge_questions.list", { issueId: data.issueId });
  const standing = (listed?.questions ?? [])
    .find((one) => one.status === "open" && sameReadings(one.options, data.options));
  if (standing) {
    if (!sameAddress(standing, data)) {
      refuse(`record question: question ${standing.id} is open on ${reference} offering these readings `
        + `addressed to ${addressed(standing)}, and this call asks ${addressed(data)}. Nothing was sent: a `
        + `retry reuses the open question, so it would record a recipient no question holds. Match the open `
        + `one, or answer it before you ask it a different way.`);
    }
    const held = standing.options.findIndex((one) => one.id === standing.recommendedOptionId) + 1;
    const wanted = data.options.findIndex((one) => one.id === data.recommendedOptionId) + 1;
    if (held !== wanted) {
      refuse(`record question: question ${standing.id} is open on ${reference} offering these readings and `
        + `recommending reading ${held}, and this call recommends reading ${wanted}. Nothing was sent: the record `
        + `would contradict what the person is shown. Record what they are asked:\n  --recommend ${held}`);
    }
    console.log(`${reference}  question ${standing.id} already asks these readings and is open: not asked again`);
    return standing;
  }
  const answer = await write("forge_questions.ask", { data });
  console.log(`${reference}  asked: question ${answer?.id}, answered on the issue's own screen`);
  return answer;
};

/** What a shaped write sends ahead of its comments: every question its blocks ask, built and measured
 *  now, sent when called. Any other kind asks nothing. */
export const askPrepared = async (kind, blocks, issue) => {
  if (kind !== "question") return null;
  /* Read only where a block asks a person a serious decision, the one case whose refusal turns on it:
     a question the run may decide is refused without it, and one addressed to the master needs none. */
  const needsStrict = blocks.some((got) => got.serious && got.to !== "master");
  const strict = needsStrict ? await strictOf() : { known: false, strict: false };
  const questions = blocks.map((got) => askOf(got, issue, strict));
  return async () => {
    for (const one of questions) await asked(one, issue.reference);
  };
};
