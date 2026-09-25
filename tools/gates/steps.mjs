import { availableParallelism } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parallelRuns } from "../../plugin/src/resolve/settings.mjs";
import { HUMAN_REPORTER } from "./reporters/isolation.mjs";
import { digestFile } from "./ledger.mjs";
import { under } from "./scope.mjs";

const DIGEST_LENGTH = 12;

const TREE = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

const ours = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

/* A gate that runs out of machine reports no verdict and is spent again, so the runs this box
   declares divide its cores; never to zero, and nothing declared is the whole machine (ISS-1613). */
export const testWorkers = ({ cores = availableParallelism(), declared = parallelRuns() } = {}) =>
  (declared.value === null ? cores : Math.max(1, Math.floor(cores / declared.value)));

export const testFlags = (workers = testWorkers()) => [
  `--test-concurrency=${workers}`,
  `--test-reporter=${HUMAN_REPORTER}`, "--test-reporter-destination=stdout",
  `--test-reporter=${ours("reporters/file-times.mjs")}`, "--test-reporter-destination=stdout",
  `--test-reporter=${ours("reporters/isolation.mjs")}`, "--test-reporter-destination=stdout",
];

/* The gate's steps and the paths each one reads. Nothing is inferred: every step is a script this
   repository owns, spent as `npm run <label>`, so its reads were taken off that script. A step
   whose reads are too narrow does not fail — it passes without having run. */

// Each top-level directory by name, `.` being the top-level files: three steps read the whole tree.
export const EVERYTHING = [".", ".claude-plugin", "docs", "packages", "plugin", "tools"];

/* The suite's whole-repository readers: every tracked file, every `.md`, all of `docs/` against
   CLAUDE.md and the skills, every path this repository's own prose cites, every importer of an export, and
   the default branch's standing counts. Left in one `test` step
   they make its honest reads the whole tree; `checks/docs` is claimed whole (ISS-117). */
export const WHOLE_TREE_TESTS = [
  "plugin/test/checks/cited-paths.test.mjs",
  "plugin/test/checks/docs",
  "plugin/test/checks/shapes/standing.test.mjs",
  "plugin/test/checks/shapes/test-only.test.mjs",
  "plugin/test/checks/sources-are-text.test.mjs",
  "plugin/test/checks/surface/dead-exports.test.mjs",
  "plugin/test/checks/surface/level-boundary.test.mjs",
  "plugin/test/guides/contract.test.mjs",
];

export const TEST_FILE = /^plugin\/test\/.*\.test\.mjs$/u;

/* The ceiling a test file gets while the audit cannot derive its set: `where` the file, `reads` what
   it may read, `blind` the route that justified it. One key per file and never a directory of them; a
   ceiling answers for every route that blinds its file, the audit's own reads unioned in and failing
   the gate where they escape; and a file blind on a route nobody read is left out (ISS-1761, ISS-1774). */
const SPAWNED = "a node child that left no record: a node standing here, importing plugin/test/run";
const TAGS = "a git child that left no record: ls-remote against a scratch origin, standing here";
const RUN = [".", "plugin/hooks/vendor", "plugin/src", "plugin/test/fixtures.mjs",
  "plugin/test/fixtures/answer-reach.mjs", "plugin/test/fixtures/answered.mjs",
  "plugin/test/fixtures/own-keys.mjs", "plugin/test/fixtures/own-project.mjs",
  "plugin/test/fixtures/served.mjs", "plugin/test/run", "tools"];

/* The four the machine table's own files once earned are gone: a node child carries the audit
   whatever environment its caller handed it, so those files derive their own sets now (ISS-2119).
   What is left is what no preload reaches — a process orphaned on purpose, and a git. */
export const DECLARED_READS = [
  { where: "plugin/test/run/processes/orphans.test.mjs", reads: RUN, blind: SPAWNED },
  { where: "plugin/test/run/release/run-released-version.test.mjs", reads: RUN, blind: TAGS },
];

