/* The call loop and what it costs: how many model calls a payload earns, what effort the round is
   worth, and the one retry an unfinished review gets before anybody reads it. Split from the verb
   because the verb is bookkeeping and this is the part that spends money. docs/FORGE-CLI.md. */
import { askApi } from "./codex-api.mjs";
import { toolsFor, runTool } from "./codex-tools.mjs";
import { BUDGET_MS } from "./codex-log.mjs";
import { incompleteIn, keepsTools, plannedLimits } from "./codex-plan.mjs";
import { CONFIG_PATH } from "../resolve/config.mjs";

/* A round exists so the reviewer can SEE what it was not given, and seeing has a fixed point. */
export const rounds = async (values, model, opening, scope, onDelta, ask = askApi, held = {}) => {
  const { effort, cap, system } = held;
  /* One clock for the consult, not one per attempt, whatever the ladder does. */
  const signal = held.signal ?? AbortSignal.timeout(BUDGET_MS);
  const calls = cap ?? plannedLimits().base;
  const messages = [{ role: "user", content: opening }];
  const used = [];
  const refused = [];
  /* Summed over the calls: logged from the last one alone, `log --score` counted a third of the input. */
  const spent = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let thought = 0;
  const charge = (one) => {
    for (const key of Object.keys(spent)) spent[key] += one.usage?.[key] ?? 0;
    thought += one.thought ?? 0;
  };
  for (let call = 1; ; call += 1) {
    const last = call === calls;
    console.error(`codex: call ${call} of ${calls}${used.length ? ` after ${used.length} tool call(s)` : ""}...`);
    const served = toolsFor(scope);
    const held = await ask(values, model, messages, {
      onDelta, signal, effort, system,
      tools: last && !keepsTools() ? [] : served,
      serve: !last,
    });
    charge(held);
    if (!held.calls.length) return { ...held, usage: spent, thought, tools: used, refused, calls: call };
    /* A capped reply of only tool calls answered nothing: it fails rather than logging as a review. */
    if (last) {
      if (!held.text.trim()) {
        const unanswered = new Error(`spent all ${calls} call(s) reading and never answered. Raise \`codex.roundsMax\` in ${CONFIG_PATH}.`);
        /* Carried, or the ladder under-reports the exhaustion the stats exist to count. */
        unanswered.spent = { usage: spent, thought, tools: used, refused };
        throw unanswered;
      }
      const unserved = held.calls.map((one) => `${one.name} ${detail(one.input)} (past the call cap)`);
      return { ...held, usage: spent, thought, tools: used, refused: [...refused, ...unserved], calls: call };
    }
    const results = [];
    for (const one of held.calls) {
      const ran = runTool(scope, one.name, one.input);
      used.push({ name: one.name, input: one.input, chars: ran.text.length, error: Boolean(ran.error) });
      console.error(`codex:   ${one.name} ${detail(one.input)}${ran.error ? ` — ${ran.text}` : ""}`);
      if (ran.error) refused.push(`${one.name} ${detail(one.input)}: ${ran.text}`);
      results.push({
        type: "tool_result",
        tool_use_id: one.id,
        content: ran.text,
        ...(ran.error ? { is_error: true } : {}),
      });
    }
    messages.push({
      role: "assistant",
      content: [
        ...(held.text ? [{ type: "text", text: held.text }] : []),
        ...held.calls.map((one) => ({ type: "tool_use", id: one.id, name: one.name, input: one.input })),
      ],
    });
    const closing = call + 1 === calls
      ? [{ type: "text", text: "No further tool calls will be served. Answer now, and say what you could not check." }]
      : [];
    messages.push({ role: "user", content: [...results, ...closing] });
  }
};

/* Both attempts were billed, so both are on the row. */
const totalled = (first, again) => {
  const spent = { ...again.usage };
  for (const key of Object.keys(first.usage ?? {})) spent[key] = (spent[key] ?? 0) + first.usage[key];
  return {
    usage: spent,
    thought: (first.thought ?? 0) + (again.thought ?? 0),
    tools: [...(first.tools ?? []), ...(again.tools ?? [])],
    refused: [...(first.refused ?? []), ...(again.refused ?? [])],
  };
};

/** Retried here rather than patched by the next consult, which is why the first attempt is
 *  buffered: "before it is shown" and a stream to stdout cannot both hold. docs/FORGE-CLI.md. */
export const reviewed = async (values, model, opening, scope, onDelta, ask = askApi, held = {}) => {
  const { budget, ceiling } = held;
  held = { ...held, signal: held.signal ?? AbortSignal.timeout(BUDGET_MS) };
  const again = budget < ceiling;
  const quiet = () => {};
  const climb = async (spent) => {
    const retried = await rounds(values, model, opening, scope, onDelta, ask, { ...held, cap: ceiling });
    return { ...retried, ...totalled(spent, retried), attempt: 2, budget: ceiling, retriedFrom: budget, streamed: true };
  };
  let first;
  try {
    first = await rounds(values, model, opening, scope, again ? quiet : onDelta, ask, { ...held, cap: budget });
  } catch (error) {
    /* Only the one failure a larger budget can fix. Every other — a refused field, a 401, the
       consult's clock — would fail the same way twice and bill for it. */
    if (!again || !error.spent) throw error;
    console.error(`codex: ${error.message} Retrying at ${ceiling} call(s).`);
    return climb(error.spent);
  }
  if (!again) return { ...first, attempt: 1, budget, streamed: true };
  if (!incompleteIn(first.text)) return { ...first, attempt: 1, budget, streamed: false };
  console.error(`codex: the reply says it could not check something inside ${budget} call(s); `
    + `retrying at ${ceiling} before showing it.`);
  return climb(first);
};

/** What a tool call was for, in one line of a terminal: the path, or the pattern grep was given. */
const detail = (input = {}) => input.path ?? (input.pattern ? `/${input.pattern}/` : "");

