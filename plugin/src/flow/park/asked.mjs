/* A question record asks a person on the issue's own screen, through the tracker's ask route, before
   its comment goes up: a comment alone reached nobody (ISS-2317). The ask is built and measured while
   the record is prepared, so every refusal it can earn here comes before any write of the call; the
   tracker's own refusal of it comes before the comment. docs/cli/record-question.md. */
import { capsOf } from "../../tracker/field-write.mjs";
import { scoped, write } from "../../tracker/rest.mjs";
import { refuse } from "../../refusal.mjs";
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
  readings.forEach((one, at) => {
    if (!over(one, caps.label?.self)) return;
    refuse(`record question: --reading ${at + 1} is ${one.length} characters and an option on the question `
      + `route takes ${caps.label.self}. Nothing was sent. Say that reading and its outcome in fewer words.`);
  });
  if (over(prompt, caps.prompt?.self)) {
    refuse(`record question: the question for ${reference} is ${prompt.length} characters and the route takes `
      + `${caps.prompt.self}. Nothing was sent. Shorten the issue's title.`);
  }
};

/** The question one record asks, refused here on anything the route's declared caps would refuse. */
const askOf = (got, { documentId, title, reference }) => {
  const prompt = `${reference}: ${title}. ${ASKS}`;
  measured(reference, prompt, got.reading);
  return {
    issueId: documentId,
    prompt,
    options: got.reading.map((label, at) => ({ id: optionId(at + 1), label, ...OPTION })),
    recommendedOptionId: optionId(Number(got.recommend)),
  };
};

const sameReadings = (held, options) => (held ?? []).length === options.length
  && options.every((one, at) => held[at]?.label === one.label);

/** Sent, unless an open question on the issue already offers these readings in this order: that is
 *  the one a call before this one asked before its comment failed, and asking again would put two in
 *  front of the person. Either way the id is printed, which is where the person answers. */
const asked = async (data, reference) => {
  const listed = await scoped("forge_questions.list", { issueId: data.issueId });
  const standing = (listed?.questions ?? [])
    .find((one) => one.status === "open" && sameReadings(one.options, data.options));
  if (standing) {
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
export const askPrepared = (kind, blocks, issue) => {
  if (kind !== "question") return null;
  const questions = blocks.map((got) => askOf(got, issue));
  return async () => {
    for (const one of questions) await asked(one, issue.reference);
  };
};
