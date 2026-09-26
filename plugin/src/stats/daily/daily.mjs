/* `forge stats daily` — one page a day of what the harness cost on this device and what landed in
   it, written with no person asking. Why every figure is another reader's, and why a session start
   is the schedule: docs/cli/stats.md. */
import { existsSync } from "node:fs";

import { dayIn, dayRefusal, heldRange, yesterday } from "./day.mjs";
import { contentOf, corporaOf, landingsFrom, readingOf } from "./gather.mjs";
import { backlogMatcher } from "./opportunities.mjs";
import { judgeDay, unjudged } from "./reading/judge.mjs";
import { pageOf } from "./page/page.mjs";
import { printCurrent, writeCurrent, writerFrom } from "../report/current.mjs";
import { projectsOn, registered } from "./projects.mjs";
import { clearMark, contentOf as heldContentOf, pagePath, readPage, reportRoles, reportsDir, shownDeep, writePage } from "./store.mjs";
import { decisionsSaid } from "./page/summary.mjs";
import { scorecardLines, scorecardOf } from "./scorecard.mjs";
import { closesRead } from "./closed.mjs";
import { gateway } from "../../resolve/machine/stores.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags } from "../../resolve/flags.mjs";

const VERB = "stats daily";

export const DAILY_USAGE = [
  "Usage: forge stats daily [--day YYYY-MM-DD] [--open] [--json] [--force] | --current [--open] [--json]",
  "One page for a calendar day on this device. It opens with a scorecard, one tile per goal metric:",
  "the day against the median of the seven days before, marked better or worse. Below, folded until",
  "opened: what the runs, landings and consults of every project registered here cost, their friction",
  "and the plugin releases. It reads, and writes that day's page and then the current report,",
  "nothing else. Where: the `reports` key of this device's config.json, or `reports` beside it.",
  "A project whose `report` key is `daily` has its session starts write yesterday's page when missing.",
  "",
  "As a table, `reports` holds that directory as `dir` and, as `roles`, the gateway model id for each",
  "stage of the page's reading: `explore` and `review` once per section, `judge` once per page, writing",
  "the Decisions under the scorecard and a line per section. A citation the page does not hold is",
  "dropped and counted. The reading is kept with the page; --force redoes it. An unset role is skipped.",
  "",
  "`forge stats daily --current` writes the current report instead, as index.html beside the pages:",
  "runs, minutes, calls, refusals, consults, landings and releases each as a series over every day",
  "held whose last point is today so far; the causes behind the cost, one row per root cause, as",
  "new, recurring and fixed, with the gain each fix realized or fixing each would project; and every",
  "dated page. That report states figures and judges none: `forge stats eval` and the harness-eval skill do",
  "that. A project whose `report` is `daily` rewrites it at each session start and release reading",
  "its `reportOn` names; the score and its windows are the `report` table of that config.json.",
  "",
  "  --day YYYY-MM-DD  the day, in this device's zone; yesterday unless you say otherwise",
  "  --open            print the path of the page and nothing else, for a command that opens it",
  "  --json            print the day's content as one object and write nothing; a page held with its",
  "                    reading is printed as it was written, and no model is asked",
  "  --force           rewrite a day already written, reading it with the models again",
  "  --current         the current report over every day held, in place of one day's page",
].join("\n");

const NOT_WRITTEN = "Nothing was written.";

const refusedIfDue = (given, reading) => {
  const why = dayRefusal(given, heldRange(reading.first));
  if (why) fail(`${why} ${NOT_WRITTEN}`);
};

/* The models' reading of a page about to be written; a fault in it costs the reading, never the figures. */
const modelsReading = async (content, backlog) => {
  try {
    return await judgeDay(content, { roles: reportRoles(), gateway: gateway(), backlog, disabled: process.env.FORGE_CODEX_DISABLE === "1" });
  } catch (error) {
    return unjudged(`the page's reading stopped: ${String(error.message).split("\n")[0]}`);
  }
};

