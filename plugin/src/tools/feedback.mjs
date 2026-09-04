/* A defect in this plugin is an issue on the plugin's own project from the moment it is met, and
   nothing goes to disk. What that replaced and why each rule below: docs/cli/feedback.md. */
import { bodyFrom } from "../resolve/payload.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { fail, keepOnFailure, projectScope, translateScope, useProject } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { agentOf } from "../flow/lease.mjs";
import { hereCopy, pluginCopy } from "./plugin-copy.mjs";
import { MAX_LIMIT, listIssues, rowsOf } from "../tracker/issues.mjs";
import { postComment } from "../tracker/comments.mjs";
import { inFlowWords, openTitles, shapeOf, shapeRefusal, trackerFields } from "../tracker/issue-shape.mjs";
import { write } from "../tracker/rpc.mjs";

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
  "  --title T   what is true once it is fixed, one line. A title already open on that project",
  "              takes the note as a comment instead of filing a second issue.",
  "",
  `The body is read against the ${KIND} shape: What happened, Outcome, Rules and Out of scope are`,
  "required, and `forge new -h` prints what each wants. Where is filled in for you — the plugin",
  "version, the copy that answered, the project you called from and the agent — so none of it is",
  "typed, and a body carrying its own Where heading gets this one after it.",
  "",
  "No lease is taken and none is renewed. This is the finder's route, like `forge new --into`:",
  "an issue you do not hold is commented on without claiming it.",
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

/* Case and spacing, and nothing else: this verb ROUTES on a match, so the measure has to be one a
   caller can predict. */
const plain = (title) => String(title ?? "").toLowerCase().replace(/\s+/gu, " ").trim();

/* The page and a search both, the listing offering no cursor (ISS-17 owes it). */
const openOnProject = async (title) => {
  const page = openTitles(rowsOf(await listIssues({}, MAX_LIMIT)));
  const found = openTitles(rowsOf(await listIssues({ search: title }, MAX_LIMIT)));
  const byKey = new Map([...page, ...found].map((one) => [one.issueId, one]));
  return [...byKey.values()];
};

const lost = (what, refused) => fail(`${PROJECT} refused ${what}: ${refused}`);

/** `forge feedback <file.md|@file|-> --title T`. */
export const feedback = async (argv) => {
  if (wantsHelp(argv)) return console.log(USAGE);
  const [path, ...rest] = argv;
  if (!path) fail(usageOf("feedback"));
  const { title, ...extra } = flags(rest, "feedback");
  if (!title) fail("A note needs --title: one line saying what is true once it is fixed.");
  const unknown = Object.keys(extra);
  if (unknown.length) {
    fail(`feedback takes --title and nothing else; ${unknown.map((one) => `--${one}`).join(", ")} names`
      + ` no flag of it. The kind is always ${KIND}, the project is always ${PROJECT}, and Where is filled in.`);
  }
  /* Registered the instant there is one to lose, a body from stdin being held nowhere else. What
     it claims, and the one refusal above this line that it cannot reach: docs/cli/feedback.md. */
  const written = await bodyFrom(path);
  const keep = (text) => keepOnFailure(`Your note, so that nothing here loses it:\n\n${text}`);
  keep(written);
  const body = `${written.replace(/\s*$/u, "")}\n\n${whereSection()}\n`;
  keep(body);
  /* Body-only: the tracker-reading refusal refuses a near-duplicate, and this takes one as a comment. */
  const refusal = shapeRefusal(shapeOf({ title, body, kind: KIND }, { everySection: true }));
  if (refusal) fail(refusal);
  /* Before the first call: everything below reaches the plugin's project, in its language. */
  useProject({ slug: PROJECT, from: "the CLI, for feedback on this plugin" });
  const held = (await openOnProject(title)).find((one) => plain(one.title) === plain(title));
  if (held) {
    const answer = await postComment(held.documentId, `## ${title}\n\n${body}`, null, true);
    if (answer?.refused) lost(`a comment on ${held.issueId}`, answer.refused);
    keepOnFailure(null);
    console.log(`${held.issueId} is open on ${PROJECT} under this title, so the note is a comment on it`
      + " rather than a second issue. No lease was taken.");
    return undefined;
  }
  const data = { title, description: body, status: "open", ...trackerFields({ kind: KIND }) };
  const answer = await write("forge_issues", { action: "create", data }, undefined, true);
  if (answer?.refused) lost("this filing", answer.refused);
  keepOnFailure(null);
  console.log(`No open issue on ${PROJECT} carries this title, so the note is a new ${KIND} there.`);
  console.log(JSON.stringify(inFlowWords(answer), null, 2));
  return undefined;
};
