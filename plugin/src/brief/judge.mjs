/* The brief a judging run is sent: where it judges — a deployment it drives (--url) or an installed
   command-line program it runs (--program) — and the criteria. A judge driving a deployment is given
   no tree; one handed a tree's lines read them as where to work and ran a builder's suites in it, and
   one handed no deployment brought up a local stack instead (ISS-3145). A CLI judge is the exception:
   it names the program and, where it needs one, the directory to run it in (FB-26). docs/cli/brief.md. */
import { fail } from "../resolve/settings.mjs";

/** The role a judging run is dispatched as, which the hook holds to this form. */
export const JUDGE_ROLE = "qa";

/** What the brief's record keeps for this form, so the hook reads a form and never a prompt's words. */
export const JUDGE_FORM = "judge";

/** The judge's form aimed at a requirement's criteria rather than an issue's, kept apart for the same reason. */
export const REQUIREMENT_FORM = "requirement";

const OWN_FLAGS = ["url", "program", "criteria", "identity", "requirement", "criterion"];

const REQUIREMENT = /^REQ-\d+$/u;
const CLAUSE = /^BC-\d+$/u;

const callFor = (key) => `forge brief ${key ?? "ISS-45"} --judge --url <what the deployment answers at> --criteria 1,2 `
  + "[--identity <what it reports serving>]";

const none = (bad) => `\`${bad.join("`, `")}\` ${bad.length > 1 ? "are" : "is"} none`;

const partsOf = (raw) => String(raw).split(",").map((one) => one.trim());

/* The parser drops a newline it finds inside an address, and the value printed is the one given, so a
   space or a control character is refused before parsing: one would carry a line of its own into the brief. */
const isDeployed = (one) => {
  if (/[\s\p{Cc}]/u.test(one)) return false;
  try {
    return ["http:", "https:"].includes(new URL(one).protocol);
  } catch {
    return false;
  }
};

const urlsOf = (raw, key) => {
  const urls = partsOf(raw);
  const bad = urls.filter((one) => !isDeployed(one));
  if (bad.length) {
    fail(`brief: --url takes the http or https addresses the deployment answers at, joined by commas, and ${none(bad)}. `
      + `A judge drives what is deployed, so a path or a bare host gives it nothing to drive:\n  ${callFor(key)}`);
  }
  if (new Set(urls).size !== urls.length) fail("brief: --url names one address twice. Name each one time.");
  return urls;
};

const criteriaOf = (raw) => {
  const numbers = partsOf(raw);
  const bad = numbers.filter((one) => !/^[1-9]\d*$/u.test(one));
  if (bad.length) fail(`brief: --criteria takes the numbers of the criteria to judge, joined by commas, as 1,2,5, and ${none(bad)}.`);
  if (new Set(numbers).size !== numbers.length) fail("brief: --criteria names one criterion twice. Name each one time.");
  return numbers;
};

const identityOf = (raw) => {
  if (raw === undefined) return null;
  const identity = String(raw).trim();
  if (!/^\S+$/u.test(identity)) fail(`brief: --identity takes the one value the deployment reports serving, and \`${raw}\` is not one word.`);
  return identity;
};

/* One token and no whitespace, for the same reason --url is: the value is printed into the brief, and a
   space or a control character would carry a line of its own into it. */
const programOf = (raw) => {
  const program = String(raw).trim();
  if (!program || /[\s\p{Cc}]/u.test(program)) {
    fail(`brief: --program takes the path or name of the installed command-line program to judge, one token with no `
      + `spaces, and \`${raw}\` is none. A judge runs it to judge a CLI criterion, as --url drives a deployment.`);
  }
  return program;
};

/* The directory a CLI judge runs the program in: a path, printed on its own line, so a newline or a
   control character is refused as it is for --url. A space is left, since a directory may hold one. */
const runDirOf = (raw) => {
  if (raw === undefined) return null;
  const dir = String(raw).trim();
  if (!dir || /[\n\r\p{Cc}]/u.test(dir)) {
    fail(`brief: --tree takes the one directory a CLI judge runs the program in, and \`${raw}\` is not a usable path.`);
  }
  return dir;
};

/** Refuses the judge form's flags on a builder's brief, where nothing would print them. */
export const refuseJudgeFlags = (key, asked) => {
  const stray = OWN_FLAGS.filter((name) => asked[name] !== undefined).map((name) => `--${name}`);
  if (!stray.length) return;
  fail(`brief: ${stray.join(", ")} ${stray.length > 1 ? "are" : "is"} read only in a judge's brief, which --judge asks for; `
    + `without it nothing would carry ${stray.length > 1 ? "them" : "it"} to the run:\n  ${callFor(key)}`);
};

/** The judge's readings off its flags, each refused where it cannot be read. A judge aims at a
 *  deployment (--url) or an installed program (--program), or both; a tree reads only beside --program,
 *  the directory that judge runs it in, since a judge driving a deployment is given none (ISS-3145). */
