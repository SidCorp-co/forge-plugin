/* An upload is judged on the type its multipart part carries, so this CLI is what puts one there;
   the pairs are the types the tracker's refusal body lists, and the argument docs/cli/one-transport.md's. */
const UPLOAD_MIMES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** What bytes no row types are sent as: the tracker reads them and keeps the verdict. */
export const UNTYPED = "application/octet-stream";

const TEXT = "text/plain";

/* The last dot onwards, lowercased, a bare extension included. */
const named = (name) => {
  const held = String(name ?? "");
  const at = held.lastIndexOf(".");
  return at < 0 ? null : UPLOAD_MIMES[held.slice(at).toLowerCase()] ?? null;
};

const carriesText = (mime) => mime.startsWith("text/") || mime.endsWith("+xml");

const UTF8 = new TextDecoder("utf-8", { fatal: true });

/** Whether the bytes decode as UTF-8, which is what a way out reads to tell a text capture from a binary. */
export const decodesAsUtf8 = (bytes) => {
  try {
    UTF8.decode(bytes);
    return true;
  } catch {
    return false;
  }
};

/** Text is UTF-8 carrying no NUL: a looser test than the tracker's, so no type declared off it is one the tracker would call stricter. */
export const isText = (bytes) => Boolean(bytes) && !bytes.includes(0) && decodesAsUtf8(bytes);

/** The bytes first and the name among what they allow: a `.log` of text is text, and a `.txt` of binary is not. */
export const mimeFor = (name, bytes) => {
  const type = named(name);
  if (isText(bytes)) return type && carriesText(type) ? type : TEXT;
  return type && !carriesText(type) ? type : UNTYPED;
};
