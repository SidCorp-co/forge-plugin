/* `forge stats daily` — one page a day of what the harness cost on this device and what landed in
   it, written with no person asking. Why every figure is another reader's, and why a session start
   is the schedule: docs/cli/stats.md. */
import { existsSync } from "node:fs";

import { dayIn, dayRefusal, heldRange, yesterday } from "./day.mjs";
import { contentOf, corporaOf, landingsFrom, readingOf } from "./gather.mjs";
import { backlogMatcher } from "./opportunities.mjs";
import { judgeDay, unjudged } from "./judge.mjs";
import { pageOf } from "./page.mjs";
import { printCurrent, writeCurrent, writerFrom } from "../report/current.mjs";
import { projectsOn, registered } from "./projects.mjs";
import { clearMark, contentOf as heldContentOf, pagePath, readPage, reportRoles, reportsDir, shownDeep, writePage } from "./store.mjs";
import { decisionsSaid, summaryOf } from "./summary.mjs";
import { gateway } from "../../resolve/machine/stores.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags } from "../../resolve/flags.mjs";

const VERB = "stats daily";

export const DAILY_USAGE = [
  "Usage: forge stats daily [--day YYYY-MM-DD] [--open] [--json] [--force] | --current [--open] [--json]",
  "One page for a calendar day on this device: what the issue-flow runs, landings and consults of",
  "every project registered here cost, where they met friction, which plugin releases landed, and",
  "where rounds could be saved, each figure beside the day before and the seven days before. It",
  "reads, and writes that day's page and then the current report, nothing else. Where they are",
  "written: the `reports` key of this device's config.json, or `reports` beside it. A project whose",
  "`report` key is `daily` has its session starts write yesterday's page when it is missing.",
  "",
  "Where `reports` is a table, `dir` is that directory and `roles` names the gateway model id each",
  "stage of the page's reading runs on: `explore` proposes findings from one section's figures, `review`",
  "keeps the ones those figures support, both once per section, and `judge` writes, once per page, the",
  "Decisions block at the top (at most five, each citing a figure by its key and the command that acts",
  "on it) and one line per section. Every figure and issue key a reading cites is checked against the",
  "page, and one citing anything else is dropped and counted. The reading is written with the page and",
  "read back after; --force reads again. A role left unset skips its stage, and a stage that cannot run",
  "leaves the figures written and says why. The effort rides the model id: nothing else carries it.",
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
  "  --json            print the day's content as one object and write nothing; the reading is the held",
  "                    page's, and no model is asked",
  "  --force           rewrite a day already written, reading it with the models again",
  "  --current         the current report over every day held, in place of one day's page",
].join("\n");

const NOT_WRITTEN = "Nothing was written.";

const refusedIfDue = (given, reading) => {
  const why = dayRefusal(given, heldRange(reading.first));
  if (why) fail(`${why} ${NOT_WRITTEN}`);
};

/* The models' reading of a page about to be written; a fault in it costs the reading, never the figures. */
const modelsReading = async (content) => {
  try {
    return await judgeDay(content, { roles: reportRoles(), gateway: gateway(), disabled: process.env.FORGE_CODEX_DISABLE === "1" });
  } catch (error) {
    return unjudged(`the page's reading stopped: ${String(error.message).split("\n")[0]}`);
  }
};

/* The models' reading a held page carries, or null for one written before it or by hand. */
const heldReading = (dir, day) => heldContentOf(readPage(dir, day) ?? "")?.judgement ?? null;

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
      } else console.log([...decisionsSaid(heldReading(reports.dir, day)), heldSaid(path, day)].join("\n"));
      return null;
    }
    const found = projectsOn();
    /* The page reads the landings from its trend's first day, as it always has; the current report,
       written after it, reads every landing, so the corpora are read once with no bound and the
       page's reading is cut from them. */
    const since = landingsFrom(day);
    const whole = await corporaOf(found.read, json ? since : null);
    const reading = readingOf({ projects: whole.map((one) => ({ ...one, passes: one.passes.filter((pass) => pass.at >= since) })) });
    refusedIfDue(day, reading);
    const allowed = [reports.dir, ...found.read.map((one) => one.checkout)];
    const content = shownDeep(await contentOf(reading, day, {
      unread: found.unread, match: await backlogMatcher(registered()),
    }), allowed);
    if (json) {
      const kept = held ? heldReading(reports.dir, day) : null;
      return console.log(JSON.stringify({ ...content, judgement: kept ?? unjudged(held
        ? `the page held for ${day} carries no reading; \`forge stats daily --day ${day} --force\` reads it`
        : `no page is written for ${day}; \`forge stats daily --day ${day}\` writes and reads it`) }, null, 2));
    }
    content.judgement = shownDeep(await modelsReading(content), allowed);
    writePage(reports.dir, `${day}.html`, pageOf(content));
    const current = await writeCurrent(reports.dir, writerFrom(readingOf({ projects: whole, entries: reading.entries, hooks: reading.hooks }), found));
    if (open) return console.log(path);
    console.log([...(content.judgement.judged ? [] : summaryOf(content)), ...decisionsSaid(content.judgement), "",
      `${held ? `Rewrote the page held for ${day}` : `Wrote ${day}`}: ${path}`,
      current ? `The current report, listing every day held: ${current.path}`
        : "A writer holds the current report; it writes once more before it exits, listing this day.",
      `Reports directory from ${reports.from}.`].join("\n"));
    return null;
  } finally {
    clearMark(reports.dir, day);
  }
};
