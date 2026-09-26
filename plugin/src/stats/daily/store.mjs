/* Where the daily reports live and what may be written into one: the directory, the held days, the
   writer's mark, the content each page carries for the index to read back, and the masking every
   string passes before it reaches a file a person may forward — docs/cli/stats.md. */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { configDir, configPath, readJson } from "../../resolve/config.mjs";
import { masked } from "../../hooks/log/scrub.mjs";
import { fail } from "../../resolve/settings.mjs";

/** The device key naming the directory, read beside the account's own pair. */
const REPORTS_KEY = "reports";

const PAGE = /^(\d{4}-\d{2}-\d{2})\.html$/u;
export const INDEX = "index.html";

/* `reports` is the directory as a string, or a table carrying it as `dir` beside the models that read
   the page as `roles`: a config written before the table existed stays valid as it is. */
const TABLE_MEMBERS = ["dir", "roles"];
export const ROLES = ["explore", "review", "judge"];

const isTable = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const reportsGiven = () => (readJson(configPath()) ?? {})[REPORTS_KEY];

/** The directory the reports are written to and where that was read from, or why it cannot be
 *  used. Read at the call, so a home the caller sets reaches it; a value that is not an absolute
 *  directory is refused with the file it was read from, since a relative one would land wherever the
 *  next session happens to stand. */
export const reportsWhere = () => {
  const held = reportsGiven();
  const given = isTable(held) ? held.dir : held;
  const named = isTable(held) ? `${REPORTS_KEY}.dir` : REPORTS_KEY;
  const fallback = join(configDir("forge"), "reports");
  if (given === undefined) return { dir: fallback, from: "the plugin's default, beside this device's config.json" };
  if (typeof given !== "string" || !isAbsolute(given)) {
    return { refused: `stats daily: \`${named}\` in ${configPath()} is an absolute directory, not `
      + `\`${JSON.stringify(given)}\`. Set it to one, or remove the key to write under ${fallback}.` };
  }
  return { dir: given.replace(/\/+$/u, "") || "/", from: configPath() };
};

/** The model id each role of the page's reading names, and the file it was read from; a role left
 *  unset is absent, which skips its stage. A member nothing reads, or an id that is not a non-empty
 *  string, is refused by its full name, since a value read and dropped reads as a stage that ran. */
export const reportRoles = () => {
  const held = reportsGiven();
  if (!isTable(held)) return { roles: {}, from: configPath() };
  const stranger = Object.keys(held).find((key) => !TABLE_MEMBERS.includes(key));
  const refused = (key, what) => ({ refused: `\`${REPORTS_KEY}.${key}\` in ${configPath()} is ${what}. Nothing read the `
    + "page with a model; the figures were written." });
  if (stranger) return refused(stranger, `no member this report reads: it reads ${TABLE_MEMBERS.join(" and ")}. Remove it`);
  if (held.roles === undefined) return { roles: {}, from: configPath() };
  if (!isTable(held.roles)) return refused("roles", `a table naming a model id for ${ROLES.join(", ")}, not \`${JSON.stringify(held.roles)}\``);
  const other = Object.keys(held.roles).find((key) => !ROLES.includes(key));
  if (other) return refused(`roles.${other}`, `no role this report runs: its roles are ${ROLES.join(", ")}. Remove it`);
  const wrong = ROLES.find((role) => held.roles[role] !== undefined
    && (typeof held.roles[role] !== "string" || !held.roles[role].trim()));
  if (wrong) return refused(`roles.${wrong}`, `a model id the gateway serves, not \`${JSON.stringify(held.roles[wrong])}\``);
  return { roles: Object.fromEntries(ROLES.filter((role) => held.roles[role] !== undefined)
    .map((role) => [role, held.roles[role].trim()])), from: configPath() };
};

export const reportsDir = () => {
  const where = reportsWhere();
  if (where.refused) fail(where.refused);
  return where;
};

export const pagePath = (dir, day) => join(dir, `${day}.html`);
export const markPath = (dir, day) => join(dir, `${day}.writing`);

/** The name the current report's writer holds its mark under, beside the days' own. */
export const CURRENT = "current";
/** Left by a writer that found the current report held, and read by the holder before it lets go. */
export const againPath = (dir) => join(dir, `${CURRENT}.again`);

/** The mark taken under a process's id, or false where another holds it: taken whole or not at all,
 *  so two writers starting in one instant cannot both hold it. */
export const takeMark = (dir, name, pid = process.pid) => {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(markPath(dir, name), `${pid}\n`, { flag: "wx" });
    return true;
  } catch {
    return false;
  }
};

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

/** A page written whole or not at all: a held page is what stops the next writer, so one cut short
 *  by a killed process would stand in for a report forever, and a failed rewrite would take the good
 *  one with it. */
export const writePage = (dir, name, html) => {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, html);
    renameSync(temporary, path);
  } finally {
    try {
      rmSync(temporary, { force: true });
    } catch {
      /* not a file of this writer's: left where it stands */
    }
  }
  return path;
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
/* Judged resolved, so a `..` cannot walk a path that starts inside a root out of it. */
const shown = (text, allowed) => masked(text).replace(PATH, (path) => {
  const whole = resolve(path);
  return allowed.some((root) => whole === resolve(root) || whole.startsWith(`${resolve(root)}/`)) ? path : "…";
});

/** Every string in a value passed through `shown`, at every depth. */
export const shownDeep = (value, allowed) => {
  if (typeof value === "string") return shown(value, allowed);
  if (Array.isArray(value)) return value.map((one) => shownDeep(one, allowed));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, shownDeep(one, allowed)]));
  }
  return value;
};
