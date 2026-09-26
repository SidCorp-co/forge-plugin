/* A streamed Messages answer read whole: the text, the tool calls with their arguments, the usage and
   the stop reason, with each text delta handed out as it lands. Streamed rather than asked for whole
   because a gateway behind an edge proxy cuts a request that stays silent past its timeout, and a
   model reasoning at a high effort is silent for longer than that; frames keep the connection alive.
   Shared by the consult and by any bounded model call. */
import { FRAME_END, sseData } from "./sse.mjs";
import { parsedOr } from "./request.mjs";

const ERROR_CHARS = 400;

const frameEvent = (frame) => {
  const data = sseData(frame);
  return !data || data === "[DONE]" ? null : parsedOr(data);
};

/* The deltas are handed out as they land; the whole text is still returned, because the log wants the answer and not the frames. */
export const consume = async (body, onDelta) => {
  const decoder = new TextDecoder();
  let buffered = "";
  let text = "";
  let usage = null;
  let stop = null;
  let thought = 0;
  const open = new Map();
  const calls = [];
  const absorb = (frame) => {
    const event = frameEvent(frame);
    if (!event) return;
    if (event.type === "error") {
      throw new Error(`gateway streamed an error: ${JSON.stringify(event.error).slice(0, ERROR_CHARS)}`);
    }
    if (event.type === "message_start") usage = event.message?.usage ?? usage;
    if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
      open.set(event.index, { id: event.content_block.id, name: event.content_block.name, json: "" });
    }
    if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
      const held = open.get(event.index);
      if (held) held.json += event.delta.partial_json ?? "";
    }
    if (event.type === "content_block_stop" && open.has(event.index)) {
      const held = open.get(event.index);
      open.delete(event.index);
      calls.push({ id: held.id, name: held.name, input: parsedInput(held.json) });
    }
    /* Thinking is counted, not shown: the reviewer's reasoning is not the review, and the terminal
       is where the review goes. The count is what tells a reader where the tokens went. */
    if (event.type === "content_block_delta" && event.delta?.type === "thinking_delta") {
      thought += (event.delta.thinking ?? "").length;
    }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text;
      onDelta(event.delta.text);
    }
    if (event.type === "message_delta") {
      stop = event.delta?.stop_reason ?? stop;
      usage = { ...usage, ...event.usage };
    }
  };
  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });
    const frames = buffered.split(FRAME_END);
    buffered = frames.pop() ?? "";
    for (const frame of frames) absorb(frame);
  }
  /* The decoder is flushed and the tail is absorbed: a stream whose last frame arrives without a
     blank line after it would otherwise be dropped, and it is the frame carrying stop_reason. */
  buffered += decoder.decode();
  for (const frame of buffered.split(FRAME_END)) absorb(frame);
  return { text: text.trim(), usage, stop, calls, thought };
};

/** A tool call whose arguments did not arrive whole is answered as one that asked for nothing, so
 *  the executor refuses it in words rather than the loop throwing. */
const parsedInput = (json) => {
  try {
    const held = json.trim() ? JSON.parse(json) : {};
    return held && typeof held === "object" && !Array.isArray(held) ? held : {};
  } catch {
    return {};
  }
};
