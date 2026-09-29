/* The priority question: one typed question to the model a project names for it — which level of that
   project's own scale the issue a body describes earns — answered through a tool whose only values are
   the levels the scale states. The state it reads and the way it is asked are the complexity
   question's, so the two travel the same redaction and the same clock. docs/cli/proposed-fields.md. */
import { COMPLEXITY_MARK, DATE_MARK, askTyped, numberOrNull } from "../complexity/complexity.mjs";
import { PRIORITY_PROPOSAL } from "../codex-log.mjs";

const NAME = "priority";

/** The tool, its values the stated levels and nothing else, so an answer outside the scale cannot be sent. */
export const priorityTool = (levels) => ({
  name: NAME,
  description: "The priority this issue earns on this project's own scale.",
  input_schema: {
    type: "object",
    properties: {
      priority: { type: "string", enum: levels.map(([level]) => level), description: "One of the levels, highest first as the role lists them." },
      confidence: { type: "number", minimum: 0, maximum: 1,
        description: "Your own estimate, 0 to 1, of how likely this is the level the project's owner would set." },
      why: { type: "string", description: "One sentence naming what in the body decided it." },
    },
    required: ["priority", "why"],
  },
});

/** The role, carrying each level's text as the project wrote it: the scale is the whole of what is judged against. */
export const priorityRole = (levels) => [
  "You are given one issue from a software project's tracker: its key, title, category and body. Answer by",
  `calling the \`${NAME}\` tool once, and say nothing else.`,
  "This project's priorities, highest first, and what earns each in the project's own words:",
  ...levels.map(([level, text]) => `- ${level}: ${text}`),
  "Judge what the body says goes wrong, for whom and how often while it stays unfixed — not how much work the",
  "fix is and not how long the issue has waited.",
  `Where the text reads ${DATE_MARK}, a date or a span of time stood there and was removed so it would not weigh;`,
  `where it reads ${COMPLEXITY_MARK}, a size somebody once set stood there and was removed. Judge as if neither had been written.`,
  "`confidence` is your own estimate between 0 and 1 of how likely your answer is the level the project's",
  "owner would set; `why` is one sentence naming what in the body decided it.",
].join("\n");

/** The answer the tool call carries, or why there is none, as the complexity question's reader answers. */
export const readPriority = (levels) => (calls = []) => {
  const call = calls.find((one) => one.name === NAME);
  if (!call) return { refused: `the model made no \`${NAME}\` call, so there is no proposal to read` };
  const { priority: given, confidence, why } = call.input ?? {};
  const allowed = levels.map(([level]) => level);
  if (!allowed.includes(given)) return { refused: `\`${given}\` is no level of this project's scale; they are ${allowed.join(", ")}` };
  return { proposed: given, confidence: numberOrNull(confidence), why: String(why ?? "").trim() };
};

const heldPriority = (row) => (row?.priority ? String(row.priority) : null);

/** One question over the levels a record states; the options are the complexity question's own. */
export const askPriority = (values, model, row, levels, options = {}) => askTyped(values, model, row, {
  tool: priorityTool(levels), role: priorityRole(levels), read: readPriority(levels), kind: PRIORITY_PROPOSAL, held: heldPriority,
}, options);
