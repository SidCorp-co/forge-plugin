/* The volume of landed change that earns a reading of the whole of it, read off the project the CLI
   stands in — here and not in the release script, which does not ship (ISS-1883). What a project
   declares, what each refusal protects and what its silence means: README.md's Configuration. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

import { fail, FROM_PROJECT, projectReview } from "../resolve/settings.mjs";

export const REVIEWED = "refs/forge/reviewed";

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

/** Absent takes the default; a null or a mistyped value is refused rather than taking it (ISS-333). */
export const reviewLines = () => {
  const given = projectReview().lines;
  if (given === undefined) return SHIPPED_LINES;
  if (!Number.isInteger(given) || given < 1) {
    fail(`\`review.lines\` in ${FROM_PROJECT} is a whole number of changed lines above zero, not `
      + `\`${JSON.stringify(given)}\`. Drop the key to take the ${SHIPPED_LINES} this plugin ships with.`);
  }
  return given;
};

const ESCAPES = (one) => isAbsolute(one) || one.startsWith("..") || one.includes(`${sep}..${sep}`);

const wrongShape = (given) => {
  if (!Array.isArray(given) || given.length === 0) return "a list of one or more paths";
  if (!given.every((one) => typeof one === "string" && one.trim() !== "")) return "paths that are non-empty strings";
  if (given.some(ESCAPES)) return "paths inside the repository, each relative to its root";
  return null;
};

/** Present and malformed is refused by the rule above rather than falling back: the three below are
 *  this repository's own, so counting them elsewhere would look exactly like the right answer. */
export const reviewPaths = () => {
  const given = projectReview().paths;
  if (given === undefined) return [...SHIPPED_PATHS];
  const wrong = wrongShape(given);
  if (wrong) {
    fail(`\`review.paths\` in ${FROM_PROJECT} is ${wrong}, not \`${JSON.stringify(given)}\`. Drop the `
      + `key to count ${SHIPPED_PATHS.join(", ")}, which is this plugin's own layout and no other `
      + `repository's.`);
  }
  return [...given];
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
