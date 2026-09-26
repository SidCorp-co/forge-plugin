/* An upload is judged on the type its multipart part carries, so this CLI is what puts one there;
   the pairs are the tracker's own at 29977155, and the argument docs/cli/one-transport.md's. */
export const UPLOAD_MIMES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** What a name outside the map is sent as; the tracker's allowlist holds it, so its answer is the
 *  refusal and nothing here anticipates one. */
export const UNTYPED = "application/octet-stream";

/** Read the way the tracker reads it: the last dot onwards, lowercased, a bare extension included. */
export const mimeForName = (name) => {
  const held = String(name ?? "");
  const at = held.lastIndexOf(".");
  return (at < 0 ? null : UPLOAD_MIMES[held.slice(at).toLowerCase()]) ?? UNTYPED;
};
