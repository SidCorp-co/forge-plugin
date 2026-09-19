/* The volume of landed change that earns a reading of the whole of it, read off the project the CLI
   stands in — here and not in the release script, which does not ship (ISS-1883). What a project
   declares, what each refusal protects and what its silence means: README.md's Configuration. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

import { fail, FROM_PROJECT, projectReview } from "../resolve/settings.mjs";
import { everyIssue, shortOf } from "../tracker/issues.mjs";

export const REVIEWED = "refs/forge/reviewed";

const SHORT = 7;
const at = (sha) => String(sha ?? "").slice(0, SHORT);

export const readingTitle = (from, to) =>
  `The batch ${at(from)}..${at(to)} is read once as a whole by a run that wrote none of it, and the `
  + `mark moves`;

/** A title holds this debt where the range it names opens at the mark: one that ends there is the
 *  previous batch, read already, and answering with it leaves this range no row and no route to one. */
export const readingCovers = (title, from) => String(title ?? "").includes(`${at(from)}..`);

const NOT_A_READING = "dropped";
const UNREAD = "the search for the issue holding this mark's reading";

/** Held, none, or unread — an absence a page was cut off from is none, a dropped reading leaves the
 *  range an issue nobody reads, and soft keeps the rows a later page's refusal would throw away. */
export const readingFor = async (from) => {
  const read = await everyIssue({ search: at(from) }, { soft: true });
  const row = read.rows.find((one) => readingCovers(one.title, from) && one.status !== NOT_A_READING);
  if (row) return { key: row.issueId, status: row.status ?? null };
  const cut = read.refused ? String(read.refused) : shortOf(read, UNREAD);
  return cut ? { short: cut } : { key: null };
};

export const SHIPPED_PATHS = ["plugin/src", "plugin/hooks", "plugin/bin"];
export const SHIPPED_LINES = 1500;

const FROM_PLUGIN = "the plugin's default";

const sourced = (key, value) =>
  ({ value, from: projectReview()[key] === undefined ? FROM_PLUGIN : FROM_PROJECT });

/** An absent `review`, a null one and an empty one read alike, so the question is which key is set. */
export const reviewDeclared = () => {
  const given = projectReview();
  return given.lines !== undefined || given.paths !== undefined;
};

const linesRefusal = (given) => {
  if (given === undefined || (Number.isInteger(given) && given >= 1)) return null;
  return `\`review.lines\` in ${FROM_PROJECT} is a whole number of changed lines above zero, not `
    + `\`${JSON.stringify(given)}\`. Drop the key to take the ${SHIPPED_LINES} this plugin ships with.`;
};

const ESCAPES = (one) => isAbsolute(one) || one.startsWith("..") || one.includes(`${sep}..${sep}`);

const wrongShape = (given) => {
  if (!Array.isArray(given) || given.length === 0) return "a list of one or more paths";
  if (!given.every((one) => typeof one === "string" && one.trim() !== "")) return "paths that are non-empty strings";
  if (given.some(ESCAPES)) return "paths inside the repository, each relative to its root";
  return null;
};

const pathsRefusal = (given) => {
  const wrong = given === undefined ? null : wrongShape(given);
  return wrong && `\`review.paths\` in ${FROM_PROJECT} is ${wrong}, not \`${JSON.stringify(given)}\`. `
    + `Drop the key to count ${SHIPPED_PATHS.join(", ")}, which is this plugin's own layout and no `
    + `other repository's.`;
};

/** What this project file gets wrong here, or null. A report prints it as a finding and carries on with
 *  its other rows; the two readers below exit on the same text, a release step having nothing to carry
 *  on to. Present and malformed never falls back: the three above are this repository's own. */
export const reviewRefusalOf = (given) =>
  linesRefusal(given?.lines) || pathsRefusal(given?.paths) || null;

export const reviewRefusal = () => reviewRefusalOf(projectReview());

export const reviewLines = () => {
  const given = projectReview().lines;
  const wrong = linesRefusal(given);
  if (wrong) fail(wrong);
  return given === undefined ? SHIPPED_LINES : given;
};

export const reviewPaths = () => {
  const given = projectReview().paths;
  const wrong = pathsRefusal(given);
  if (wrong) fail(wrong);
  return given === undefined ? [...SHIPPED_PATHS] : [...given];
};

/* What a surface names beside a count: the declaration with each half's provenance, where each was
   read, and — printing a reckoning it does not spend — the refusal rather than an exit (ISS-1912). */
export const reviewSourced = () => ({ lines: sourced("lines", reviewLines()), paths: sourced("paths", reviewPaths()) });

export const whereFrom = ({ lines, paths }) => (lines.from === paths.from
  ? lines.from
  : `the volume ${lines.from}, the paths ${paths.from}`);

export const reviewReported = () => {
  const refusal = reviewRefusal();
  return refusal ? { refusal } : reviewSourced();
};

const gitOut = (argv, tree) => {
  const { status, stdout } = spawnSync("git", argv, { cwd: tree, encoding: "utf8" });
  return status === 0 ? String(stdout ?? "") : null;
};

export const reviewedAt = (tree) =>
  gitOut(["rev-parse", "--verify", "--quiet", REVIEWED], tree)?.trim() || null;

export const reviewCounts = ({ tree, from, paths }) => {
  const rows = (gitOut(["diff", "--numstat", `${from}..HEAD`, "--", ...paths], tree) ?? "")
    .split("\n").filter(Boolean);
  return {
    files: rows.length,
    lines: rows.reduce((sum, row) => sum + row.split("\t").slice(0, 2)
      .reduce((part, one) => part + (Number.parseInt(one, 10) || 0), 0), 0),
  };
};

/** Null where the project declared nothing, which spends no git call. `missing` answers whether this
 *  project can drive the trigger; a null `mark` is the state before the first reading, not a fault. */
export const reviewStanding = (tree) => {
  if (!reviewDeclared()) return null;
  const refusal = reviewRefusal();
  if (refusal) return { refusal };
  const lines = sourced("lines", reviewLines());
  const paths = sourced("paths", reviewPaths());
  const checkout = Boolean(tree) && existsSync(resolve(tree, ".git"));
  const missing = checkout ? paths.value.filter((one) => !existsSync(resolve(tree, one))) : paths.value;
  const standing = { lines, paths, missing, checkout, mark: null };
  if (!checkout || missing.length) return standing;
  const mark = reviewedAt(tree);
  if (!mark) return standing;
  const { files, lines: changed } = reviewCounts({ tree, from: mark, paths: paths.value });
  return { ...standing, mark, files, changed, owed: changed >= lines.value };
};