export const declarationFor = (file, table = DECLARED_READS) => {
  const found = table.filter((one) => one.where === file);
  if (found.length > 1) {
    throw new Error(`${file} is declared ${found.length} times in DECLARED_READS, so which paths it `
      + `may read has no answer. Leave one of them in tools/gates/steps.mjs.`);
  }
  return found[0] ?? null;
};

export const STEPS = [
  { label: "lint", reads: EVERYTHING },
  { label: "lint:code-quality", reads: EVERYTHING },
  { label: "test:tree", tests: "named", reads: EVERYTHING },
  {
    label: "test",
    tests: "rest",
    /* No root document, proven not assumed: with all 31 non-`requirements` docs plus CLAUDE.md,
       README.md and VI-NATURAL.md overwritten in place and restored, these were 860 pass, 0 fail. */
    reads: [
      ".claude-plugin",
      "docs/requirements",
      "package-lock.json",
      "package.json",
      "packages",
      "plugin",
      "tools",
    ],
  },
  { label: "check:package", reads: ["packages/code-quality"] },
  { label: "check:vi-text", reads: ["plugin/scripts", "plugin/vi-natural", "tools/check-vi-text.mjs"] },
  { label: "check:vi-goldens",
    reads: ["plugin/scripts", "plugin/src/markdown.mjs", "plugin/vi-natural", "tools"] },
  {
    label: "check:vendor",
    reads: ["packages/code-quality", "plugin/hooks/vendor", "plugin/scripts/check-vendor.mjs"],
  },
  { label: "check:spec", reads: [".", "docs/requirements", "plugin/hooks/vendor", "plugin/src"] },
  { label: "check:skill-paths", reads: ["plugin"] },
  { label: "check:skill-boundaries",
    reads: [".", "plugin/guides", "plugin/scripts/skill-boundaries.mjs", "plugin/skills", "plugin/src"] },
  { label: "check:skill-figures",
    reads: ["plugin/guides", "plugin/scripts/skill-figures.mjs", "plugin/skills", "plugin/src"] },
  { label: "check:dup", reads: ["plugin"] },
  {
    label: "sync:skills:check",
    reads: ["packages/code-quality/claude-plugin/skills", "plugin/skills", "tools/sync-skills.mjs"],
  },
];

export const readsWholeTree = (path) => WHOLE_TREE_TESTS.some((claim) => under(path, claim));

export const argvForTests = (files) => [process.execPath, "--test", ...testFlags(), ...files];

// A path of this tree, to the end of its argument, stands for that file's content and not for where the tree sits (ISS-1763).
const identity = (one, tree) => {
  const at = one.indexOf(`${tree}/`);
  if (at < 0) return one;
  const rel = one.slice(at + tree.length + 1);
  return `${one.slice(0, at)}${rel}@${digestFile(join(tree, rel)).slice(0, DIGEST_LENGTH)}`;
};

// What a step spends apart from its files: the context a per-file record answers under.
export const launcherOf = (step, tree = TREE) =>
  step.argv.slice(0, step.argv.length - step.files.length).map((one) => identity(one, tree));

export const gateSteps = (found) => {
  const absent = WHOLE_TREE_TESTS.filter((claim) => !found.some((one) => under(one, claim)));
  if (absent.length > 0) {
    throw new Error(`git reports no test file at ${absent.join(", ")}, and tools/gates/steps.mjs `
      + `claims it as a whole-tree read. Correct it there, or the suite runs it in no step.`);
  }
  const files = { named: found.filter(readsWholeTree), rest: found.filter((one) => !readsWholeTree(one)) };
  return STEPS.map((step) => {
    if (step.reads.length === 0) {
      throw new Error(`step ${step.label} declares no reads, so nothing can say when it is stale. `
        + `Give it the paths it reads in tools/gates/steps.mjs.`);
    }
    if (!step.tests) return { ...step, argv: ["npm", "run", step.label] };
    if (files[step.tests].length === 0) {
      throw new Error(`step ${step.label} matches no test file of the ${found.length} git reports; `
        + `its selector is broken and the step would pass without running anything.`);
    }
    return { ...step, files: files[step.tests], argv: argvForTests(files[step.tests]) };
  });
};
