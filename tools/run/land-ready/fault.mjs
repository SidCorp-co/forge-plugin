/* Whose a red candidate is, read off what the gate that refused it already wrote: each failing case,
   the paths it depended on, and which members' own paths those reach. A member is named only where
   the evidence names it alone; everything short of that is a set to split. docs/cli/the-candidate.md. */
import { STEPS } from "../../gates/steps.mjs";

const TEST_STEPS = new Set(STEPS.filter((one) => one.tests).map((one) => one.label));

/* A token that is a path, optionally followed by a line and a column, as a linter, the dup check and
   the spec check print one: `src/x.mjs:12:3`, `/tmp/room/plugin/y.md`, `docs/a.md`. */
const PATH_TOKEN = /[\w@./-]*[\w-]\.[A-Za-z]\w*(?::\d+)*/gu;

/* The failing step's own section of the gate's output: from its banner to the end, so nothing a step
   before it printed is read as this one's. */
const sectionOf = (output, step) => {
  const banner = `=== ${step} ===`;
  const at = output.lastIndexOf(banner);
  return at < 0 ? "" : output.slice(at + banner.length);
};

const tokensIn = (text) => [...new Set([...text.matchAll(PATH_TOKEN)]
  .map(([one]) => one.replace(/(?::\d+)+$/u, "").replace(/^\.\//u, ""))
  .filter((one) => one.includes("/") || one.includes(".")))];

/* A name printed relative to the directory the step was pointed at, or absolute in a room this
   landing made, still names that file: the dup check prints `src/x.mjs` for `plugin/src/x.mjs`. */
const names = (token, file) => token === file || file.endsWith(`/${token}`) || token.endsWith(`/${file}`);

const inTree = (file, tree) => tree === "" || tree === "." || file === tree || file.startsWith(`${tree}/`);

/* A read reaches a file by any of the four claims the audit makes, each read as widely as it can be,
   a listing as everything below it: a doubt here costs a split, where a claim read too narrowly would
   clear the member at fault. */
const readReaches = (reads, file) => reads.paths.includes(file)
  || [...reads.dirs, ...reads.trees, ...reads.whole].some((tree) => inTree(file, tree));

/** The failing cases of one gate's refusal, each with what it depended on or `null` where nothing the
 *  gate wrote says: a test case is its file and what that file read in the red run, beside the paths
 *  its failure message names; any other step is one case, the paths its own section of the output
 *  names. */
export const casesOf = (verdict, output) => {
  if (!verdict?.step) return [{ what: "a refusal the gate wrote no failing step for", reach: null }];
  const { step } = verdict;
  if (TEST_STEPS.has(step)) {
    if (!Array.isArray(verdict.cases) || verdict.cases.length === 0) {
      return [{ what: `the step ${step}, which named no case`, reach: null }];
    }
    return verdict.cases.map(({ file, name, said = [] }) => {
      const reads = verdict.reads?.[file] ?? null;
      const read = (one) => one === file || readReaches(reads, one);
      const told = tokensIn(said.join("\n"));
      return {
        what: `${file}  ${name}`,
        reach: reads === null ? null : read,
        named: reads === null || told.length === 0 ? null : (one) => read(one) && told.some((token) => names(token, one)),
        read: "what its file read in that run",
        told: told.join(", "),
      };
    });
  }
  const tokens = tokensIn(sectionOf(output, step));
  return [{
    what: `what it printed, naming ${tokens.length ? tokens.join(", ") : "no path"}`,
    reach: (one) => tokens.some((token) => names(token, one)),
    read: "the paths it printed",
  }];
};

/** Which members each case falls to: those whose paths the case read and its failure named, where its
 *  failure names any of theirs, and otherwise every member whose paths it read — a message naming the
 *  file the case failed on is the case saying which of its reads it failed on. `culprits` where every
 *  case falls to exactly one member, each with the cases that name it, and `suspects` otherwise:
 *  every member where any case is unread or reaches nobody, the members the cases reach where one
 *  reaches several. */
export const attributed = (cases, members) => {
  const reaching = (reach) => members.filter((member) => member.landing.files.some(reach));
  const falls = cases.map((one) => {
    if (one.reach === null) return { one, to: null };
    const named = one.named ? reaching(one.named) : [];
    return named.length ? { one: { ...one, read: `the paths its failure named, ${one.told}` }, to: named }
      : { one, to: reaching(one.reach) };
  });
  if (falls.every(({ to }) => to !== null && to.length === 1)) {
    const culprits = [...new Set(falls.map(({ to }) => to[0]))];
    return {
      culprits: culprits.map((member) => ({
        member, cases: falls.filter(({ to }) => to[0] === member).map(({ one }) => one),
      })),
      suspects: [],
    };
  }
  const blind = falls.some(({ to }) => to === null || to.length === 0);
  const reached = new Set(falls.flatMap(({ to }) => to ?? []));
  return { culprits: null, suspects: blind ? [...members] : members.filter((one) => reached.has(one)) };
};
