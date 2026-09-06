/* A defect in this plugin is an issue on the plugin's own project from the moment it is met, and
   nothing goes to disk. What that replaced and why each rule below: docs/cli/feedback.md. */
import { bodyFrom } from "../resolve/payload.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { fail, keepOnFailure, projectScope, translateScope, useProject } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { agentOf } from "../flow/lease.mjs";
import { hereCopy, pluginCopy } from "./plugin-copy.mjs";
import { documentIdOf, shortOf } from "../tracker/issues.mjs";
import { filedAs, inFlowWords, keysOffered, liveTitles } from "../tracker/issue-shape.mjs";
import { foldedInto, suggestionLines } from "../tracker/filing/neighbours.mjs";
import { bodyOf, fileIssue, keysFrom } from "../tracker/filing/route.mjs";
import { commentLanded, issueLanded, sayLanded } from "../tracker/filing/landed.mjs";

/** This plugin's project, read from no checkout: the caller's `.forge.json` says where a note came
 *  FROM and never where it goes. */
export const PROJECT = "forge-plugin";
const KIND = "bug";

export const USAGE = [
  usageOf("feedback"),
  "A defect in this plugin, filed as a bug on the plugin's own project — from any checkout, on the",
  `credential in ~/.config/forge/config.json. The destination is ${PROJECT}, fixed here, so the slug`,
  "of the project you are standing in is recorded as a fact and decides nothing. Nothing goes to disk,",
  "and once the body has been read, whatever refuses it prints it back.",
  "",
  "  --title T   what is true once it is fixed, one line",
  "  --with ISS-45   file it with a `relates` edge to that issue, or to each of several separated",
  "              by commas; the keys the note's own body names are listed under the reply instead",
  "  --new       file it even where the mark would have folded it onto a neighbour, and say which",
  "",
  "Every note is measured against what is already open on that project the way a filing is:",
  "`forge new -h` carries the two questions, the floor and the fold, and this verb prints the same",
  "block under its result. A note marked `Size: fix.` lands on the nearest of the neighbours that",
  "name its place, as a finding rather than as an issue of its own. That fold is the only one: a",
  "title already open on that project is a neighbour like any other and routes nothing by itself.",
  "",
  `The body is read against the ${KIND} shape: What happened, Outcome, Rules and Out of scope are`,
  "required, and `forge new -h` prints what each wants. Where is filled in for you — the plugin",
  "version, the copy that answered, the project you called from and the agent — so none of it is",
  "typed, and a body carrying its own Where heading gets this one after it.",
  "",
  "No lease is taken and none is renewed. This is the finder's route, like `forge new --into`:",
  "an issue you do not hold is commented on without claiming it. Nothing here ranks the note either,",
  "so it is filed unranked and says so: whoever maintains this plugin raises it, not whoever met it.",
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

/** `forge feedback <file.md|@file|-> --title T`. */
export const feedback = async (argv) => {
  if (wantsHelp(argv)) return console.log(USAGE);
  const [path, ...rest] = argv;
  if (!path) fail(usageOf("feedback"));
  const { title, new: fresh, with: rides, ...extra } = flags(rest, "feedback", ["--new"]);
  if (!title) fail("A note needs --title: one line saying what is true once it is fixed.");
  const unknown = Object.keys(extra);
  if (unknown.length) {
    fail(`feedback takes --title, --with and --new and nothing else; ${unknown.map((one) => `--${one}`).join(", ")}`
      + ` names no flag of it. The kind is always ${KIND}, the project is always ${PROJECT}, and Where is`
      + " filled in.");
  }
  const { keys: withKeys, refusal: badKeys } = keysFrom(rides);
  if (badKeys) fail(badKeys);
  /* Registered the instant there is one to lose, a body from stdin being held nowhere else. What
     it claims, and the one refusal above this line that it cannot reach: docs/cli/feedback.md. */
  const written = await bodyFrom(path);
  const keep = (text) => keepOnFailure(`Your note, so that nothing here loses it:\n\n${text}`);
  keep(written);
  /* Before the project is aimed, so a note the shape will not carry costs no call. */
  /* `routed` where the note names its issue: a note related to one is carried by that issue's flow,
     and a fold would put its body on some third one instead. */
  const asked = { title, body: written, kind: KIND, sections: [whereSection()], everySection: true,
    duplicates: false, routed: withKeys.length > 0 };
  const read = bodyOf(asked);
  if (read.refusal) fail(read.refusal.text);
  keep(read.description);
  /* Before the first call: everything below reaches the plugin's project, in its language. */
  useProject({ slug: PROJECT, from: "the CLI, for feedback on this plugin" });
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
  const filed = await fileIssue({ ...asked, fresh, relations, page, soft: true });
  if (filed.refusal) fail(filed.refusal.text);
  const { beside, said } = filed;
  if (filed.joined) {
    if (filed.answer?.refused) lost(`a comment on ${filed.joined.issueId}`, filed.answer.refused);
    keepOnFailure(null);
    console.log(foldedInto(filed.joined));
    for (const line of suggestionLines(beside, said)) console.log(line);
    const { documentId, issueId } = filed.joined;
    return sayLanded(await commentLanded(documentId, filed.answer, issueId));
  }
  if (filed.answer?.refused) lost("this filing", filed.answer.refused);
  keepOnFailure(null);
  console.log(`The note is a new ${KIND} on ${PROJECT}.`);
  console.log(filedAs(filed.answer, filed.ranked.said));
  console.log(JSON.stringify(inFlowWords(filed.answer), null, 2));
  const offered = keysOffered(filed.shape.keys, withKeys);
  if (offered) console.log(offered);
  for (const line of suggestionLines(beside, said)) console.log(line);
  return sayLanded(await issueLanded(filed.answer));
};
