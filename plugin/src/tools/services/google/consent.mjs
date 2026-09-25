/* Which writes owe `--yes`, as one table rather than a list of method ids: every method of a served
   service answers, so what decides consent has to be a shape a method Google adds next year already
   has. A row names the methods it can fire on and, where the request decides, the condition; the free
   list names the writes that owe nothing and says why; any other write owes it too, because a write
   nobody classified is one nobody judged. docs/cli/google.md. */

const lastWord = (id) => id.split(".").at(-1);

const under = (...prefixes) => ({ id }) => prefixes.some((one) => id === one || id.startsWith(`${one}.`));

const named = (...ids) => ({ id }) => ids.includes(id);

/* A last word that is, or begins with, one of these takes something away that no call puts back. */
const REMOVES = ["batchDelete", "delete", "clear", "batchClear", "emptyTrash", "remove", "revoke", "stop",
  "endActiveConference", "obliterate", "disable"];

const attended = (event) => Array.isArray(event?.attendees) && event.attendees.length > 0;

const ADDRESS = /[^\s@]+@[^\s@]+\.[^\s@]+/u;

/* Sheets kinds that write over cells already holding something: `updateCells` clears what its mask
   names in every cell of the range its rows do not cover, whatever the mask is. */
const OVERWRITES_CELLS = ["findReplace", "updateCells", "repeatCell", "pasteData", "copyPaste", "cutPaste", "autoFill",
  "textToColumns", "trimWhitespace", "randomizeRange"];

const takesAway = (request) => Object.keys(request ?? {}).some((kind) => /^(delete|clear|replace)/u.test(kind)
  || OVERWRITES_CELLS.includes(kind));

/* Fields of an update that decide who can reach the thing it updates. */
const OPENS = {
  "drive.drives.update": (body) => body?.restrictions !== undefined,
  "drive.teamdrives.update": (body) => body?.restrictions !== undefined,
  "drive.revisions.update": (body) => ["published", "publishAuto", "publishedOutsideDomain"].some((one) => body?.[one] !== undefined),
  "meet.spaces.patch": (body) => body?.config?.accessType !== undefined || body?.config?.entryPointAccess !== undefined,
};

export const READS_THE_EVENT = ["calendar.events.patch", "calendar.events.move"];

const INVITES = ["calendar.events.insert", "calendar.events.import", "calendar.events.quickAdd", ...READS_THE_EVENT];

/* First row that fires wins, so a delete of a permission says it deletes rather than that it changes access. */
export const CONSENT = [
  { owes: "deletes", names: ({ entry }) => entry.http === "DELETE" },
  { owes: "trashes", names: ({ id }) => lastWord(id) === "trash" },
  { owes: "trashes", names: named("drive.files.update"), where: "its body sets trashed",
    when: ({ request }) => request.body?.trashed === true },
  { owes: "changes who has access", names: under("drive.permissions", "calendar.acl", "gmail.users.settings.delegates",
    "meet.spaces.members", "drive.accessproposals.resolve", "calendar.calendars.transferOwnership") },
  { owes: "changes who has access", names: ({ id }) => Object.hasOwn(OPENS, id), where: "its body changes who can reach it",
    when: ({ method, request }) => OPENS[method.id](request.body) },
  { owes: "changes where mail goes", names: under("gmail.users.settings.forwardingAddresses", "gmail.users.settings.filters",
    "gmail.users.settings.sendAs", "gmail.users.settings.updateAutoForwarding") },
  { owes: "sends mail", names: named("gmail.users.messages.send", "gmail.users.drafts.send") },
  { owes: "removes", names: ({ id }) => REMOVES.some((one) => lastWord(id).startsWith(one)) },
  { owes: "acts on an approval others are waiting on", names: under("drive.approvals") },
  { owes: "overwrites content", names: ({ entry, id }) => entry.http === "PUT"
    || ["sheets.spreadsheets.values.batchUpdate", "sheets.spreadsheets.values.batchUpdateByDataFilter",
      "drive.comments.update", "drive.replies.update"].includes(id) },
  { owes: "overwrites a file's content", names: ({ entry }) => entry.http === "PATCH" && Boolean(entry.upload),
    where: "it uploads", when: ({ request }) => Boolean(request.upload) },
  { owes: "invites to an event", names: named(...INVITES), where: "it names attendees",
    when: ({ method, request, event }) => attended(request.body) || attended(event)
      || (method.id === "calendar.events.quickAdd" && ADDRESS.test(String(request.params?.text ?? ""))) },
  { owes: "removes or overwrites content in its batch", names: named("sheets.spreadsheets.batchUpdate", "docs.documents.batchUpdate"),
    where: "a request in it deletes, clears, replaces or writes over cells",
    when: ({ request }) => Array.isArray(request.body?.requests) && request.body.requests.some(takesAway) },
];

