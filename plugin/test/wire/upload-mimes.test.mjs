/* The type an upload's part carries is read from its bytes before its name (ISS-80), and the tracker
   judges the bytes against it. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DECLARES } from "../../src/tracker/routes.mjs";
import { UNTYPED, isText, mimeFor } from "../../src/wire/upload-mimes.mjs";

/* Written out here rather than read back off the map, which would be the map judging itself: the
   extension each type the tracker's refusal body lists goes by. A name this map types differently is
   a name that went up before and is refused now, and nothing else says so. */
const TRACKER_TYPES = {
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

describe("the type an upload's part carries", () => {
  const TEXT = Buffer.from("gate output\nline two\n");
  const BINARY = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe, 0x00, 0x01]);
  const textual = (mime) => mime.startsWith("text/") || mime.endsWith("+xml");

  it("is the extension's own for every name the map holds, where the bytes allow that type", () => {
    for (const [ext, mime] of Object.entries(TRACKER_TYPES)) {
      const bytes = textual(mime) ? TEXT : BINARY;
      assert.equal(mimeFor(`shot${ext}`, bytes), mime, ext);
      assert.equal(mimeFor(`SHOT${ext.toUpperCase()}`, bytes), mime, `${ext} upper-cased`);
    }
    assert.equal(DECLARES.forge_uploads.extensions, undefined,
      "the set the tracker takes is read off its refusal, and no copy of it is kept here");
  });

  /* ISS-80: twelve plain-text `.log` files were refused as a binary because the name decided. */
  it("is text/plain for text under a name the map lacks, or maps to a type text cannot be", () => {
    for (const name of ["gate-run.log", "noextension", "harness.mjs", "answer.json", "shot.png", ".log"]) {
      assert.equal(mimeFor(name, TEXT), "text/plain", name);
    }
  });

  /* ISS-2367: gzip bytes named `.txt` went up as text and were refused for the bytes. */
  it("is the untyped stream for bytes that are not text under a text name or under none", () => {
    for (const name of ["gate-run.log", "probe-gz.txt", "notes.md", "page.html", "noextension", "archive.tar.gz"]) {
      assert.equal(mimeFor(name, BINARY), UNTYPED, name);
    }
    assert.equal(mimeFor("gate.txt", undefined), UNTYPED, "no bytes read is no text claimed");
  });

  it("reads a NUL or bytes that are not UTF-8 as not text, and tabs, CR and ESC as text", () => {
    assert.equal(isText(Buffer.from("a\tb\r\n\u001b[31mred\u001b[0m\n")), true);
    assert.equal(isText(Buffer.from("naïve café — ok\n")), true, "UTF-8 beyond ASCII is text");
    assert.equal(isText(Buffer.from("a\u0000b\n")), false, "a NUL is never text");
    assert.equal(isText(Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a])), false, "Latin-1 is not UTF-8");
    assert.equal(isText(Buffer.alloc(0)), true, "an empty file is text");
  });
});
