/* Where a defect in this plugin goes from a checkout that is not this plugin's, rendered off the
   project's key so a closed channel takes its sentence with it: docs/cli/withholding-a-verb.md. */
import { KIND_NAMES, originIn } from "../issue-shape.mjs";
import { pluginChannel, verbForPluginDefect } from "../../resolve/visibility.mjs";
import { projectScope } from "../../resolve/settings.mjs";

export const PROJECT = "forge-plugin";

/** Here a plugin defect and a project issue are one thing: nothing to route, nothing to hold. */
export const onThisRepository = () => projectScope().value === PROJECT;

const PLUGIN_PATH = /\bplugin\/(?:bin|guides|hooks|scripts|skills|src|test)\//u;
const PLUGIN_SLUG = new RegExp(`\\b${PROJECT}\\b`, "u");
const IN_THE_PLUGIN = "A defect in this plugin itself — one of its verbs, its hooks or its gates —";

/** `bugs` is the one kind the channel carried before the key existed; `all` is every kind. */
export const allowedKinds = () => (pluginChannel().value === "all" ? KIND_NAMES : [KIND_NAMES[0]]);

const listed = (names) =>
  (names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0]);

export const routingBlock = () => {
  if (onThisRepository()) {
    return "A defect in this plugin is an issue of this project like any other and is filed here\n"
      + "with the rest: this is the plugin's own checkout, so there is no second backlog to reach.";
  }
  const verb = verbForPluginDefect();
  if (!verb && pluginChannel().value === "off") {
    return `${IN_THE_PLUGIN} is not this project's issue, and this project files none: one met here\n`
      + "goes in the run's report, under the line saying it was withheld by the project, and nothing\n"
      + "about it is written to a backlog. A body whose cause or *Where* names this plugin's own\n"
      + "paths is held rather than filed here.";
  }
  if (!verb) {
    return `${IN_THE_PLUGIN} is not this project's issue, and no route to its backlog is offered\n`
      + "here: one met along the way goes in the run's report.";
  }
  return `${IN_THE_PLUGIN} is not this project's issue:\n`
    + `\`forge ${verb} <note.md> --title "<one line>"\` files it on the plugin's own backlog from\n`
    + `whichever project you are standing in, as ${listed(allowedKinds())}. A round that met none\n`
    + "says so in its report.";
};

/** The write under the block, only under `off`: a rule with no verb is satisfied with `forge new`. */
export const pluginDefectHold = (description) => {
  if (onThisRepository() || pluginChannel().value !== "off") return null;
  const origin = originIn(description);
  if (!PLUGIN_PATH.test(origin) && !PLUGIN_SLUG.test(origin)) return null;
  return "This body says its cause is inside this plugin, and a defect in the plugin is not this "
    + `project's issue: ${origin.trim().split("\n").find(Boolean)}\n`
    + `This project files none — feedback.plugin is off in ${pluginChannel().from} — so the finding `
    + "goes in the run's report, under the line saying it was withheld by the project, and nothing "
    + "is written to this backlog. A body whose cause is this project's own is filed here as it "
    + "always was.";
};

/** So a fold does not read a configured silence as a clean round; the destinations are records'. */
export const pluginFilingLine = (destinations = []) => {
  const filed = destinations.filter((one) => PLUGIN_SLUG.test(String(one ?? "")));
  if (filed.length) return `Plugin defect  ${filed.join("; ")}`;
  const channel = pluginChannel();
  return channel.value === "off"
    ? `Plugin defect  withheld by the project (feedback.plugin: off ← ${channel.from})`
    : "Plugin defect  none filed";
};
