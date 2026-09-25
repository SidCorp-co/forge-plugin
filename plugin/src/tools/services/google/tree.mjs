/* The words after a service walk its Discovery tree one level at a time: a word naming a method ends
   the walk and what follows is that call's, a word naming a resource goes a level down, and a walk that
   ends on a resource has stopped at a level. So every level is something a caller can list, and a
   word that names nothing is refused against the level it failed at rather than the whole service.
   No method id of a carried document is also a resource's, which is what makes position enough.
   docs/cli/google.md. */
import { didYouMean } from "../../../suggest.mjs";
import { consentSaid } from "./consent.mjs";
import { COMMON, PATH_DEFAULTS, SERVED_SERVICES, SERVICES, carriedIndex, methodById } from "./surface.mjs";
import { DISCOVERY, VALIDATION, refuse, say } from "./exits.mjs";
import { slotsOf } from "./request.mjs";

const grown = (service) => {
  const root = { id: service, resources: {}, methods: {} };
  for (const id of Object.keys(carriedIndex(service)?.methods ?? {})) {
    const words = id.split(".").slice(1);
    let node = root;
    for (const word of words.slice(0, -1)) {
      node.resources[word] ??= { id: `${node.id}.${word}`, resources: {}, methods: {} };
      node = node.resources[word];
    }
    node.methods[words.at(-1)] = id;
  }
  return root;
};

const trees = new Map();

/** A carried service's tree, each node its id, its resources by name and its method ids by name. */
export const treeOf = (service) => {
  if (!trees.has(service)) trees.set(service, grown(service));
  return trees.get(service);
};

const childrenOf = (node) => [...Object.keys(node.resources), ...Object.keys(node.methods)];

/* A flag ends the words a walk reads: `drive files -h` asks of the level it stands at. */
const walked = (service, words) => {
  let node = treeOf(service);
  for (let at = 0; at < words.length; at += 1) {
    const word = words[at];
    if (Object.hasOwn(node.methods, word)) return { id: node.methods[word], rest: words.slice(at + 1) };
    if (word.startsWith("-")) return { level: node, rest: words.slice(at) };
    if (!Object.hasOwn(node.resources, word)) {
      refuse(DISCOVERY, `google: ${didYouMean(`resource or method of ${node.id}`, word, childrenOf(node),
        `\`forge google ${node.id.split(".").join(" ")} -h\` lists them.`)}`);
    }
    node = node.resources[word];
  }
  return { level: node, rest: [] };
};

const knownService = (service) => {
  if (!Object.hasOwn(SERVICES, service ?? "")) {
    refuse(DISCOVERY, `google: ${didYouMean("service", service ?? "", Object.keys(SERVICES))}`);
  }
};

/** A typed command's method with the words left for the call, or the level it stopped at with the words after it. */
export const resolveTyped = ([service, ...words]) => {
  knownService(service);
  if (!SERVED_SERVICES.includes(service)) {
    refuse(DISCOVERY, `google: ${service} is carried and not served, so none of its methods answers a call.\n`
      + `  what is served: ${SERVED_SERVICES.join(", ")}; \`forge google schema ${service}\` still reads its document`);
  }
  const found = walked(service, words);
  return found.id ? { ...methodById(found.id), rest: found.rest } : found;
};

const argsOf = (method) => slotsOf(method.entry)
  .map((name) => (PATH_DEFAULTS[method.service]?.[name] ? `[${name}]` : `<${name}>`));

const spoken = (id) => id.split(".").join(" ");

const methodRow = (name, id) => {
  const method = methodById(id);
  return { name, http: method.entry.http, args: argsOf(method).join(" "), owes: consentSaid(method) };
};

const widest = (rows, key) => Math.max(0, ...rows.map((row) => row[key].length));

/** What `-h` at a level prints: its resources, then each method with its verb, its positionals and what it owes. */
export const levelText = (node) => {
  const rows = Object.entries(node.methods).map(([name, id]) => methodRow(name, id));
  const [name, args] = [widest(rows, "name"), widest(rows, "args")];
  const lines = rows.map((row) => `  ${row.name.padEnd(name)}  ${row.http.padEnd(6)}  ${row.args.padEnd(args)}`
    + (row.owes ? `  --yes: ${row.owes}` : ""));
  return [
    `Usage: forge google ${spoken(node.id)} <resource|method> [<args>] [flags]`,
    `Resources: ${Object.keys(node.resources).join(", ") || "none"}`,
    `Methods:${lines.length ? "" : " none"}`,
    ...lines.map((line) => line.trimEnd()),
    `\`forge google ${spoken(node.id)} <resource> -h\` lists a level below; \`forge google schema ${node.id}\` prints this one as JSON.`,
  ].join("\n");
};

/** What `-h` after a method prints: the call with its positionals, its verb and path, and what it owes. */
export const methodText = (method) => [
  `Usage: forge google ${[spoken(method.id), ...argsOf(method)].join(" ")} [flags]`,
  `${method.entry.http} ${method.entry.path}${method.entry.about ? `  ${method.entry.about}` : ""}`,
  `--yes: ${consentSaid(method) ?? "not owed"}`,
  `\`forge google schema ${method.id}\` prints its parameters; \`forge google -h\` the flags every call takes.`,
].join("\n");

/** A level and everything under it, as `schema` prints one. */
const subtreeOf = (node) => ({
  id: node.id,
  resources: Object.fromEntries(Object.entries(node.resources).map(([name, child]) => [name, subtreeOf(child)])),
  methods: Object.fromEntries(Object.entries(node.methods).map(([name, id]) => {
    const method = methodById(id);
    return [name, { http: method.entry.http, args: slotsOf(method.entry), yes: consentSaid(method) }];
  })),
});

const methodSchema = (method) => {
  const { id, entry, service } = method;
  return { id, served: SERVED_SERVICES.includes(service), http: entry.http, path: entry.path, parameters: entry.params ?? {},
    body: entry.body ?? null, returns: entry.returns ?? null, upload: Boolean(entry.upload), download: Boolean(entry.download),
    scopes: entry.scopes ?? [], about: entry.about ?? null, common: COMMON };
};

/** `schema <id>`: a method's parameters, or a level's subtree, off the carried index of any carried service. */
export const schema = (argv) => {
  const [id, ...rest] = argv;
  if (!id || rest.length) refuse(VALIDATION, "google schema takes one id, a method's or a level's: forge google schema drive.files.list");
  const [service, ...words] = id.split(".");
  knownService(service);
  const found = walked(service, words);
  if (found.rest.length) refuse(VALIDATION, `google schema: \`${id}\` goes past the method ${found.id ?? found.level.id}.`);
  const shown = found.id ? methodSchema(methodById(found.id))
    : { served: SERVED_SERVICES.includes(service), ...subtreeOf(found.level) };
  say(JSON.stringify(shown, null, 2));
};
