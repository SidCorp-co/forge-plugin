/* The call loop and what it costs: how many model calls a payload earns, what effort the round is worth,
   and the rest of the attempt an unfinished review is given before anybody reads it. Split from the verb
   because the verb is bookkeeping and this is the part that spends money. docs/cli/codex-the-consult.md. */
import { askApi } from "./codex-api.mjs";
import { toolsFor, runTool } from "./codex-tools.mjs";
import { budgetMs } from "../resolve/settings.mjs";
import { incompleteIn, keepsTools, plannedLimits } from "./codex-plan.mjs";
import { configPath } from "../resolve/config.mjs";

const SPENT = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];

const CLOSING = "No further tool calls will be served. Answer now, and say what you could not check.";

/* The attempt being carried on was told the line above and is now served more calls, so the last word on
   tools stops being false. No count in it: how many remain ends every tool result, and a number here is a second home. */
const REOPENED = "More tool calls are available after all. Carry on from what you have already read, "
  + "and check what you said you could not.";

const exhausted = (calls) => `spent all ${calls} call(s) reading and never answered.`;

export const rounds = async (values, model, opening, scope, onDelta, ask = askApi, held = {}) => {
  const { effort, cap, system, from } = held;
  /* One clock for the consult, not one per attempt, whatever the ladder does. */
  const signal = held.signal ?? AbortSignal.timeout(budgetMs());
  const calls = cap ?? plannedLimits().base;
  const messages = from?.messages ?? [{ role: "user", content: opening }];
  const used = from?.tools ?? [];
  const refused = from?.refused ?? [];
  const spent = Object.fromEntries(SPENT.map((key) => [key, from?.usage?.[key] ?? 0]));
  let thought = from?.thought ?? 0;
  const charge = (one) => {
    for (const key of SPENT) spent[key] += one.usage?.[key] ?? 0;
    thought += one.thought ?? 0;
  };
  /* What an attempt carried on needs, the reply it stopped on included: its tool calls were asked for and
     never served. Unenumerable, so a spread drops it and no logged row carries a transcript. */
  const carrying = (result, call, reply) => Object.defineProperty(result, "carried", {
    value: { messages, tools: used, refused, usage: spent, thought, calls: call, reply },
  });

  /* `left` counts the calls after the one that reads these results, so the result the last call
     reads is the one that says so. The log and the operator get the tool's own answer, the count being
     the model's to plan on. */
  const serve = async (reply, closing, call) => {
    const results = [];
    for (const one of reply.calls) {
      const ran = await runTool({ ...scope, signal, left: calls - call - 1 }, one.name, one.input);
      const said = ran.said ?? ran.text;
      used.push({ name: one.name, input: one.input, chars: said.length, error: Boolean(ran.error) });
      console.error(`codex:   ${one.name} ${detail(one.input)}${ran.error ? ` — ${said}` : ""}`);
      if (ran.error) refused.push(`${one.name} ${detail(one.input)}: ${said}`);
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
        ...(reply.text ? [{ type: "text", text: reply.text }] : []),
        ...reply.calls.map((one) => ({ type: "tool_use", id: one.id, name: one.name, input: one.input })),
      ],
    });
    messages.push({ role: "user", content: [...results, ...closing] });
  };

  if (from) await serve(from.reply, [{ type: "text", text: REOPENED }], from.calls);
  for (let call = (from?.calls ?? 0) + 1; ; call += 1) {
    const last = call === calls;
    console.error(`codex: call ${call} of ${calls}${used.length ? ` after ${used.length} tool call(s)` : ""}...`);
    const served = toolsFor(scope);
    const reply = await ask(values, model, messages, {
      onDelta, signal, effort, system,
      tools: last && !keepsTools() ? [] : served,
      serve: !last,
    });
    charge(reply);
    const spend = { usage: spent, thought, tools: used, refused, calls: call };
    if (!reply.calls.length) return carrying({ ...reply, ...spend }, call, reply);
    if (last) {
      if (!reply.text.trim()) {
        const unanswered = new Error(`${exhausted(calls)} Raise \`codex.roundsMax\` in ${configPath()}.`);
        unanswered.said = exhausted(calls);
        throw carrying(unanswered, call, reply);
      }
      /* Past the cap only while the cap stands: the reply is carried, so an attempt carried on serves these. */
      const unserved = reply.calls.map((one) => `${one.name} ${detail(one.input)} (past the call cap)`);
      return carrying({ ...reply, ...spend, refused: [...refused, ...unserved] }, call, reply);
    }
    await serve(reply, call + 1 === calls ? [{ type: "text", text: CLOSING }] : [], call);
  }
};

export const reviewed = async (values, model, opening, scope, onDelta, ask = askApi, held = {}) => {
  const { budget, ceiling } = held;
  held = { ...held, signal: held.signal ?? AbortSignal.timeout(budgetMs()) };
  const again = budget < ceiling;
  const quiet = () => {};
  /* The reading the first attempt paid for is what the rest of the budget was wanted for, so it carries on
     inside that conversation: a second one bought the same ceiling for the calls already spent plus it. */
  const climb = async (from) => {
    const rest = await rounds(values, model, opening, scope, onDelta, ask, { ...held, cap: ceiling, from });
    return { ...rest, attempt: 2, budget: ceiling, retriedFrom: budget, streamed: true };
  };
  let first;
  try {
    first = await rounds(values, model, opening, scope, again ? quiet : onDelta, ask, { ...held, cap: budget });
  } catch (error) {
    /* Only the one failure a larger budget can fix. Every other — a refused field, a 401, the
       consult's clock — would fail the same way twice and bill for it. */
    if (!again || !error.carried) throw error;
    console.error(`codex: ${error.said} Carrying that attempt on to ${ceiling} call(s).`);
    return climb(error.carried);
  }
  if (!again) return { ...first, attempt: 1, budget, streamed: true };
  if (!incompleteIn(first.text)) return { ...first, attempt: 1, budget, streamed: false };
  console.error(`codex: the reply says it could not check something inside ${budget} call(s); `
    + `carrying that attempt on to ${ceiling} before showing it.`);
  return climb(first.carried);
};

const detail = (input = {}) => input.path ?? input.key ?? (input.pattern ? `/${input.pattern}/` : "");
