/* The two ends of one request to the fake tracker that hold no state of its own: the body read off
   the wire, and the answer written when serving it threw. */

const raw = (request) =>
  new Promise((done) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => done(Buffer.concat(chunks)));
  });

/* The one part an upload sends, read off the wire rather than off the caller's intent: the name
   and the type the tracker judges are the part's own, so a case can assert on what arrived. */
const parted = (held, boundary) => {
  const text = held.toString("latin1");
  const open = text.indexOf(`--${boundary}\r\n`) + boundary.length + 4;
  const head = text.slice(open, text.indexOf("\r\n\r\n", open));
  const bytes = held.subarray(text.indexOf("\r\n\r\n", open) + 4, text.lastIndexOf(`\r\n--${boundary}--`));
  return {
    field: /name="([^"]*)"/u.exec(head)?.[1] ?? null,
    name: /filename="([^"]*)"/u.exec(head)?.[1] ?? null,
    mime: /content-type:\s*(\S+)/iu.exec(head)?.[1] ?? null,
    bytes,
  };
};

export const body = async (request) => {
  const held = await raw(request);
  const boundary = /boundary=([^;]+)/u.exec(request.headers["content-type"] ?? "")?.[1];
  if (boundary) return { multipart: parted(held, boundary) };
  const text = held.toString("utf8");
  return text ? JSON.parse(text) : {};
};

/** The request handler around `serve`, which is handed a holder to put the request's call row in.
 *  A request left with no response is a case that cannot fail: the verb waits on the socket for its
 *  whole deadline and the suite says nothing (ISS-122). So a throw anywhere in serving is answered,
 *  naming this fixture, the tool `toolOf` says that call had asked for, and what was thrown. */
export const answeringThrows = (serve, toolOf) => async (request, response) => {
  const mine = { call: null };
  try {
    await serve(request, response, mine);
  } catch (thrown) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const tool = (mine.call && toolOf(mine.call)) ?? "no tool yet";
    const message = `fakeTracker threw answering ${tool} at ${request.method} ${request.url}: `
      + `${thrown?.message ?? String(thrown)}`;
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ code: "FIXTURE_THREW", message }));
  }
};
