// Batch translation with a verification gate on every string.

import * as cta from "../text/cta.mjs";
import * as placeholders from "../text/placeholders.mjs";
import { BATCH_TASK, systemPrompt } from "../text/prompts.mjs";
import { BARE_HINT, PLACEHOLDER_HINT } from "../vi-text.mjs";
import { chunkItems, err, parseJsonObject } from "../util.mjs";

export const MAX_CHARS = 6000;
export const MAX_ITEMS = 40;

/** What the model sees. With contexts, each string carries its i18n key path.
 *
 *  The key disambiguates strings a translator cannot read out of context: "save" under
 *  `common.buttons` is a Lưu button, under `billing` it may be a discount. */
function shape(batch, contexts) {
  const out = {};
  for (const [key, text] of batch) {
    out[String(key)] = contexts ? { k: contexts.get(String(key)) ?? "", s: text } : text;
  }
  return out;
}

async function ask(client, system, task, payload, temperature) {
  const user = `${task}\n\n${JSON.stringify(payload, null, 2)}`;
  return parseJsonObject(await client.chat(system, user, { temperature }));
}

/** Every gate a candidate has to clear before it may be written. */
function rejected(key, source, candidate, gates) {
  const { verify, skipVerify, bareCta, ctaIndex } = gates;
  if (!skipVerify.has(key) && verify(source, candidate)) return true;
  return bareCta.has(key) && !cta.isBare(candidate, ctaIndex);
}

/** Second chance for one string, with the rule it broke restated. */
async function translateOne(client, system, task, entry, gates) {
  const { key, source, temperature, contexts } = entry;
  const bare = gates.bareCta.has(key);
  const verify = gates.skipVerify.has(key) ? null : gates.verify;
  const required = [...placeholders.extract(source).keys()].sort();
  let hint = required.length ? PLACEHOLDER_HINT.replace("%s", required.join(", ")) : "";
  if (bare) hint += BARE_HINT;

  let answer;
  try {
    answer = await ask(client, system, task + hint, shape([[key, source]], contexts), temperature);
  } catch (error) {
    return { reason: `gateway error: ${error.message}` };
  }
  const candidate = answer[String(key)];
  if (typeof candidate !== "string" || !candidate.trim()) {
    return { reason: "model returned nothing for this key" };
  }
  const problem = verify ? verify(source, candidate) : null;
  if (problem) return { reason: `rejected after retry: ${problem}` };
  if (bare && !cta.isBare(candidate, gates.ctaIndex)) {
    return { reason: `CTA still carries an object after retry ("${candidate}")` };
  }
  return { candidate };
}

/** Translate [key, text] pairs. Returns { results, problems }.
 *
 *  A key only reaches `results` if its translation carries exactly the placeholders of its source.
 *  Anything that fails twice is left out and reported, so a broken string never silently lands in a
 *  locale file. */
export async function translateItems(client, items, options = {}) {
  const {
    kind = "ui",
    task = BATCH_TASK,
    glossary,
    temperature = 0.3,
    verbose = false,
    verify = placeholders.diff,
    register,
    region,
    contexts = null,
    skipVerify = new Set(),
    bareCta = new Set(),
    ctaIndex = null,
  } = options;
  const system = systemPrompt(kind, { glossary, register, region, keyContext: Boolean(contexts) });
  const gates = { verify, skipVerify, bareCta, ctaIndex };
  const results = new Map();
  const problems = [];
  const retries = [];

  const batches = chunkItems(items, MAX_CHARS, MAX_ITEMS);
  for (const [index, batch] of batches.entries()) {
    if (verbose) err(`  batch ${index + 1}/${batches.length} (${batch.length} strings)`);
    let answer;
    try {
      answer = await ask(client, system, task, shape(batch, contexts), temperature);
    } catch (error) {
      // One bad batch must not lose the rest of the file.
      err(`  batch ${index + 1} failed (${error.message}) — retrying strings one by one`);
      retries.push(...batch);
      continue;
    }
    for (const [key, source] of batch) {
      const candidate = answer[String(key)];
      if (typeof candidate !== "string" || !candidate.trim()) retries.push([key, source]);
      else if (rejected(key, source, candidate, gates)) retries.push([key, source]);
      else results.set(key, candidate);
    }
  }

  for (const [key, source] of retries) {
    const outcome = await translateOne(client, system, task, { key, source, temperature, contexts }, gates);
    if (outcome.candidate === undefined) problems.push({ key, reason: outcome.reason, source });
    else results.set(key, outcome.candidate);
  }

  return { results, problems };
}
