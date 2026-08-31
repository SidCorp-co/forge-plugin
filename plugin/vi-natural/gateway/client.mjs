// OpenAI-compatible chat client. No dependencies beyond node's own fetch.
//
// Every completion is streamed, because the gateway sits behind Cloudflare and Cloudflare closes a
// connection whose origin has said nothing for ~100 seconds. `timeout` is therefore the longest
// silence tolerated BETWEEN chunks, not a budget for the whole call — see VI-NATURAL.md.

import { CliError, err } from "../util.mjs";

// 520/522/524 are Cloudflare's own: the origin misbehaved or went quiet. They are worth retrying
// and are in no OpenAI error table, which is why a 524 once aborted a run instead of retrying.
const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 520, 522, 524]);
// Cloudflare rejects a default agent string with 1010.
const USER_AGENT = "vi-natural/2.0";
const NOTE_EVERY_MS = 30_000;

class StreamBroken extends Error {}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Read one chunk or give up waiting. An idle timer, restarted per chunk. */
async function nextChunk(reader, timeout) {
  let timer;
  const expire = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StreamBroken(`no data for ${timeout}s`)), timeout * 1000);
  });
  try {
    return await Promise.race([reader.read(), expire]);
  } finally {
    clearTimeout(timer);
  }
}

export class Client {
  constructor(config, { timeout = 120, retries = 3, verbose = false } = {}) {
    this.config = config;
    this.timeout = timeout;
    this.retries = retries;
    this.verbose = verbose;
    this.calls = 0;
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.reasoningTokens = 0;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Accept: "text/event-stream",
    };
  }

  body(system, user, temperature, maxTokens, jsonMode) {
    const payload = {
      model: this.config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      stream: true,
      // Usage arrives in a final chunk carrying no choices; without this the streamed call reports
      // nothing and usageNote lies.
      stream_options: { include_usage: true },
    };
    const { effort } = this.config;
    if (effort) payload.reasoning_effort = effort;
    if (jsonMode) payload.response_format = { type: "json_object" };
    if (maxTokens) payload.max_tokens = maxTokens;
    return payload;
  }

  /** One completion. Returns the assistant text with reasoning stripped out. */
  async chat(system, user, { temperature = 0.3, maxTokens = null, jsonMode = true } = {}) {
    const payload = this.body(system, user, temperature, maxTokens, jsonMode);
    let last = null;
    for (let attempt = 0; attempt < this.retries; attempt += 1) {
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 400);
          last = new CliError(`gateway returned ${response.status}: ${detail}`);
          if (!RETRY_STATUS.has(response.status)) throw last;
        } else {
          return await this.consume(response);
        }
      } catch (error) {
        // Raised deliberately: a status in no retry table, or a reply that cannot be used. Sleeping
        // twice to be told the same thing is the cost of reading it as a transport failure.
        if (error instanceof CliError) throw error;
        last = new CliError(`gateway request failed: ${error.message}`);
      }
      if (attempt < this.retries - 1) await sleep(2 ** attempt * 1000);
    }
    throw last;
  }

  /** Read the SSE body and return the assistant text.
   *
   *  Only `delta.content` is kept. The gateway also streams `delta.reasoning_content` — the model
   *  thinking out loud, in English — and concatenating the two would ship chain-of-thought into a
   *  locale file. */
  async consume(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const pieces = [];
    let usage = null;
    let done = false;
    let buffered = "";
    const started = Date.now();
    let noted = started;

    for (;;) {
      const chunk = await nextChunk(reader, this.timeout);
      if (chunk.done) break;
      if (this.verbose && Date.now() - noted > NOTE_EVERY_MS) {
        noted = Date.now();
        err(`    …${Math.round((noted - started) / 1000)}s, ${pieces.join("").length} chars`);
      }
      buffered += decoder.decode(chunk.value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const body = line.slice(5).trim();
        if (body === "[DONE]") {
          done = true;
          break;
        }
        let event;
        try {
          event = JSON.parse(body);
        } catch {
          continue; // a keep-alive or a comment, not a chunk
        }
        if (event.error) throw new CliError(`gateway error: ${JSON.stringify(event.error).slice(0, 300)}`);
        if (event.usage) usage = event.usage;
        for (const choice of event.choices ?? []) {
          const text = (choice.delta ?? choice.message ?? {}).content;
          if (text) pieces.push(text);
        }
      }
      if (done) break;
    }
    reader.cancel().catch(() => {});

    const content = pieces.join("");
    if (!done && !content) throw new StreamBroken("stream ended before any content arrived");
    if (!content.trim()) throw new CliError("model returned empty content");
    // Truncated mid-answer: the JSON will not parse and a half-written batch is worse than a
    // retried one.
    if (!done) throw new StreamBroken(`stream ended after ${content.length} chars, before [DONE]`);
    this.record(usage ?? {});
    return content;
  }

  record(usage) {
    this.calls += 1;
    this.promptTokens += usage.prompt_tokens ?? 0;
    this.completionTokens += usage.completion_tokens ?? 0;
    this.reasoningTokens += (usage.completion_tokens_details ?? {}).reasoning_tokens ?? 0;
  }

  async models() {
    const url = `${this.config.baseUrl}/models`;
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new CliError(`cannot reach ${url}: ${error.message}`);
    }
    if (!response.ok) throw new CliError(`gateway returned ${response.status} listing models`);
    return (await response.json()).data ?? [];
  }

  // Reasoning tokens are already inside completion_tokens; naming them separately is how you see
  // what raising the effort actually costs.
  usageNote() {
    const note = `${this.calls} call(s), ${this.promptTokens} in / ${this.completionTokens} out tokens`;
    return this.reasoningTokens ? `${note} (${this.reasoningTokens} reasoning)` : note;
  }
}
