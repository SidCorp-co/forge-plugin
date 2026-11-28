// cm:why a finding that changes what a user sees or should expect is the project's Feedback, which triage turns into a requirement and then an issue; core refuses no feature issue, so this verb is the tool the lane is kept with (guide what-is-an-issue)
import { bodyFrom } from "../../resolve/payload.mjs";
import { flags, wantsHelp } from "../../resolve/flags.mjs";
import { fail } from "../../resolve/settings.mjs";
import { aimedBy } from "../../resolve/project/aimed.mjs";
import { helpOf, usageOf } from "../../resolve/visibility.mjs";
import { write } from "../../tracker/rest.mjs";

const FEEDBACK_KINDS = ["idea", "bug", "change_request", "question"];
const FEEDBACK_TARGETS = ["requirement", "issue", "release", "workflow", "endpoint", "mockup", "screen"];
const SEVERITIES = ["low", "medium", "high", "critical"];

const HELP = () => [
  helpOf("product-feedback"),
  "",
  "  --title T      one line, what the user sees or should expect",
  `  --kind K       ${FEEDBACK_KINDS.join(" | ")}`,
  `  --<target> X   exactly one of ${FEEDBACK_TARGETS.map((one) => `--${one}`).join(", ")}: what it is about`,
  `  --severity S   ${SEVERITIES.join(" | ")}, optional`,
  "  --where W      where it was seen, optional",
  "  --project <slug>  file it on another project for this call alone",
  "",
  "Triage turns an item into a requirement and then an issue; it is not an issue itself.",
].join("\n");

// cm:guard refused before anything is sent: core would refuse the same shape, but only after the body was read and a stdin body consumed
const refusal = ({ title, kind, severity }, targets) => {
  if (!title) return "product-feedback needs --title: one line saying what the user sees or should expect.";
  if (!FEEDBACK_KINDS.includes(kind)) {
    return `product-feedback needs --kind, one of ${FEEDBACK_KINDS.join(", ")}${kind ? `; ${kind} is none of them` : ""}.`;
  }
  if (severity !== undefined && !SEVERITIES.includes(severity)) {
    return `product-feedback --severity is one of ${SEVERITIES.join(", ")}; ${severity} is none of them.`;
  }
  if (targets.length !== 1) {
    const named = targets.length ? `names ${targets.map((one) => `--${one}`).join(" and ")}` : "names none";
    return `product-feedback is about exactly one target, and this ${named}: give one of ${FEEDBACK_TARGETS.map((one) => `--${one}`).join(", ")}.`;
  }
  return null;
};

/** `forge product-feedback <file.md|@file|-> --title T --kind K --<target> X`. */
export const productFeedback = async (typed) => {
  const { rest: argv } = aimedBy(typed, "product-feedback");
  if (wantsHelp(argv)) return console.log(HELP());
  const [path, ...rest] = argv;
  if (!path) fail(usageOf("product-feedback"));
  const given = flags(rest, "product-feedback", [], { usage: usageOf("product-feedback") });
  const targets = FEEDBACK_TARGETS.filter((one) => given[one] !== undefined);
  const refused = refusal(given, targets);
  if (refused) fail(`${refused} Nothing was sent.`);
  const body = await bodyFrom(path);
  const [target] = targets;
  const data = {
    kind: given.kind, title: given.title, body,
    ...(given.severity === undefined ? {} : { severity: given.severity }),
    ...(given.where === undefined ? {} : { whereSeen: given.where }),
    [target]: given[target],
  };
  const answer = await write("forge_project_feedback", { action: "submit", data }, undefined, true);
  if (answer?.refused) fail(`The tracker refused the feedback: ${answer.refused}`);
  console.log(JSON.stringify(answer, null, 2));
};
