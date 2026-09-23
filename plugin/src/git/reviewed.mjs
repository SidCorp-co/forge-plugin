/* The volume of landed change that earns a reading of the whole of it, read off the project the CLI
   stands in — here and not in the release script, which does not ship (ISS-1883). What a project
   declares, what each refusal protects and what its silence means: README.md's Configuration. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

import { fail, fromProject, projectReview } from "../resolve/settings.mjs";
import { everyIssue, shortOf } from "../tracker/issues.mjs";

export const REVIEWED = "refs/forge/reviewed";

const SHORT = 7;
const at = (sha) => String(sha ?? "").slice(0, SHORT);

export const readingTitle = (from, to) =>
  `The batch ${at(from)}..${at(to)} is read once as a whole by a run that wrote none of it, and the `
  + `mark moves`;

/** A title holds this debt where the range it names opens at the mark: one that ends there is the
 *  previous batch, read already, and answering with it leaves this range no row and no route to one. */
const readingCovers = (title, from) => String(title ?? "").includes(`${at(from)}..`);

const NOT_A_READING = "dropped";
const UNREAD = "the search for the issue holding this mark's reading";

const filedAs = (row) => Number.parseInt(String(row.issueId ?? "").replace(/^\D+/u, ""), 10);
const FIRST_FILED = (one, two) => (filedAs(one) || Infinity) - (filedAs(two) || Infinity);

/** Held, none, or unread — an absence a page was cut off from is none, a dropped reading leaves the
 *  range an issue nobody reads, and soft keeps the rows a later page's refusal would throw away. Of
 *  two rows for one mark the first filed holds it, whatever order the page came in, so every ship
 *  that reads both names the same one, and the second is the one its own filer drops; `cut` says a
 *  row was found over a read that could not rule an earlier one out, and `again` reads past this
 *  process's own earlier walk (ISS-133). */
export const readingFor = async (from, { again = false } = {}) => {
  const read = await everyIssue({ search: at(from) }, { soft: true }, { again });
  const [row] = read.rows.filter((one) => readingCovers(one.title, from) && one.status !== NOT_A_READING)
    .sort(FIRST_FILED);
  const cut = read.refused ? String(read.refused) : shortOf(read, UNREAD);
  if (row) return { key: row.issueId, status: row.status ?? null, ...(cut ? { cut } : {}) };
  return cut ? { short: cut } : { key: null };
};

export const SHIPPED_PATHS = ["plugin/src", "plugin/hooks", "plugin/bin"];
export const SHIPPED_LINES = 1500;

const FROM_PLUGIN = "the plugin's default";

const sourced = (key, value) =>
  ({ value, from: projectReview()[key] === undefined ? FROM_PLUGIN : fromProject() });

/** An absent `review`, a null one and an empty one read alike, so the question is which key is set. */
const reviewDeclared = () => {
  const given = projectReview();
  return given.lines !== undefined || given.paths !== undefined;
};

const linesRefusal = (given) => {
  if (given === undefined || (Number.isInteger(given) && given >= 1)) return null;
  return `\`review.lines\` in ${fromProject()} is a whole number of changed lines above zero, not `
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
  return wrong && `\`review.paths\` in ${fromProject()} is ${wrong}, not \`${JSON.stringify(given)}\`. `
    + `Drop the key to count ${SHIPPED_PATHS.join(", ")}, which is this plugin's own layout and no `
    + `other repository's.`;
};

/** What this project file gets wrong here, or null. A report prints it as a finding and carries on with
 *  its other rows; the two readers below exit on the same text, a release step having nothing to carry
 *  on to. Present and malformed never falls back: the three above are this repository's own. */
export const reviewRefusalOf = (given) =>
  linesRefusal(given?.lines) || pathsRefusal(given?.paths) || null;

const reviewRefusal = () => reviewRefusalOf(projectReview());

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

const SET_PATHS = "forge doctor --set project.review.paths=<paths>";

export const checkoutOf = (tree) =>
  (tree ? gitOut(["rev-parse", "--show-toplevel"], tree)?.trim() || null : null);

const uncounted = (tree, paths) => {
  const root = checkoutOf(tree);
  return { checkout: Boolean(root), missing: root ? paths.filter((one) => !existsSync(resolve(root, one))) : [...paths] };
};

const cannotCount = ({ checkout, missing, paths }) => {
  if (!missing.length) return null;
  const named = missing.join(", ");
  const layout = paths.from === fromProject() ? ""
    : `. ${SHIPPED_PATHS.join(", ")} is this plugin's own layout, and no claim about this repository`;
  if (!checkout) {
    return `a review volume is declared and this directory stands in no checkout, so ${named} can `
      + `never be counted and no reading is ever owed. Count from inside the checkout, or declare `
      + `the paths one holds: ${SET_PATHS}${layout}`;
  }
  return `${named} ${missing.length > 1 ? "are counted paths" : "is a counted path"} this repository `
    + `does not hold, so nothing here can count towards the volume and no reading is ever owed. `
    + `Declare this repository's own under \`review.paths\` in ${fromProject()}: ${SET_PATHS}${layout}`;
};

/** The one answer to whether a count over the declared paths can mean anything, read by the report
 *  and by the reckoning alike: a zero under a path this tree lacks and a zero from a quiet week are
 *  the same line, and the reading the first of them drops is never owed again (ISS-1939). */
export const reviewUncountable = (tree, paths) => cannotCount({ ...uncounted(tree, paths.value), paths });

export const reviewCounts = ({ tree, from, paths }) => {
  const rows = (gitOut(["diff", "--numstat", `${from}..HEAD`, "--", ...paths], tree) ?? "")
    .split("\n").filter(Boolean);
  return {
    files: rows.length,
    lines: rows.reduce((sum, row) => sum + row.split("\t").slice(0, 2)
      .reduce((part, one) => part + (Number.parseInt(one, 10) || 0), 0), 0),
  };
};

/** Null where the project declared nothing, which spends no git call. `uncountable` answers whether
 *  this project can drive the trigger; a null `mark` is the state before the first reading, not a fault. */
export const reviewStanding = (tree) => {
  if (!reviewDeclared()) return null;
  const refusal = reviewRefusal();
  if (refusal) return { refusal };
  const lines = sourced("lines", reviewLines());
  const paths = sourced("paths", reviewPaths());
  const read = uncounted(tree, paths.value);
  const { checkout, missing } = read;
  const standing = { lines, paths, missing, checkout, mark: null, uncountable: cannotCount({ ...read, paths }) };
  if (standing.uncountable) return standing;
  const mark = reviewedAt(tree);
  if (!mark) return standing;
  const { files, lines: changed } = reviewCounts({ tree, from: mark, paths: paths.value });
  return { ...standing, mark, files, changed, owed: changed >= lines.value };
};
