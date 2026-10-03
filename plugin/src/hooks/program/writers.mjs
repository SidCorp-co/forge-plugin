// Every library call a program another language runs writes a file through, named once, so the cheap test a shell reading spends and the reader that says which argument a call writes cannot drift apart. how/writes.md.

/** Each call by its owner and its name, as patterns' sources, and the positions its API writes: a destination is written and a source only read, except where the call takes the source away, which a move and a rename do. `open` writes its file only under a `mode` opening with `w` or `a`, and only as the builtin, node's `fs`, or a module's that opens a file by name. */
export const CALLS = [
  { owner: String.raw`(?<![.\w])|\b(?:io|codecs|gzip|bz2|lzma|tarfile|fs|fsp|promises)\.`, name: "open(?:Sync)?", writes: [[0, "file"]], mode: [1, "mode"] },
  { owner: String.raw`\b`, name: "(?:append|write)FileSync|writeFile", writes: [[0, "path"]] },
  { owner: String.raw`\bDeno\.`, name: "write(?:TextFile|File)", writes: [[0, "path"]] },
  { owner: String.raw`\bBun\.`, name: "write", writes: [[0, "path"]] },
  { owner: String.raw`\bshutil\.`, name: "copy|copyfile|copy2", writes: [[1, "dst"]] },
  { owner: String.raw`\bshutil\.`, name: "move", writes: [[0, "src"], [1, "dst"]] },
  { owner: String.raw`\bos\.`, name: "replace|rename", writes: [[0, "src"], [1, "dst"]] },
  { owner: String.raw`\bos\.`, name: "symlink", writes: [[1, "dst"]] },
];

/** The methods a path writes itself through, `mode` saying where the one that needs a writing mode takes it. */
export const METHODS = [
  { name: String.raw`write_(?:text|bytes)` },
  { name: "open", mode: [0, "mode"] },
];

/* A call taking a mode is cheap to test by its name and a writing mode literal after it, whatever owns it; any other by the owner and name it is called by. */
const cheap = ({ owner = String.raw`\b`, name, mode }) =>
  (mode ? String.raw`(?:${name})\s*\([^)]*['"][wa]` : `${owner}(?:${name})`);

/** Either half of a write made by a library call, anywhere in a text, as a pattern's source: the cheap test, before the call reader says which argument the call writes. */
export const WRITE_CALLS = [...CALLS, ...METHODS].map(cheap).join("|");
