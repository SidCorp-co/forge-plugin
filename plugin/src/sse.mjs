/* Every `data:` value of an SSE body, each trimmed and the set concatenated. That is what both transports have always done and it is deliberately *not* the wire format's own dispatch, which strips one leading space and joins with a line feed — a consumer needing the standard's answer is asking for a different function, not this one with a fix. Why the width is derived and where the home stops: docs/cli/the-primitives.md. */
export const DATA_FIELD = "data:";
export const sseData = (text) =>
  text
    .split("\n")
    .filter((line) => line.startsWith(DATA_FIELD))
    .map((line) => line.slice(DATA_FIELD.length).trim())
    .join("");
