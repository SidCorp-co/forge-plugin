// Teach a dispatch to one of this plugin's roles whose message `forge brief` did not print, and a
// dispatch to the judging role whose message is not the judge's form: a typed brief is where a
// dispatcher's method reached a run, and a judge handed a tree works in it. how/brief.md says why.
// The dispatch goes ahead; the brief to send next time and its reason are said beside it.
// A project not gated `strict`, on fast delivery, asked for neither: its agents act first and record after.

import { context, how } from "../_hook.mjs";
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

const SEND = "and send what it prints as the prompt, unchanged, on the next dispatch.";
const WENT = "This one went as written";

const typed = (role, key) =>
  `Run \`forge brief ${key} --tree <its worktree>\` (no --tree for a run given none) ${SEND}\n\n`
  + `${WENT}: the message to \`${role}\` is not one \`forge brief\` printed in the last `
  + `${FRESH_MS / 60_000} minutes, so whatever was typed around the readings reaches the run as `
  + "if it were the method. Correct the run if it was told a method the brief would not have carried.";

const notJudged = (role, key, printed) =>
  `Run \`forge brief ${key} --judge --url <what the deployment answers at> --criteria <the numbers to judge>\` `
  + `(with --identity <what it reports serving> where the record holds one) ${SEND}\n\n`
  + `${WENT}: \`${role}\` judges what a deployment serves, and this message is ${printed
    ? "a builder's brief, carrying no URL or criteria and maybe a tree"
    : `not one \`forge brief --judge\` printed in the last ${FRESH_MS / 60_000} minutes`}. `
  + "A judge given a tree, or no URL, judges a checkout or a local stack instead of the deployment, "
  + "so read its verdict for which it judged.";

const aimedAtIssue = (role, key, { named, next }) =>
  `Run \`forge brief --requirement ${named} [--criterion BC-n] --url <what the deployment answers at>\` ${SEND}\n\n`
  + `${WENT}: the facts left on ${key} for this judge name ${named} ("${next}"), and the brief sent to \`${role}\` `
  + `aims it at ${key}'s own criteria, which is what it will judge.`;

const builderGivenRequirement = (role) =>
  `Send a requirement's brief to \`${JUDGE_ROLE}\`, and \`${role}\` what \`forge brief ISS-nn --tree <its worktree>\` `
  + "prints, unchanged.\n\n"
  + `${WENT}: a requirement's brief is a judge's, and \`${role}\` builds, so it holds no issue or tree to build in.`;

/* Read where the hook can, and said where it cannot rather than passed as checked. */
const factsChecked = async (ev, role, key) => {
  const facts = await requirementInFacts(key, ev.cwd || process.cwd());
  if (facts.named) context(aimedAtIssue(role, key, facts) + how());
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
  if (form === REQUIREMENT_FORM && !judging) context(builderGivenRequirement(role) + how());
  if (form === REQUIREMENT_FORM || (form !== null && !judging)) return;
  if (form === JUDGE_FORM) return factsChecked(ev, role, key);
  const waiver = await briefWaived(ev.cwd || process.cwd());
  if (waiver.waived) {
    context(`No brief asked: ${waiver.slug} is gated \`${waiver.profile}\` on fast delivery, so \`${role}\` takes this message as `
      + "it stands. What the run did is recorded on the issue afterwards.");
    return;
  }
  const read = `\n\nNot waived: ${waiver.why}.`;
  context((judging ? notJudged(role, key, form !== null) : typed(role, key)) + read + how());
};
