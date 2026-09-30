/* Which kinds a feedback channel carries, for both channels a project names: the plugin's backlog
   and its own. Held once so neither verb spells the mapping again: docs/cli/withholding-a-verb.md. */
import { KIND_NAMES } from "../declared/kinds.mjs";
import { feedbackScope } from "../../resolve/settings.mjs";

/** `bugs` is the one kind a channel carried before the key existed; `all` is every kind. */
export const kindsOn = (channel) => (feedbackScope()[channel].value === "all" ? KIND_NAMES : [KIND_NAMES[0]]);

/** A kind the project's own channel does not carry, refused by the key's name; a kind no channel knows is the shape's to refuse. */
export const kindOffProjectChannel = (kind) => {
  const allowed = kindsOn("project");
  if (!KIND_NAMES.includes(kind) || allowed.includes(kind)) return null;
  return `new: this project files ${allowed.join(", ")} alone on its own backlog, and --category ${kind}`
    + ` names another: feedback.project says which, in ${feedbackScope().project.from}. A run records the`
    + " finding on the issue it is working instead, and a person files it on the tracker's own screen."
    + " Nothing was sent.";
};
