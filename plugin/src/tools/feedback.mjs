/* A defect in this plugin is an issue on the plugin's own project from the moment it is met, and
   nothing goes to disk. What that replaced and why each rule below: docs/cli/feedback.md. */
import { bodyFrom } from "../resolve/payload.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { fail, keepOnFailure, projectScope, translateScope, useProject } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { agentOf } from "../flow/lease.mjs";
import { hereCopy, pluginCopy } from "./plugin-copy.mjs";
import { MAX_LIMIT, listIssues, rowsOf, shortOf } from "../tracker/issues.mjs";
import { postComment } from "../tracker/comments.mjs";
import { filedAs, inFlowWords, liveTitles, openTitles, rankOf, shapeOf, shapeRefusal,
  trackerFields } from "../tracker/issue-shape.mjs";
import { foldFiling, foldedInto, neighboursOf, suggestionLines } from "../tracker/neighbours.mjs";
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
  "  --new       file it even where the mark would have folded it onto a neighbour, and say which",
  "",
  "Past the title, every note is measured against what is already open on that project the way a",
  "filing is: `forge new -h` carries the two questions, the floor and the fold, and this verb prints",
  "the same block under its result. A note marked `Size: fix.` lands on the nearest of the",
  "neighbours that name its place, as a finding rather than as an issue of its own.",
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

/* Case and spacing, and nothing else: this verb ROUTES on a match, so the measure has to be one a
   caller can predict. */
const plain = (title) => String(title ?? "").toLowerCase().replace(/\s+/gu, " ").trim();

/* The open issues the filing route reads, spent again here: what is open beside the note is asked
   of that one reading rather than of a second call. A search for the title is asked only where the
   walk fell short, since a whole reading already holds every issue such a search could name. */
const openUnder = async (title) => {
  const { live, read } = await liveTitles();
  const found = read.whole ? [] : openTitles(rowsOf(await listIssues({ search: title }, MAX_LIMIT)));
  const byKey = new Map([...live, ...found].map((one) => [one.issueId, one]));
  return {
    live,
    read,
    held: [...byKey.values()].find((one) => plain(one.title) === plain(title)) ?? null,
  };
};

const lost = (what, refused) => fail(`${PROJECT} refused ${what}: ${refused}`);

/** `forge feedback <file.md|@file|-> --title T`. */
export const feedback = async (argv) => {
  if (wantsHelp(argv)) return console.log(USAGE);
  const [path, ...rest] = argv;
  if (!path) fail(usageOf("feedback"));
  const { title, new: fresh, ...extra } = flags(rest, "feedback", ["--new"]);
  if (!title) fail("A note needs --title: one line saying what is true once it is fixed.");
  const unknown = Object.keys(extra);
  if (unknown.length) {
    fail(`feedback takes --title and --new and nothing else; ${unknown.map((one) => `--${one}`).join(", ")}`
      + ` names no flag of it. The kind is always ${KIND}, the project is always ${PROJECT}, and Where is`
      + " filled in.");
  }
  /* Registered the instant there is one to lose, a body from stdin being held nowhere else. What
     it claims, and the one refusal above this line that it cannot reach: docs/cli/feedback.md. */
  const written = await bodyFrom(path);
  const keep = (text) => keepOnFailure(`Your note, so that nothing here loses it:\n\n${text}`);
  keep(written);
  const body = `${written.replace(/\s*$/u, "")}\n\n${whereSection()}\n`;
  keep(body);
  /* Body-only: the tracker-reading refusal refuses a near-duplicate, and this takes one as a comment. */
  const shape = shapeOf({ title, body, kind: KIND }, { everySection: true });
  const refusal = shapeRefusal(shape);
  if (refusal) fail(refusal);
  /* Before the first call: everything below reaches the plugin's project, in its language. */
  useProject({ slug: PROJECT, from: "the CLI, for feedback on this plugin" });
  const { live, read, held } = await openUnder(title);
  /* Said whether the note lands as a comment or as a filing: what the near-duplicate check could
     not see is the same either way, and it was silent on both routes until now. */
  const short = shortOf(read, "the set this note was checked against");
  if (short) {
    console.error(`warning: ${short}\nA note whose twin fell outside what was reached is filed as a`
      + " second issue rather than folded onto it.");
  }
  if (held) {
    const answer = await postComment(held.documentId, `## ${title}\n\n${body}`, null, true);
    if (answer?.refused) lost(`a comment on ${held.issueId}`, answer.refused);
    keepOnFailure(null);
    console.log(`${held.issueId} is open on ${PROJECT} under this title, so the note is a comment on it`
      + " rather than a second issue. No lease was taken.");
    return undefined;
  }
  /* Asked second: a note whose title is already open belongs there whatever the memory says. */
  const beside = await neighboursOf(shape, live);
  const { joined, answer: comment, said } = await foldFiling(beside, { title, body, fresh, soft: true });
  if (joined) {
    if (comment?.refused) lost(`a comment on ${joined.issueId}`, comment.refused);
    keepOnFailure(null);
    console.log(`No open issue on ${PROJECT} carries this title, and ${foldedInto(joined)}`);
    for (const line of suggestionLines(beside, said)) console.log(line);
    return undefined;
  }
  const ranked = await rankOf();
  if (ranked.refusal) fail(ranked.refusal);
  const data = { title, description: body, status: "open", priority: ranked.value, ...trackerFields({ kind: KIND }) };
  const answer = await write("forge_issues", { action: "create", data }, undefined, true);
  if (answer?.refused) lost("this filing", answer.refused);
  keepOnFailure(null);
  console.log(`No open issue on ${PROJECT} carries this title, so the note is a new ${KIND} there.`);
  console.log(filedAs(answer, ranked.said));
  console.log(JSON.stringify(inFlowWords(answer), null, 2));
  for (const line of suggestionLines(beside, said)) console.log(line);
  return undefined;
};
