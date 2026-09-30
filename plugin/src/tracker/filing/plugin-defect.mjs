/* Where a defect in this plugin goes from a checkout that is not this plugin's, rendered off the
   project's key so a closed channel takes its sentence with it: docs/cli/withholding-a-verb.md. */
import { readdirSync } from "node:fs";

import { article, originIn } from "../issue-shape.mjs";
import { kindsOn } from "./channel.mjs";
import { pluginChannel, verbForPluginDefect } from "../../resolve/visibility.mjs";
import { projectScope, projectTarget } from "../../resolve/settings.mjs";
import { once } from "../../resolve/config.mjs";
import { hereCopy } from "../../tools/plugin-copy.mjs";

export const PROJECT = "forge-plugin";

/* Two questions with two answers once a verb aims a call elsewhere, so each has its own name and a
   caller says which it asked: where this call's filing lands, and which checkout it stands in. */
/** The filing this call makes lands on the plugin's own backlog: nothing to route, nothing to hold. */
export const aimsAtPlugin = () => projectTarget().value === PROJECT;

/** This checkout is the plugin's own, whatever the call is aimed at. */
export const standsInPlugin = () => projectScope().value === PROJECT;

/* Read off this copy, never typed: the typed list was written before `plugin/agents/` existed and
   stopped matching a path this plugin ships, in silence (ISS-673). withholding-a-verb.md. */
const pluginDirs = () => {
  try {
    return readdirSync(hereCopy().dir, { withFileTypes: true })
      .filter((one) => one.isDirectory() && !one.name.startsWith("."))
      .map((one) => one.name);
  } catch {
    return [];
  }
};

const PLUGIN_PATH = once(() => {
  const dirs = pluginDirs();
  return dirs.length ? new RegExp(`\\bplugin/(?:${dirs.join("|")})/`, "u") : null;
});
const PLUGIN_SLUG = new RegExp(`\\b${PROJECT}\\b`, "u");
const ISSUE_KEY = /\bISS-\d+\b/u;
const IN_THE_PLUGIN = "A defect in this plugin itself — one of its verbs, its hooks or its gates —\nis not this project's issue";

const one = (name) => `${article(name)} ${name}`;

const listed = (names) => (names.length > 1
  ? `${names.slice(0, -1).map(one).join(", ")} or ${one(names.at(-1))}`
  : one(names[0]));

/** Off the aimed reading, the one the hold under it reads, so the two cannot disagree in one call. */
export const routingBlock = () => {
  if (aimsAtPlugin()) {
    return "A defect in this plugin is an issue of this project like any other and is filed here\n"
      + "with the rest: this call files on the plugin's own backlog, so there is no second one to reach.";
  }
  const verb = verbForPluginDefect();
  if (!verb && pluginChannel().value === "off") {
    return `${IN_THE_PLUGIN}, and this project files none:\n`
      + "one met here goes in the run's report, under the line saying it was withheld by the\n"
      + "project, and nothing about it is written to a backlog. A body whose cause or *Where*\n"
      + "names this plugin's own paths is held rather than filed here.";
  }
  if (!verb) {
    return `${IN_THE_PLUGIN}, and no route to its backlog is offered here:\n`
      + "one met along the way goes in the run's report.";
  }
  return `${IN_THE_PLUGIN}:\n`
    + `\`forge ${verb} <note.md> --title "<one line>"\` files it on the plugin's own backlog from\n`
    + `whichever project you are standing in, as ${listed(kindsOn("plugin"))}.\n`
    + "A round that met none says so in its report.";
};

/** The write under the block, only under `off`: a rule with no verb is satisfied with `forge new`. */
export const pluginDefectHold = (description) => {
  if (aimsAtPlugin() || pluginChannel().value !== "off") return null;
  const origin = originIn(description);
  if (!PLUGIN_PATH()?.test(origin) && !PLUGIN_SLUG.test(origin)) return null;
  return "This body says its cause is inside this plugin, and a defect in the plugin is not an issue "
    + `of ${projectTarget().value}, where this call files: ${origin.trim().split("\n").find(Boolean)}\n`
    + `This project files none — feedback.plugin is off in ${pluginChannel().from} — so the finding `
    + "goes in the run's report, under the line saying it was withheld by the project, and nothing "
    + "is written to this backlog. A body whose cause is this project's own is filed here as it "
    + "always was.";
};

/** So a fold does not read a configured silence as a clean round; the destinations are records'. */
export const pluginFilingLine = (destinations = []) => {
  /* Which backlog a destination reached is the checkout's answer, the report being read after the
     call and never aimed: off this one the slug it names, on it any issue of this project (ISS-1700). */
  const here = standsInPlugin();
  const filed = destinations.filter((one) => (here ? ISSUE_KEY : PLUGIN_SLUG).test(String(one ?? "")));
  if (filed.length) return `Plugin defect  ${filed.join("; ")}`;
  const channel = pluginChannel();
  return !here && channel.value === "off"
    ? `Plugin defect  withheld by the project (feedback.plugin: off ← ${channel.from})`
    : "Plugin defect  none filed";
};
