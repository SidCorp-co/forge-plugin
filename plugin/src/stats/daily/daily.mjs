/* `forge stats daily` — one page a day of what the harness cost on this device and what landed in
   it, written with no person asking. Why every figure is another reader's, and why a session start
   is the schedule: docs/cli/stats.md. */
import { existsSync } from "node:fs";

import { dayIn, dayRefusal, heldRange, yesterday } from "./day.mjs";
import { contentOf, corporaOf, landingsFrom, readingOf } from "./gather.mjs";
import { backlogMatcher } from "./opportunities.mjs";
import { pageOf } from "./page.mjs";
import { printCurrent, writeCurrent, writerFrom } from "../report/current.mjs";
import { projectsOn, registered } from "./projects.mjs";
import { clearMark, pagePath, reportsDir, shownDeep, writePage } from "./store.mjs";
import { summaryOf } from "./summary.mjs";
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
  "`forge stats daily --current` writes the current report instead, as index.html beside the pages:",
  "runs, minutes, calls, refusals, consults, landings and releases each as a series over every day",
  "held whose last point is today so far; the causes behind the cost, one row per root cause, as",
  "new, recurring and fixed, with the gain each fix realized or fixing each would project; and every",
  "dated page. It states figures and judges none: `forge stats eval` and the harness-eval skill do",
  "that. A project whose `report` is `daily` rewrites it at each session start and release reading",
  "its `reportOn` names; the score and its windows are the `report` table of that config.json.",
  "",
  "  --day YYYY-MM-DD  the day, in this device's zone; yesterday unless you say otherwise",
  "  --open            print the path of the page and nothing else, for a command that opens it",
  "  --json            print the day's content as one object and write nothing",
  "  --force           rewrite a day already written, which is otherwise left as it is",
  "  --current         the current report over every day held, in place of one day's page",
].join("\n");

const NOT_WRITTEN = "Nothing was written.";

const refusedIfDue = (given, reading) => {
  const why = dayRefusal(given, heldRange(reading.first));
  if (why) fail(`${why} ${NOT_WRITTEN}`);
};

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
      } else console.log(heldSaid(path, day));
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
    if (json) return console.log(JSON.stringify(content, null, 2));
    writePage(reports.dir, `${day}.html`, pageOf(content));
    const current = await writeCurrent(reports.dir, writerFrom(readingOf({ projects: whole, entries: reading.entries, hooks: reading.hooks }), found));
    if (open) return console.log(path);
    console.log([...summaryOf(content), "",
      `${held ? `Rewrote the page held for ${day}` : `Wrote ${day}`}: ${path}`,
      current ? `The current report, listing every day held: ${current.path}`
        : "A writer holds the current report; it writes once more before it exits, listing this day.",
      `Reports directory from ${reports.from}.`].join("\n"));
    return null;
  } finally {
    clearMark(reports.dir, day);
  }
};