export const judgeOf = (key, asked) => {
  const hasUrl = asked.url !== undefined;
  const hasProgram = asked.program !== undefined;
  if (asked.batch !== undefined) fail(`brief: a judge judges one issue, so --judge takes no --batch. Brief it as:\n  ${callFor(key)}`);
  if (asked.tree !== undefined && !hasProgram) {
    fail("brief: a judge driving a deployment is given no tree — it judges what the deployment serves, and a tree "
      + `reads as where to work. A tree is read only beside --program, the directory a CLI judge runs the program in:\n  ${callFor(key)}`);
  }
  const missing = [
    key ? null : "the issue key",
    hasUrl || hasProgram ? null : "--url or --program",
    asked.criteria === undefined ? "--criteria" : null,
  ].filter(Boolean);
  if (missing.length) {
    fail("brief: a judge's brief names the issue, where to judge it — a deployment (--url) or an installed program "
      + `(--program) — and which criteria, and this one lacks ${missing.join(" and ")}:\n  ${callFor(key)}`);
  }
  return {
    urls: hasUrl ? urlsOf(asked.url, key) : [],
    program: hasProgram ? programOf(asked.program) : null,
    tree: runDirOf(asked.tree),
    criteria: criteriaOf(asked.criteria),
    identity: identityOf(asked.identity),
  };
};

const NOTHING_ELSE = "judge these and write nothing else";

/* The dispatcher's facts for a judge ride the lease, so a judge reading only this brief would miss them
   and judge at commit alone (FB-30): the note is carried as the last line, below the structured
   readings a free-form note could otherwise run into. A note naming a requirement is left out — the
   gate holds that dispatch back, so this issue brief never reaches a run. */
export const judgeText = (key, { urls, program, tree, criteria, identity }, facts = null) => [
  `Target: ${key}, criteria ${criteria.join(", ")} — ${NOTHING_ELSE}.`,
  "Role: judge",
  ...(urls.length ? [`Deployed at: ${urls.join(", ")}`] : []),
  ...(program ? [`Program: ${program}`] : []),
  `Identity: ${identity ?? "none given"}`,
  `Criteria: ${criteria.join(", ")}`,
  program && tree ? `Run the program in: ${tree}` : "Tree: none",
  ...(facts?.next && !facts.named ? [`Dispatcher facts: ${facts.next}`] : []),
].join("\n");

const requirementCall = (requirement) => `forge brief --requirement ${requirement ?? "REQ-79"} [--criterion BC-6] `
  + "--url <what the deployment answers at> [--identity <what it reports serving>]";

/** A requirement judge's readings: the requirement, the clauses of it to judge or all of them, and the
 *  deployment. An issue key, a tree, a batch and an issue's criterion numbers are refused by name: each
 *  would aim the judge at an issue's record, which is how three judges judged ISS-n for REQ-79 BC-6. */
export const requirementOf = (key, asked) => {
  const requirement = String(asked.requirement ?? "").trim();
  if (!REQUIREMENT.test(requirement)) {
    fail(`brief: --requirement takes one requirement key, as REQ-79, and \`${asked.requirement}\` is none:\n  ${requirementCall()}`);
  }
  const stray = [key ? key : null, ...["tree", "batch", "criteria"].filter((name) => asked[name] !== undefined)
    .map((name) => `--${name}`)].filter(Boolean);
  if (stray.length) {
    fail(`brief: a requirement's judge is aimed at ${requirement} alone, so it takes no ${stray.join(" or ")}: an issue `
      + "key or an issue's criterion numbers would send it to judge that issue's record instead. Brief it as:\n  "
      + requirementCall(requirement));
  }
  if (asked.url === undefined) fail(`brief: a requirement's judge drives what is deployed, and this brief lacks --url:\n  ${requirementCall(requirement)}`);
  const clauses = asked.criterion === undefined ? [] : partsOf(asked.criterion);
  const bad = clauses.filter((one) => !CLAUSE.test(one));
  if (bad.length) fail(`brief: --criterion takes the requirement's criteria as BC-6, joined by commas, and ${none(bad)}.`);
  if (new Set(clauses).size !== clauses.length) fail("brief: --criterion names one criterion twice. Name each one time.");
  return { requirement, clauses, urls: urlsOf(asked.url, null), identity: identityOf(asked.identity) };
};

/** The requirement judge's brief: the target first, so nothing below it reads as a second one. */
export const requirementText = ({ requirement, clauses, urls, identity }) => [
  `Target: ${requirement}, ${clauses.length ? `criteria ${clauses.join(", ")}` : "every criterion"} — ${NOTHING_ELSE}: `
    + "no issue's criteria, no other record.",
  "Role: judge",
  `Deployed at: ${urls.join(", ")}`,
  `Identity: ${identity ?? "none given"}`,
  "Tree: none",
].join("\n");
