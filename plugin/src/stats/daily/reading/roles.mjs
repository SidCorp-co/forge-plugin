/* What each role of the page's reading is told, and the one tool it answers through; what each role
   is for is judge.mjs's opening. The schema bounds each answer and judge.mjs checks it anyway, since a
   bound a model was told is not one it kept. */
/** The longest a reading, a reason or a decision may be: two lines of the page. */
export const TEXT_CHARS = 200;
export const MOST_DECISIONS = 5;
export const MOST_CANDIDATES = 6;
export const ACTIONS = ["raise", "file", "drop", "revert", "leave alone"];
export const VERDICTS = ["better", "worse", "steady"];
export const DIRECTIONS = [...VERDICTS, "unclear"];
export const NO_COMMAND = "leave alone";
export const ISSUE_KEY = /\bISS-\d+\b/gu;

const text = (maxLength, description) => ({ type: "string", maxLength, description });

export const EXPLORE_TOOL = {
  name: "candidates",
  description: "The findings one section's figures suggest, each resting on one figure.",
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array", maxItems: MOST_CANDIDATES,
        items: {
          type: "object",
          properties: {
            figure: { type: "string", description: "The key of the one figure this rests on, exactly as given." },
            reading: text(TEXT_CHARS, "What that figure shows against the figures it compares with."),
            direction: { type: "string", enum: DIRECTIONS, description: "What it reads as for the harness's cost." },
          },
          required: ["figure", "reading", "direction"],
        },
      },
    },
    required: ["candidates"],
  },
};

export const REVIEW_TOOL = {
  name: "review",
  description: "Every candidate kept or dropped, a dropped one with its reason.",
  input_schema: {
    type: "object",
    properties: {
      kept: { type: "array", items: { type: "object", properties: {
        candidate: { type: "integer", description: "The candidate's number." },
        reading: text(TEXT_CHARS, "The reading as it stands, or reworded to say only what the figure supports."),
      }, required: ["candidate"] } },
      dropped: { type: "array", items: { type: "object", properties: {
        candidate: { type: "integer", description: "The candidate's number." },
        why: text(TEXT_CHARS, "What in the figures fails to support it."),
      }, required: ["candidate", "why"] } },
    },
    required: ["kept", "dropped"],
  },
};

export const JUDGE_TOOL = {
  name: "judge",
  description: "One line per section and at most five decisions, or nothing to decide.",
  input_schema: {
    type: "object",
    properties: {
      sections: { type: "array", items: { type: "object", properties: {
        section: { type: "string", description: "The section's id, exactly as given." },
        verdict: { type: "string", enum: VERDICTS },
        why: text(TEXT_CHARS, "What in that section's findings decided it."),
      }, required: ["section", "verdict", "why"] } },
      decisions: { type: "array", maxItems: MOST_DECISIONS, items: { type: "object", properties: {
        action: { type: "string", enum: ACTIONS },
        what: text(TEXT_CHARS, "What to do, in words a person acts on."),
        figure: { type: "string", description: "The key of the one figure that supports it, exactly as given." },
        command: { type: "string", description: "The one command of this CLI, or one of the issue keys given, that carries it out; empty only for leave alone." },
      }, required: ["action", "what", "figure"] } },
      nothing: { type: "boolean", description: "True where the day holds nothing to decide." },
    },
    required: ["sections", "decisions", "nothing"],
  },
};

const FIGURES_SAID = "Each figure carries a key, a label and a value; the labels say which day or window a value is "
  + "for, so a value on the day is read against the day before, the seven days before and the trend. A row "
  + "of fewer than ten runs moves by chance.";

export const EXPLORE_ROLE = [
  "You read one section of a daily report on what a coding-agent harness cost on one machine.",
  FIGURES_SAID,
  `Answer by calling \`candidates\` once with at most ${MOST_CANDIDATES} candidate findings. Each rests on one figure, named by its key`,
  `exactly as given, and says in at most ${TEXT_CHARS} characters what that figure shows against what it compares with.`,
  "Never state a value the figures do not hold. A section with nothing worth saying answers with no candidates.",
].join("\n");

export const REVIEW_ROLE = [
  "You review candidate findings another reader proposed about one section of a daily harness report.",
  FIGURES_SAID,
  "Answer by calling `review` once. Keep a candidate only where the figure it cites, against the figures it",
  "compares with, supports what it says; drop one resting on a thin row, a movement inside the trend's own",
  "range, or a comparison the figures do not hold, and say why. Every candidate is kept or dropped. You may",
  "reword a kept reading to say only what the figure supports; you may not add a candidate or change its figure.",
].join("\n");

export const JUDGE_ROLE = [
  "You judge one day of a coding-agent harness's cost from its daily report. For each section you are given the",
  "reviewed findings, or the unreviewed candidates where no review ran, or the figures themselves where no",
  "finding was proposed; and the issue keys the page names, each with where it sits.",
  "Answer by calling `judge` once:",
  "- For every section, one line: better, worse or steady for the harness's cost, and why.",
  `- At most ${MOST_DECISIONS} decisions. A decision is something to do: raise an issue given (it deserves attention sooner),`,
  "  file a new one, drop an issue given, revert a release, or leave a movement alone. A reading with no decision",
  "  behind it is not a decision. Each names the key of the one figure that supports it, exactly as given, and the",
  "  command that carries it out: one of the issue keys given, or a command of this CLI such as `forge new`,",
  "  `forge issue ISS-n`, `forge stats eval` or `forge stats diagnose`, named by its verb rather than every flag.",
  "  Leave alone needs no command.",
  "- A day with nothing to decide says `nothing` true with no decisions; that is a whole answer.",
  "Cite only figure keys and issue keys you were given.",
].join("\n");
