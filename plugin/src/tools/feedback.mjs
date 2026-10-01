/* A defect in this plugin is an issue on the plugin's own project rather than a file, where the
   caller's project allows the channel. What that replaced and why: docs/cli/feedback.md. */
import { bodyFrom } from "../resolve/payload.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { fail, keepOnFailure, projectScope, translateScope, useProject } from "../resolve/settings.mjs";
import { pluginChannel, usageOf } from "../resolve/visibility.mjs";
import { kindsOn } from "../tracker/filing/channel.mjs";
import { agentOf } from "../flow/lease/holder.mjs";
import { hereCopy, pluginCopy } from "./plugin-copy.mjs";
import { documentIdOf, shortOf } from "../tracker/issues.mjs";
import { CAUSE_HELP, liveTitles } from "../tracker/issue-shape.mjs";
import { kindRefusal } from "../tracker/declared/value-sets.mjs";
import { KIND_NAMES } from "../tracker/declared/kinds.mjs";
import { briefGoals, servesOwed } from "../tracker/knowledge/brief.mjs";
import { goalBlock } from "../goals.mjs";
import { bodyOf, keysFrom } from "../tracker/filing/route.mjs";
import { fileAndSay } from "../tracker/filing/say.mjs";
import { moduleForFiling } from "../tracker/modules/definition.mjs";
import { PROJECT, routingBlock, standsInPlugin } from "../tracker/filing/plugin-defect.mjs";

const USAGE = () => [
  usageOf("feedback"),
  `A defect in this plugin, filed on the plugin's own project from any checkout. ${PROJECT} is the`,
  "destination, fixed here, so the project you are standing in is recorded as a fact and decides",
  "nothing. Nothing goes to disk, and whatever refuses a body that was read prints it back.",
  "",
  "  --title T   what is true once it is fixed, one line",
  `  --kind K    ${kindsOn("plugin").join(", ")} — what this project allows on the channel; the default is`,
  `              ${kindsOn("plugin")[0]}, and a body is read against the shape the kind it names needs`,
  "  --with ISS-45   file it with a `relates` edge to that issue, or to each of several separated",
  "              by commas; the keys the note's own body names are listed under the reply instead",
  "  --module M  its primary module, one the plugin's project defines",
  "  --new       file it even where it would have folded onto a neighbour, and say which",
  "",
  CAUSE_HELP,
  "",
  "The body is read against the shape the kind needs, which `forge new -h` prints, and Where is",
  "filled in for you. No finder ranks the note and no lease is taken for it; where this checkout is",
  "the plugin's own project, the priority and complexity its record names models for are proposed and",
  "written onto it, as `forge new` does: docs/cli/feedback.md.",
].join("\n");

/* Typed by no caller: which version was running, which copy of it, whose project, and who met it. */
const whereSection = () => {
  const caller = projectScope();
  const prose = translateScope();
  const mine = hereCopy();
  const held = pluginCopy();
  const stale = held?.stale ? `, and ${held.installed} is the installed one` : "";
  return [
    "## Where",
    "",
    `- forge ${mine.version ?? "an unreadable version"} at ${mine.dir}${stale}`,
    `- met from project ${caller.value ?? "(none)"} (${caller.from ?? "nowhere"}), prose ${prose.value ?? "as written"}`,
    `- agent ${agentOf()}, in ${process.cwd()}`,
  ].join("\n");
};

const lost = (what, refused) => fail(`${PROJECT} refused ${what}: ${refused}`);

/* Aimed in both routes: the goal list a note answers to is the destination's, not the caller's. */
const aimed = () => useProject({ slug: PROJECT, from: "the CLI, for feedback on this plugin" });

/** One of the kinds this project allows on the channel, or a refusal naming what was asked for. */
const kindAsked = (given) => {
  const allowed = kindsOn("plugin");
  if (given === undefined) return allowed[0];
  if (!KIND_NAMES.includes(given)) fail(kindRefusal(given));
  if (!allowed.includes(given)) {
    fail(`This project allows ${allowed.join(", ")} on the channel to ${PROJECT}, and --kind`
      + ` ${given} names another: feedback.plugin says which, in ${pluginChannel().from}.`
      + ` What is withheld goes in this run's report.`);
  }
  return given;
};