/* The content a held page carries, or null for one written by hand. */
const heldContent = (dir, day) => heldContentOf(readPage(dir, day) ?? "");

const heldSaid = (path, day) => `${path}\n${day} is already written and was left as it is; `
  + `\`forge stats daily --day ${day} --force\` rewrites it.`;

export const printDaily = async (rest) => {
  const { day: asked, open, json, force, current } = flags(rest, VERB, ["--open", "--json", "--force", "--current"],
    { usage: DAILY_USAGE });
  if (current) {
    /* The current report is every day held and is always rewritten, so neither flag has a use there. */
    const idle = [asked !== undefined && "--day", force && "--force"].filter(Boolean);
    if (idle.length) {
      fail(`stats daily: --current writes the report over every day held and always rewrites it, so it takes no `
        + `${idle.join(" and ")}. ${NOT_WRITTEN} \`forge stats daily --current\` writes it.`);
    }
    return printCurrent({ open, json });
  }
  const reports = reportsDir();
  const day = asked ?? yesterday();
  const path = pagePath(reports.dir, day);
  const held = existsSync(path);
  try {
    /* A held day is answered before anything is read: it is the one answer that costs no corpus. */
    if (held && !force && !json && dayIn(day)) {
      if (open) {
        console.log(path);
        console.error(heldSaid(path, day).split("\n")[1]);
      } else {
        const kept = heldContent(reports.dir, day);
        console.log([...scorecardLines(kept?.scorecard), ...decisionsSaid(kept?.judgement ?? null), heldSaid(path, day)].join("\n"));
      }
      return null;
    }
    /* A held reading is printed with the content it read, never beside figures gathered since: a key
       it cites names whatever sits there now, and an opportunity's rank is not its identity. */
    const kept = json && held ? heldContent(reports.dir, day) : null;
    if (kept?.judgement) return console.log(JSON.stringify(kept, null, 2));
    const found = projectsOn();
    /* The page reads the landings from its trend's first day, as it always has; the current report,
       written after it, reads every landing, so the corpora are read once with no bound and the
       page's reading is cut from them. */
    const since = landingsFrom(day);
    const whole = await corporaOf(found.read, json ? since : null);
    const reading = readingOf({ projects: whole.map((one) => ({ ...one, passes: one.passes.filter((pass) => pass.at >= since) })) });
    refusedIfDue(day, reading);
    const allowed = [reports.dir, ...found.read.map((one) => one.checkout)];
    /* Before the backlog is asked, which aims the tracker at the plugin's own project for good. */
    reading.closed = await closesRead(registered(), day, { runs: reading.projects });
    const backlog = await backlogMatcher(registered());
    const content = shownDeep({ ...await contentOf(reading, day, {
      unread: found.unread, match: backlog,
    }), scorecard: scorecardOf(reading, day) }, allowed);
    if (json) {
      return console.log(JSON.stringify({ ...content, judgement: unjudged(held
        ? `the page held for ${day} carries no reading; \`forge stats daily --day ${day} --force\` reads it`
        : `no page is written for ${day}; \`forge stats daily --day ${day}\` writes and reads it`) }, null, 2));
    }
    content.judgement = shownDeep(await modelsReading(content, backlog), allowed);
    writePage(reports.dir, `${day}.html`, pageOf(content));
    const current = await writeCurrent(reports.dir, writerFrom(readingOf({ projects: whole, entries: reading.entries, hooks: reading.hooks }), found));
    if (open) return console.log(path);
    console.log([...scorecardLines(content.scorecard), ...decisionsSaid(content.judgement), "",
      `${held ? `Rewrote the page held for ${day}` : `Wrote ${day}`}: ${path}`,
      current ? `The current report, listing every day held: ${current.path}`
        : "A writer holds the current report; it writes once more before it exits, listing this day.",
      `Reports directory from ${reports.from}.`].join("\n"));
    return null;
  } finally {
    clearMark(reports.dir, day);
  }
};
