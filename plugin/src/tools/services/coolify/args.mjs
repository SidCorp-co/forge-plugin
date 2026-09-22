/* What is left of argv once the verb's own switches are out, mapped onto the arguments the
   resolved operation declares in the carried index. The declared set differs per operation, so
   this is the only place that knows what a flag on a Coolify call means. docs/cli/coolify-the-instance.md. */
import { fail } from "../../../resolve/settings.mjs";
import { didYouMean } from "../../../suggest.mjs";

const declaredOf = (entry) => {
  const by = new Map();
  for (const one of entry.params ?? []) by.set(one.name, { ...one, where: one.in ?? "query" });
  for (const one of entry.body?.props ?? []) if (!by.has(one.name)) by.set(one.name, { ...one, where: "body" });
  return by;
};

const coerced = (raw, type, name) => {
  if (type === "boolean") {
    if (["true", "1", "yes", "on"].includes(raw.toLowerCase())) return true;
    if (["false", "0", "no", "off"].includes(raw.toLowerCase())) return false;
    return fail(`coolify: --${name} takes true or false, not \`${raw}\`.`);
  }
  if (type === "integer" || type === "number") {
    const value = Number(raw);
    if (!Number.isFinite(value)) return fail(`coolify: --${name} takes a number, not \`${raw}\`.`);
    return type === "integer" ? Math.trunc(value) : value;
  }
  return raw;
};

const named = (token, declared, entry) => {
  const [head, inline] = token.slice(2).split(/=(.*)/su);
  const negated = head.startsWith("no-") && declared.has(head.slice(3).replace(/-/gu, "_"));
  const spelled = negated ? head.slice(3) : head;
  for (const candidate of [spelled, spelled.replace(/-/gu, "_")]) {
    if (declared.has(candidate)) return { name: candidate, inline, negated };
  }
  return fail(`coolify ${entry.name}: ${didYouMean("flag", `--${head}`, [...declared.keys()].map((one) => `--${one}`))}`);
};

const gathered = (argv, declared, entry) => {
  const values = {};
  const loose = [];
  for (let at = 0; at < argv.length; at += 1) {
    const token = argv[at];
    if (!token.startsWith("--")) {
      loose.push(token);
      continue;
    }
    const { name, inline, negated } = named(token, declared, entry);
    const type = declared.get(name).type ?? "string";
    if (negated) values[name] = false;
    else if (type === "boolean" && inline === undefined) values[name] = true;
    else {
      if (inline === undefined && at + 1 >= argv.length) fail(`coolify: --${name} needs a value.`);
      const raw = inline === undefined ? argv[(at += 1)] : inline;
      values[name] = coerced(raw, type, name);
    }
  }
  return { values, loose };
};

/* Positionals fill the path's own arguments left to right, skipping any already given as a flag,
   so `app get <uuid>` and `app get --uuid <uuid>` are the same call. */
const filled = (values, loose, declared, entry) => {
  const path = [...declared.values()].filter((one) => one.where === "path");
  const empty = path.filter((one) => !(one.name in values));
  empty.slice(0, loose.length).forEach((one, at) => {
    values[one.name] = loose[at];
  });
  if (loose.length > empty.length) fail(`coolify ${entry.name}: unexpected argument \`${loose[empty.length]}\`.`);
  const missing = path.filter((one) => !(one.name in values)).map((one) => one.name);
  if (missing.length) {
    fail(`coolify ${entry.name} needs ${missing.map((one) => `<${one}>`).join(" ")}.`);
  }
};

const wired = (value) => (typeof value === "boolean" ? String(value) : value);

/** argv onto the operation's own path, query and body. */
export const readArgs = (entry, argv) => {
  const declared = declaredOf(entry);
  const { values, loose } = gathered(argv, declared, entry);
  filled(values, loose, declared, entry);
  let path = entry.path;
  const query = {};
  const body = {};
  for (const [name, value] of Object.entries(values)) {
    const where = declared.get(name).where;
    if (where === "path") path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
    else if (where === "body") body[name] = value;
    else if (where !== "header") query[name] = wired(value);
  }
  return { path, query, body: Object.keys(body).length ? body : null, values };
};
