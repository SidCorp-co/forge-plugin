/* `forge project` — the projects themselves, and this CLI's one verb outside any project's scope.
   Every other verb acts inside the project the checkout names; these act on the records that
   naming picks between. Why deletion is not among them: docs/cli/doctor.md. */
import { deployFrom, deployRows, deployed } from "../tracker/project-config.mjs";
import { didYouMean } from "../suggest.mjs";
import { exclusive, flags, partition, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { projectIdOf, scoped, write } from "../tracker/rest.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { SLUG_WIDTH } from "./knowledge.mjs";

const BOOLEAN = ["--archive", "--unarchive"];
const ACTS = ["set", "archive", "unarchive"];

/* The tracker's branch columns are not among them: this CLI reads those names by property access
   and prints none, so a flag naming one would be the first place it typed one. The settings screen
   the tracker serves is where a branch is chosen. */
const FIELDS = ["name", "description"];

const USAGE = [
  usageOf("project"),
  "The projects this credential sees, and the one verb that acts on a project as a record rather",
  "than inside one. Every act goes through the tracker's own route for it.",
  "",
  "  (no argument)        one line per project: slug, name, and whether it is archived",
  "  new --name N --slug S  a project, created; its slug is printed",
  "  <slug>               that project's record, its test credentials withheld",
  "  <slug> --set k=v     one field, updated. It takes: " + FIELDS.join(", "),
  "  <slug> --archive     archived, which is reversible and keeps everything behind it",
  "  <slug> --unarchive   the archive, reversed",
  "",
  "There is no delete. A project's issues, comments, attachments and knowledge hang off it and the",
  "tracker's own route takes them with it, so the one act here with nothing behind it is refused",
  "and --archive is what a project that should not be listed gets.",
].join("\n");

const NO_DELETE = "project: a project is not deleted from here. Its issues, comments, attachments and"
  + " knowledge hang off it, and nothing was sent — archive it instead, which is reversible:\n"
  + "  forge project <slug> --archive";

/* Archived included, because this listing is what names one to unarchive. */
const listed = async () => {
  const answer = await scoped("forge_projects", { action: "list", archived: 1 });
  return answer?.projects ?? [];
};

const idFor = async (slug) => {
  const held = await projectIdOf(slug, { archived: true });
  if (!held.id) {
    fail(didYouMean("project", slug, held.seen.sort(), "`forge project` lists every project this credential sees."));
  }
  return held.id;
};

/** The record, with the deploy read through the seat that tells a host from a secret: a project row
 *  carries the test credentials whole, and printing the row would print them. */
const recordLines = (project) => {
  const deploy = deployFrom(project?.previewDeploy);
  const out = [
    `slug: ${project?.slug}`,
    `name: ${project?.name ?? "unset"}`,
    `description: ${project?.description ?? "unset"}`,
    `role: ${project?.role ?? "not stated"}`,
    `created: ${(project?.createdAt ?? "").slice(0, 10) || "not stated"}`,
    `archived: ${project?.archivedAt ? (project.archivedAt ?? "").slice(0, 10) : "no"}`,
  ];
  if (!deployed(deploy)) return [...out, "staging deploy: none configured"];
  out.push(`staging deploy: ${deploy.urls.length} host(s)`);
  for (const row of deployRows(deploy)) out.push(`  ${row.label}: ${row.detail}`);
  if (deploy.withheld.length) {
    out.push(`  held, not printed: ${deploy.withheld.map((one) => one.label).join(", ")}`);
  }
  return out;
};

const created = async (asked) => {
  const missing = ["name", "slug"].filter((one) => asked[one] === undefined);
  if (missing.length) {
    fail(`project new: a project needs ${missing.map((one) => `--${one}`).join(" and ")}, and nothing `
      + `was sent. ${usageOf("project")}`);
  }
  const answer = await write("forge_projects", { action: "create", data: { name: asked.name, slug: asked.slug } });
  return [`created: ${answer?.project?.slug ?? asked.slug}`, ...recordLines(answer?.project)];
};

const updated = async (slug, pairs) => {
  const data = {};
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at < 1) fail(`project: --set takes one field and its value joined by \`=\`, not \`${pair}\`.`);
    const field = pair.slice(0, at);
    if (!FIELDS.includes(field)) {
      fail(`${didYouMean("field of a project", field, FIELDS)} A branch is chosen on the tracker's own`
        + " settings screen, and nothing was sent.");
    }
    data[field] = pair.slice(at + 1);
  }
  const projectRef = await idFor(slug);
  const answer = await write("forge_projects", { action: "update", projectRef, data });
  return [`set: ${Object.keys(data).join(", ")}`, ...recordLines(answer?.project)];
};

const archived = async (slug, action) => {
  const projectRef = await idFor(slug);
  const answer = await write("forge_projects", { action, projectRef });
  return [`${action}d: ${slug}`, ...recordLines(answer?.project ?? { slug })];
};

const routed = async (slug, asked) => {
  if (asked.archive) return archived(slug, "archive");
  if (asked.unarchive) return archived(slug, "unarchive");
  if (asked.set) return updated(slug, asked.set);
  const answer = await scoped("forge_projects", { action: "read", projectRef: await idFor(slug) });
  return recordLines(answer?.project);
};

export const project = async (argv) => {
  if (wantsHelp(argv)) return console.log(USAGE);
  /* Before the parser, which would answer the wrong question about it: the flag is refused with the
     act that replaces it, and a usage row offering a flag nothing does is a row that invites the call. */
  if (argv.includes("--delete")) fail(NO_DELETE);
  const usage = usageOf("project");
  const { values: pairs, rest } = pullRepeated(argv, "--set", "project", { usage });
  const { positionals, flagArgv } = partition(rest, BOOLEAN, { verb: "project", usage });
  const asked = { ...flags(flagArgv, "project", BOOLEAN, { usage }), ...(pairs.length ? { set: pairs } : {}) };
  const acts = exclusive(asked, ACTS, "project", "acts on one record and a call takes one");
  const [first, ...extra] = positionals;
  if (extra.length) fail(`project: one project at a time, not \`${positionals.join(" ")}\`. ${usage}`);
  if (first === "new") {
    if (acts.length) fail(`project new: a project being created is not one being changed. ${usage}`);
    return (await created(asked)).forEach((said) => console.log(said));
  }
  /* A `--set` on the list rather than on a project: nothing names what would be written. */
  if (!first) {
    if (acts.length) {
      fail(`project: ${acts.map((one) => `--${one}`).join(" and ")} acts on one project and none is `
        + `named. Nothing was sent: ${usage}`);
    }
    for (const one of await listed()) {
      console.log(`${String(one.slug).padEnd(SLUG_WIDTH)} ${one.name}${one.archivedAt ? "  (archived)" : ""}`);
    }
    return undefined;
  }
  return (await routed(first, asked)).forEach((said) => console.log(said));
};

project.answersHelp = true;
