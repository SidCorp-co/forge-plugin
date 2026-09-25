/* A Discovery document cut down to what this verb reads: each method's HTTP method, path, parameters,
   body and answer, upload path, download flag and scopes. The whole documents are eight times the size
   and every byte past these is a schema nothing here validates against. docs/cli/google.md. */

const SENTENCE_CAP = 200;

/* The first sentence only: `schema` prints one line a parameter, and the rest is Google's page. */
const firstSentence = (text) => {
  if (!text) return undefined;
  const flat = text.replace(/\s+/gu, " ").trim();
  const [first] = flat.split(/(?<=\.)\s/u);
  return first.length > SENTENCE_CAP ? `${first.slice(0, SENTENCE_CAP - 1)}…` : first;
};

const defined = (record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

const parameterOf = (one) => defined({
  in: one.location,
  type: one.type,
  required: one.required || undefined,
  repeated: one.repeated || undefined,
  enum: one.enum,
  about: firstSentence(one.description),
});

const parametersOf = (held = {}) => {
  const names = Object.keys(held).sort();
  return names.length ? Object.fromEntries(names.map((name) => [name, parameterOf(held[name])])) : undefined;
};

const methodOf = (method) => defined({
  http: method.httpMethod,
  path: method.path,
  order: method.parameterOrder?.length ? method.parameterOrder : undefined,
  params: parametersOf(method.parameters),
  body: method.request?.$ref,
  returns: method.response?.$ref,
  upload: method.mediaUpload?.protocols?.simple?.path,
  download: method.supportsMediaDownload || undefined,
  scopes: method.scopes,
  about: firstSentence(method.description),
});

const walk = (resources, prefix, out) => {
  for (const [name, resource] of Object.entries(resources ?? {})) {
    const here = [...prefix, name];
    for (const [verb, method] of Object.entries(resource.methods ?? {})) out[[...here, verb].join(".")] = methodOf(method);
    walk(resource.resources, here, out);
  }
  return out;
};

const sortedKeys = (record) => Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));

/** Keyed by our service name rather than the document's own, which Admin spells `directory`. */
export const deriveIndex = (document, { service, discovery }) => ({
  service,
  api: document.name,
  version: document.version,
  revision: document.revision,
  discovery,
  rootUrl: document.rootUrl,
  servicePath: document.servicePath ?? "",
  common: parametersOf(document.parameters) ?? {},
  methods: sortedKeys(walk(document.resources, [service], {})),
});

/* One method a line, so a refresh's diff in git reads method by method rather than as one line. */
export const serialize = (index) => {
  const { methods, ...head } = index;
  const lines = Object.entries(methods).map(([id, method]) => `  ${JSON.stringify(id)}: ${JSON.stringify(method)}`);
  const top = JSON.stringify(head).slice(0, -1);
  return `${top},\n "methods": {\n${lines.join(",\n")}\n }\n}\n`;
};

/** What a fresh index adds, drops and changes against the carried one, method by method. */
export const moved = (carried, fresh) => {
  const before = carried?.methods ?? {};
  const after = fresh.methods;
  return {
    added: Object.keys(after).filter((id) => !Object.hasOwn(before, id)),
    removed: Object.keys(before).filter((id) => !Object.hasOwn(after, id)),
    changed: Object.keys(after).filter((id) => Object.hasOwn(before, id)
      && JSON.stringify(before[id]) !== JSON.stringify(after[id])),
  };
};
