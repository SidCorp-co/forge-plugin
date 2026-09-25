/* `+upload`, `+download` and `+find`: the three Drive calls a run makes most, each composed from the
   carried methods and sent through the one invocation path, consent and preview included. */
import { existsSync } from "node:fs";
import { basename } from "node:path";

import { ACCOUNT_VALUES, PREVIEW_SWITCHES, invoke, optionsOf } from "../invocation.mjs";
import { VALIDATION, note, refuse, say } from "../exits.mjs";
import { pagingOf, parseFlags, requestFor } from "../request.mjs";
import { methodById } from "../surface.mjs";

const invalid = (message) => refuse(VALIDATION, `google ${message}`);

const printed = (answer) => {
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

const upload = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--parent", "--name", ...ACCOUNT_VALUES], switches: PREVIEW_SWITCHES, verb: "google +upload" });
  if (positionals.length !== 1) invalid("+upload takes one file: +upload <file> [--parent ID] [--name N]");
  const [file] = positionals;
  if (!existsSync(file)) invalid(`+upload: ${file} is not a file here.`);
  const body = { name: flags.name ?? basename(file), ...(flags.parent ? { parents: [flags.parent] } : {}) };
  const method = methodById("drive.files.create");
  printed(await invoke(method, requestFor(method, { body, upload: file }), optionsOf(flags, ["+upload", ...argv])));
};

const NATIVE = "application/vnd.google-apps.";
/* What a Google-native file becomes when no --mime is stated, and the extension that type is saved under. */
const EXPORTS = {
  document: ["text/plain", ".txt"],
  spreadsheet: ["text/csv", ".csv"],
  presentation: ["application/pdf", ".pdf"],
  drawing: ["image/png", ".png"],
};

const refuseTaken = (output) => invalid(`+download: ${output} already exists; choose another --output or move it first.`);

/* A name Drive holds is anybody's to set, so it names a file here and never a directory: only
   --output chooses where a download lands. */
const derivedName = (file, exported) => {
  const name = basename(String(file.name ?? "").replaceAll("\\", "/"));
  if (!name || name === "." || name === "..") {
    invalid(`+download: ${JSON.stringify(file.name)} is no file name to save under; name one with --output <file>.`);
  }
  return `${name}${exported?.extension ?? ""}`;
};

const exportMime = (file, asked) => {
  const kind = file.mimeType.slice(NATIVE.length);
  const mime = asked ?? EXPORTS[kind]?.[0];
  if (!mime) invalid(`+download: ${file.name} is a Google ${kind}, which has no default export: state one with --mime <type>.`);
  return { mime, extension: asked ? "" : EXPORTS[kind][1] };
};

/* A preview cannot know the file's type without the lookup it only prints, so it shows the download of
   a file that is not Google-native, and the export under --mime, the one case --mime applies to. */
const looked = async (id, options, flags) => {
  const get = methodById("drive.files.get");
  const file = await invoke(get, requestFor(get, { params: { fields: "id,name,mimeType" }, positionals: [id] }), options);
  if (!options.dryRun) return file;
  if (!flags.mime) note(`google +download: a dry run does not read ${id}'s type; a Google-native file is exported instead of downloaded.`);
  return { name: `<name of ${id}>`, mimeType: flags.mime ? `${NATIVE}<type of ${id}>` : `<mimeType of ${id}>` };
};

const download = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--output", "--mime", ...ACCOUNT_VALUES], switches: PREVIEW_SWITCHES, verb: "google +download" });
  if (positionals.length !== 1) invalid("+download takes one file id: +download <id> [--output F] [--mime M]");
  if (flags.output && existsSync(flags.output)) refuseTaken(flags.output);
  const options = optionsOf(flags, ["+download", ...argv]);
  const file = await looked(positionals[0], options, flags);
  const native = file.mimeType.startsWith(NATIVE);
  if (!native && flags.mime) invalid(`+download: --mime converts a Google-native file, and ${file.name} is ${file.mimeType}.`);
  const exported = native ? exportMime(file, flags.mime) : null;
  const output = flags.output ?? derivedName(file, exported);
  if (!flags.output && existsSync(output)) refuseTaken(output);
  const method = methodById(native ? "drive.files.export" : "drive.files.get");
  const params = native ? { mimeType: exported.mime } : {};
  printed(await invoke(method, requestFor(method, { params, positionals, output }), options));
};

const quoted = (text) => `'${text.replace(/\\/gu, "\\\\").replace(/'/gu, "\\'")}'`;

const find = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--page-limit", "--page-delay", ...ACCOUNT_VALUES],
    switches: ["--page-all", ...PREVIEW_SWITCHES], verb: "google +find" });
  if (positionals.length !== 1) invalid("+find takes one query, the text a file's name contains: +find <text>");
  const method = methodById("drive.files.list");
  const params = { q: `name contains ${quoted(positionals[0])} and trashed = false`,
    fields: "nextPageToken,files(id,name,mimeType,modifiedTime,parents)" };
  for (const flag of ["page-limit", "page-delay"]) {
    if (flags[flag] !== undefined && !flags["page-all"]) invalid(`+find: --${flag} shapes --page-all, which this call does not ask for.`);
  }
  printed(await invoke(method, requestFor(method, { params, paging: pagingOf(flags) }), optionsOf(flags, ["+find", ...argv])));
};

export const DRIVE_HELPERS = { "+upload": upload, "+download": download, "+find": find };
