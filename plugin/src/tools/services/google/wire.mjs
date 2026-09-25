/* The one way a byte leaves for Google: every request this verb makes, the token exchange among them,
   runs under the configured deadline and through the origin `google.endpoint` may replace. Nothing
   here prints; what a failure says is the caller's, which knows which credential and which method. */
import { userConfig } from "../../../resolve/config.mjs";
import { clockFor, deadlineOf, ranOut } from "../../../wire/request.mjs";
import { API, refuse, struck } from "./exits.mjs";

/** The origin that stands in for every Google API, upload and discovery host, when one is configured. */
export const endpoint = () => userConfig().google?.endpoint ?? null;

export const endpointed = (url) => {
  const replaced = endpoint();
  if (!replaced) return url;
  const at = new URL(url);
  return `${replaced.replace(/\/+$/u, "")}${at.pathname}${at.search}`;
};

export const withQuery = (url, query = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const one of Array.isArray(value) ? value : [value]) {
      if (one !== undefined && one !== null) params.append(key, typeof one === "object" ? JSON.stringify(one) : String(one));
    }
  }
  const tail = params.toString();
  if (!tail) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${tail}`;
};

/** One request under the deadline: the status, the headers and the body as bytes. */
export const reach = async (method, url, { headers = {}, body = null } = {}) => {
  const deadline = deadlineOf(null);
  let response = null;
  try {
    response = await fetch(url, { method, headers, signal: clockFor(deadline), ...(body === null ? {} : { body }) });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, ok: response.ok, headers: response.headers, bytes };
  } catch (dropped) {
    if (dropped.name === "TimeoutError") return refuse(API, `google: did not answer ${method} ${struck(url)}: ${ranOut(dropped, deadline)}`);
    if (response) throw dropped;
    return refuse(API, `google: cannot reach ${struck(url)} — ${struck(dropped.message)}.\n`
      + "  check the network, and `google.endpoint` in forge's configuration if one is set");
  }
};

export const jsonOf = (answer) => {
  const text = answer.bytes.toString("utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** A multipart/related body: the metadata as JSON, then the bytes. Drive's own shape for a simple upload. */
export const multipart = (metadata, bytes, mime) => {
  const boundary = `forge-google-${Date.now().toString(36)}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata ?? {})}\r\n`
    + `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: Buffer.concat([Buffer.from(head, "utf8"), bytes, Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]),
  };
};

const MIME = {
  ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv", ".json": "application/json",
  ".html": "text/html", ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".zip": "application/zip",
};

export const mimeOf = (path) => {
  const dot = path.lastIndexOf(".");
  return (dot >= 0 && MIME[path.slice(dot).toLowerCase()]) || "application/octet-stream";
};
