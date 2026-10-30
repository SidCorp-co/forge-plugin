// Refuse a dispatch to one of this plugin's roles whose message `forge brief` did not print, and a
// dispatch to the judging role whose message is not the judge's form: a typed brief is where a
// dispatcher's method reached a run, and a judge handed a tree works in it. how/brief.md says why.
// A project gated `yolo` on fast delivery asked for neither: its agents act first and record after.

import { context, deny, how } from "../_hook.mjs";
import { JUDGE_FORM, JUDGE_ROLE, REQUIREMENT_FORM } from "../../src/brief/judge.mjs";
import { requirementInFacts } from "../../src/brief/facts.mjs";
import { FRESH_MS, briefFormOf } from "../../src/brief/record.mjs";
import { briefWaived } from "../../src/brief/waived.mjs";
import { PLUGIN_ROOT, nameAt } from "../../src/tools/plugin-copy.mjs";

const DISPATCHES = new Set(["Agent", "Task"]);
const KEY = /\b[A-Z][A-Z0-9]*-\d+\b/u;

/* The prefix a role of this plugin carries is its name, read off the copy that is running. */
const rolePrefix = () => {
  const name = nameAt(PLUGIN_ROOT);
  return name ? `${name}:` : null;
};

const SEND = "and send what it prints as the prompt, unchanged.";

const typed = (role, key) =>
  `Hold — run \`forge brief ${key} --tree <its worktree>\` (no --tree for a run given none) ${SEND}\n\n`
  + `This message to \`${role}\` is not one \`forge brief\` printed in the last `
  + `${FRESH_MS / 60_000} minutes, so whatever was typed around the readings reaches the run as `
  + "if it were the method.";

const notJudged = (role, key, printed) =>
  `Hold — run \`forge brief ${key} --judge --url <what the deployment answers at> --criteria <the numbers to judge>\` `
  + `(with --identity <what it reports serving> where the record holds one) ${SEND}\n\n`
  + `\`${role}\` judges what a deployment serves, and this message is ${printed
    ? "a builder's brief, carrying no URL or criteria and maybe a tree"
    : `not one \`forge brief --judge\` printed in the last ${FRESH_MS / 60_000} minutes`}: `
  + "a judge given a tree, or no URL, judges a checkout or a local stack instead of the deployment.";

const aimedAtIssue = (role, key, { named, next }) =>
  `Hold — run \`forge brief --requirement ${named} [--criterion BC-n] --url <what the deployment answers at>\` ${SEND}\n\n`
  + `The facts left on ${key} for this judge name ${named} ("${next}"), and the brief sent to \`${role}\` aims it `
  + `at ${key}'s own criteria, which is what it would judge.`;

const builderGivenRequirement = (role) =>
  `Hold — a requirement's brief is a judge's, so it goes to \`${JUDGE_ROLE}\` and not to \`${role}\`. Send `
  + `\`${role}\` what \`forge brief ISS-nn --tree <its worktree>\` prints, unchanged.`;

/* Read where the hook can, and said where it cannot rather than passed as checked. */
const factsChecked = async (ev, role, key) => {
  const facts = await requirementInFacts(key, ev.cwd || process.cwd());
  if (facts.named) deny(aimedAtIssue(role, key, facts) + how());
  if (facts.unread) {
    context(`Not checked: whether the facts left on ${key} name a requirement, which would aim this judge at the `
      + `wrong record (${facts.unread}). Where they do, brief it with \`forge brief --requirement REQ-n\`.`);
  }
};

export const run = async (ev) => {
  if (!DISPATCHES.has(ev.tool_name ?? "")) return;
  const role = String(ev.tool_input?.subagent_type ?? "");
  const prefix = rolePrefix();
  if (!prefix || !role.startsWith(prefix)) return;
  const prompt = String(ev.tool_input?.prompt ?? "");
  const form = briefFormOf(ev.session_id, prompt);
  const judging = role === `${prefix}${JUDGE_ROLE}`;
  const key = KEY.exec(prompt)?.[0] ?? "ISS-nn";
  if (form === REQUIREMENT_FORM && !judging) deny(builderGivenRequirement(role) + how());
  if (form === REQUIREMENT_FORM || (form !== null && !judging)) return;
  if (form === JUDGE_FORM) return factsChecked(ev, role, key);
  const waiver = await briefWaived(ev.cwd || process.cwd());
  if (waiver.waived) {
    context(`No brief asked: ${waiver.slug} is gated \`yolo\` on fast delivery, so \`${role}\` takes this message as `
      + "it stands. What the run did is recorded on the issue afterwards.");
    return;
  }
  const read = `\n\nNot waived: ${waiver.why}.`;
  deny((judging ? notJudged(role, key, form !== null) : typed(role, key)) + read + how());
};
