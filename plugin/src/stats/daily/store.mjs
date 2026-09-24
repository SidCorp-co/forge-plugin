/* Where the daily reports live and what may be written into one: the directory, the held days, the
   writer's mark, the content each page carries for the index to read back, and the masking every
   string passes before it reaches a file a person may forward — docs/cli/stats.md. */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { configDir, configPath, readJson } from "../../resolve/config.mjs";
import { masked } from "../../hooks/log/scrub.mjs";
import { fail } from "../../resolve/settings.mjs";

/** The device key naming the directory, read beside the account's own pair. */
const REPORTS_KEY = "reports";

const PAGE = /^(\d{4}-\d{2}-\d{2})\.html$/u;
export const INDEX = "index.html";

/** The directory the reports are written to and where that was read from, or why it cannot be
 *  used. Read at the call, so a home the caller sets reaches it; a value that is not an absolute
 *  directory is refused with the file it was read from, since a relative one would land wherever the
 *  next session happens to stand. */
export const reportsWhere = () => {
  const given = (readJson(configPath()) ?? {})[REPORTS_KEY];
  const fallback = join(configDir("forge"), "reports");
  if (given === undefined) return { dir: fallback, from: "the plugin's default, beside this device's config.json" };
  if (typeof given !== "string" || !isAbsolute(given)) {
    return { refused: `stats daily: \`${REPORTS_KEY}\` in ${configPath()} is an absolute directory, not `
      + `\`${JSON.stringify(given)}\`. Set it to one, or remove the key to write under ${fallback}.` };
  }
  return { dir: given.replace(/\/+$/u, "") || "/", from: configPath() };
};

export const reportsDir = () => {
  const where = reportsWhere();
  if (where.refused) fail(where.refused);
  return where;
};

export const pagePath = (dir, day) => join(dir, `${day}.html`);
export const markPath = (dir, day) => join(dir, `${day}.writing`);

/** Every day a page is held for, newest first. */
export const heldDays = (dir) => {
  try {
    return readdirSync(dir).map((name) => PAGE.exec(name)?.[1]).filter(Boolean).sort().reverse();
  } catch {
    return [];
  }
};

/* The content rides in its own page as data, so the index reads back what the page says rather than
   a second file that could disagree with it. `<` is escaped so no string inside can close the block. */
const BLOCK = /<script type="application\/json" id="forge-daily">([\s\S]*?)<\/script>/u;
export const contentBlock = (content) =>
  `<script type="application/json" id="forge-daily">${JSON.stringify(content).replaceAll("<", "\\u003c")}</script>`;

export const contentOf = (html) => {
  const held = BLOCK.exec(html)?.[1];
  if (!held) return null;
  try {
    return JSON.parse(held);
  } catch {
    return null;
  }
};

export const readPage = (dir, day) => {
  try {
    return readFileSync(pagePath(dir, day), "utf8");
  } catch {
    return null;
  }
};

export const writePage = (dir, name, html) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), html);
  return join(dir, name);
};

/** Whether a writer holds the day: its mark names a process still running. A mark whose process
 *  died is removed here, so a writer killed mid-way costs one start and not every start after it. */
export const writerHolds = (dir, day) => {
  const path = markPath(dir, day);
  if (!existsSync(path)) return false;
  const pid = Number(readFileSync(path, "utf8").trim());
  try {
    if (Number.isInteger(pid) && pid > 0) {
      process.kill(pid, 0);
      return true;
    }
  } catch {
    /* no such process: the mark outlived its writer */
  }
  rmSync(path, { force: true });
  return false;
};

/** The mark removed where it names this process, so a writer never clears another writer's mark. */
export const clearMark = (dir, day, pid = process.pid) => {
  try {
    if (Number(readFileSync(markPath(dir, day), "utf8").trim()) === pid) rmSync(markPath(dir, day), { force: true });
  } catch {
    /* no mark to clear */
  }
};

/* An absolute path, stopped at whitespace, a quote or a bracket: over-masking is the safe direction. */
const PATH = /(?<![\w.~-])\/[^\s"'`<>()[\]{}|;,]+/gu;

/** A string as it may appear on a page: credentials masked by the refusal log's own mask, and every
 *  absolute path outside the directories named here cut to an ellipsis. */
const shown = (text, allowed) => masked(text).replace(PATH, (path) =>
  (allowed.some((root) => path === root || path.startsWith(`${root}/`)) ? path : "…"));

/** Every string in a value passed through `shown`, at every depth. */
export const shownDeep = (value, allowed) => {
  if (typeof value === "string") return shown(value, allowed);
  if (Array.isArray(value)) return value.map((one) => shownDeep(one, allowed));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, shownDeep(one, allowed)]));
  }
  return value;
};
