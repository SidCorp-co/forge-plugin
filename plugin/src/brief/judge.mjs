/* The brief a judging run is sent: the deployment it judges, the criteria it judges there, and no
   tree. A judge handed a tree's lines read them as where to work and ran a builder's suites in it,
   and a judge handed no URL brought up a local stack instead (ISS-3145). docs/cli/brief.md. */
import { fail } from "../resolve/settings.mjs";

/** The role a judging run is dispatched as, which the hook holds to this form. */
export const JUDGE_ROLE = "qa";

/** What the brief's record keeps for this form, so the hook reads a form and never a prompt's words. */
export const JUDGE_FORM = "judge";

/** The judge's form aimed at a requirement's criteria rather than an issue's, kept apart for the same reason. */
export const REQUIREMENT_FORM = "requirement";

const OWN_FLAGS = ["url", "criteria", "identity", "requirement", "criterion"];

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

/** Refuses the judge form's flags on a builder's brief, where nothing would print them. */
export const refuseJudgeFlags = (key, asked) => {
  const stray = OWN_FLAGS.filter((name) => asked[name] !== undefined).map((name) => `--${name}`);
  if (!stray.length) return;
  fail(`brief: ${stray.join(", ")} ${stray.length > 1 ? "are" : "is"} read only in a judge's brief, which --judge asks for; `
    + `without it nothing would carry ${stray.length > 1 ? "them" : "it"} to the run:\n  ${callFor(key)}`);
};

/** The judge's readings off its flags, each refused where it cannot be read. */
export const judgeOf = (key, asked) => {
  const given = ["tree", "batch"].filter((name) => asked[name] !== undefined).map((name) => `--${name}`);
  if (given.length) {
    fail(`brief: a judge is given no tree and judges one issue, so --judge takes no ${given.join(" or ")}: `
      + `what it judges is what the deployment serves. Brief it as:\n  ${callFor(key)}`);
  }
  const missing = [key ? null : "the issue key", ...["url", "criteria"].map((name) => (asked[name] === undefined ? `--${name}` : null))]
    .filter(Boolean);
  if (missing.length) fail(`brief: a judge's brief names the issue, where it is deployed and which criteria to judge, and this one lacks ${missing.join(" and ")}:\n  ${callFor(key)}`);
  return { urls: urlsOf(asked.url, key), criteria: criteriaOf(asked.criteria), identity: identityOf(asked.identity) };
};

const NOTHING_ELSE = "judge these and write nothing else";

/** The judge's brief, every line a reading, the first naming what it judges. */
export const judgeText = (key, { urls, criteria, identity }) => [
  `Target: ${key}, criteria ${criteria.join(", ")} — ${NOTHING_ELSE}.`,
  "Role: judge",
  `Deployed at: ${urls.join(", ")}`,
  `Identity: ${identity ?? "none given"}`,
  `Criteria: ${criteria.join(", ")}`,
  "Tree: none",
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
