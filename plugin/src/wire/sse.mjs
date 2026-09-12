/* The framing of a Server-Sent Events body, which is the wire format's and not any provider's: one home for the field name and for the event boundary beside it, and two readers over them because two questions are asked of a body. The boundary is exported because a reader that cannot take a whole body still has to cut one: `consume` in codex-api.mjs splits a growing buffer as chunks land. `sseEvents` answers each event's own payload, in order — a notification sent before a result is two JSON documents, and a caller parsing them needs them apart. `sseData` answers the whole body's payloads concatenated, which is what both transports have always asked for; it is deliberately *not* the wire format's own dispatch, which strips one leading space and joins with a line feed, so a consumer needing the standard's answer is asking for a different function and not this one with a fix. What a caller then does with a payload — parse it, read a sentinel — stops here, being the provider's own reading of its stream. Why the width is derived, and why the gateway client borrows the field name without a reader: docs/cli/the-primitives.md. */
export const DATA_FIELD = "data:";
export const FRAME_END = /\r?\n\r?\n/u;

export const sseEvents = (text) => text
  .split(FRAME_END)
  .map((frame) => frame
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(DATA_FIELD))
    .map((line) => line.slice(DATA_FIELD.length).trim())
    .join(""))
  .filter(Boolean);

export const sseData = (text) => sseEvents(text).join("");
