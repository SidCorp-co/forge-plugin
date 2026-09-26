// Add a question the owner answered to the project's precedent layer, where the project opted in, and
// never one the ask-decide gate answered itself. how/ask-precedent.md.

import { asksScope } from "../../src/resolve/settings.mjs";
import { asksRoom, decidedIds } from "../../src/asks/decided.mjs";
import { addPrecedent, layerPaths, ownerRow } from "../../src/asks/layer.mjs";

export const run = (ev) => {
  if (ev.tool_name !== "AskUserQuestion" || asksScope().value !== "decide") return;
  const room = asksRoom();
  const id = ev.tool_use_id;
  if (!room || !id) return;
  const decided = decidedIds(room);
  if (decided.unreadable || decided.ids.has(id)) return;
  const response = ev.tool_response && typeof ev.tool_response === "object" ? ev.tool_response : {};
  const answers = response.answers ?? {};
  const questions = Array.isArray(response.questions) ? response.questions : ev.tool_input?.questions ?? [];
  const paths = layerPaths(room);
  for (const [at, question] of questions.entries()) {
    addPrecedent(paths, ownerRow({ id: `${id}#${at}`, at: new Date().toISOString(), question,
      answer: answers[question?.question], notes: response.annotations?.[question?.question]?.notes ?? null }));
  }
};