/* The writes that owe nothing, each group with the reason a person need not be asked. */
export const FREE = {
  "only adds": ["drive.comments.create", "drive.replies.create", "drive.drives.create", "drive.teamdrives.create",
    "drive.files.copy", "drive.files.create", "sheets.spreadsheets.create", "sheets.spreadsheets.sheets.copyTo",
    "sheets.spreadsheets.values.append", "docs.documents.create", "gmail.users.drafts.create", "gmail.users.labels.create",
    "gmail.users.messages.import", "gmail.users.messages.insert", "gmail.users.settings.cse.identities.create",
    "gmail.users.settings.cse.keypairs.create", "calendar.calendarList.insert", "calendar.calendars.insert", "meet.spaces.create"],
  "reads through a POST": ["drive.files.download", "sheets.spreadsheets.developerMetadata.search",
    "sheets.spreadsheets.getByDataFilter", "sheets.spreadsheets.values.batchGetByDataFilter", "calendar.freebusy.query"],
  "is undone by a call of its own": ["drive.drives.hide", "drive.drives.unhide", "drive.files.modifyLabels",
    "gmail.users.messages.modify", "gmail.users.messages.batchModify",
    "gmail.users.messages.untrash", "gmail.users.threads.modify", "gmail.users.threads.untrash", "gmail.users.labels.patch",
    "gmail.users.settings.cse.keypairs.enable", "gmail.users.settings.cse.identities.patch", "calendar.calendarList.patch",
    "calendar.calendars.patch"],
  "watches for changes": ["drive.changes.watch", "drive.files.watch", "gmail.users.watch", "calendar.calendarList.watch",
    "calendar.events.watch", "calendar.settings.watch"],
};

const freeReason = (id) => Object.keys(FREE).find((reason) => FREE[reason].includes(id)) ?? null;

export const UNCLASSIFIED = "writes in a shape the consent table does not name";

const reads = (method) => method.entry.http === "GET";

/** The rows that can fire on this method, in order: empty for a read and for a write the table frees. */
export const rowsFor = (method) => (reads(method) ? [] : CONSENT.filter((row) => row.names(method)));

/** Whether the table says anything of this method: a read, a row that names it, or the free list. */
export const classified = (method) => reads(method) || rowsFor(method).length > 0 || freeReason(method.id) !== null;

/** Why this request is refused without `--yes`, or null. `event` is what invocation.mjs read of it, where the call is in READS_THE_EVENT. */
export const consentOwed = (method, request, event = null) => {
  if (reads(method)) return null;
  const rows = rowsFor(method);
  const fired = rows.find((row) => !row.when || row.when({ method, request, event }));
  if (fired) return fired.owes;
  return rows.length || freeReason(method.id) ? null : UNCLASSIFIED;
};

/** What a method owes, as a level's listing says it: null for nothing, the reason, or each reason with its condition. */
export const consentSaid = (method) => {
  if (reads(method)) return null;
  const rows = rowsFor(method);
  if (!rows.length) return freeReason(method.id) ? null : UNCLASSIFIED;
  const said = [];
  for (const row of rows) {
    said.push(row.when ? `${row.owes} where ${row.where}` : row.owes);
    if (!row.when) break;
  }
  return said.join("; ");
};