/** `forge feedback <file.md|@file|-> --title T [--kind K]`. */
export const feedback = async (argv) => {
  if (wantsHelp(argv)) {
    /* Before the aim: the block says where a plugin defect goes from the caller's project, and after
       it the call would read as one already on the plugin's backlog. The goals are the destination's. */
    const routing = routingBlock();
    aimed();
    const said = goalBlock(await briefGoals(), "A note filed here", standsInPlugin());
    return console.log([USAGE(), routing, said.join("\n")].join("\n\n"));
  }
  const [path, ...rest] = argv;
  if (!path) fail(usageOf("feedback"));
  const { title, new: fresh, with: rides, kind: asksKind, module: named } = flags(rest, "feedback", ["--new"],
    { usage: usageOf("feedback") });
  if (!title) fail("A note needs --title: one line saying what is true once it is fixed.");
  const kind = kindAsked(asksKind);
  const { keys: withKeys, refusal: badKeys } = keysFrom(rides);
  if (badKeys) fail(badKeys);
  /* Registered the instant there is one to lose, a body from stdin being held nowhere else. What it claims, and the one refusal above this line it cannot reach: docs/cli/feedback.md. */
  const written = await bodyFrom(path);
  const keep = (text) => keepOnFailure(`Your note, so that nothing here loses it:\n\n${text}`);
  const dropRead = keep(written);
  /* Read before the project is aimed, so a note the shape will not carry costs no call; `routed` where the note names its issue, a fold otherwise putting its body on some third one. */
  const asked = { title, body: written, kind, sections: [whereSection()], everySection: true,
    duplicates: false, routed: withKeys.length > 0 };
  const read = bodyOf(asked);
  if (read.refusal) fail(read.refusal.text);
  /* The note as it will be filed replaces the note as it was read: both kept is the note printed twice. */
  dropRead();
  const dropKept = keep(read.description);
  /* Before the first call: everything below reaches the plugin's project, in its language. */
  aimed();
  const unnamed = await servesOwed(read.description, "This note's `Serves:` line", standsInPlugin());
  if (unnamed) fail(unnamed);
  /* Resolved against the plugin's own modules, the project being aimed by now. */
  const { module, refusal: unknownModule } = await moduleForFiling(named, "feedback");
  if (unknownModule) fail(unknownModule);
  /* After the project is aimed, and not before: a key names an issue of the plugin's backlog, and
     the same key resolved against the caller's project would relate somebody else's issue. */
  const relations = withKeys.length
    ? await Promise.all(withKeys.map(async (one) =>
      ({ kind: "relates", blocksId: await documentIdOf(one) })))
    : null;
  const page = await liveTitles();
  /* What the note was measured against: a neighbour outside the reading can neither be shown under
     the reply nor folded onto, so a note is filed against less than the backlog and says so. */
  const short = shortOf(page.read, "the set this note was measured against");
  if (short) {
    console.error(`warning: ${short}\nA neighbour outside what was reached is not shown under this`
      + " note and is not folded onto, so the note is filed as a second issue rather than a finding.");
  }
  /* A note carries no band flag, so both are absent; the record that switches a proposal is the
     destination's, which only a checkout of it reads (docs/cli/proposed-fields.md). */
  const { absentIn, proposeAtFiling, proposedElsewhere } = await import("../codex/proposed/fields.mjs");
  const after = standsInPlugin()
    ? proposeAtFiling({ title, body: read.description, kind }, absentIn({}))
    : proposedElsewhere(PROJECT);
  return fileAndSay({ ...asked, read, fresh, relations, page, soft: true, module },
    { withKeys, intro: `The note is a new ${kind} on ${PROJECT}.`, lost, after, dropKept });
};

/* Its own help, like every other verb that answers `-h` itself: the body slot takes a path, and the dispatcher answering first would read `-h` as one. */
feedback.answersHelp = true;
