/* Cloudflare zones, DNS and cache, called straight against api.cloudflare.com — the account
   credentials are this machine's, not the tracker's, and nothing here touches the Forge endpoint.
   docs/FORGE-CLI.md.

   Zones aggregate across every configured account, and a caller names a zone by id and never an
   account: which account holds that zone is asked rather than typed. */
import { CONFIG_PATH, saveConfig, userConfig } from "./resolve/config.mjs";
import { fail } from "./resolve/settings.mjs";
import { flags, pullRepeated } from "./resolve/flags.mjs";
import { didYouMean } from "./suggest.mjs";

const CF_BASE = "https://api.cloudflare.com/client/v4";
const ZONE_PAGE = 50;
const DNS_PAGE = 100;
/* Two record queries per zone, so a bare query against many accounts is a bounded fan-out. */
const SEARCH_ZONE_CAP = 15;
const ID_WIDTH = 34;
const NAME_WIDTH = 30;

const USAGE = [
  "Usage: forge cloudflare <zones|zone|dns|purge|search|login|accounts> [args]",
  "Zones and DNS against api.cloudflare.com. Credentials resolve from $CLOUDFLARE_API_TOKEN",
  "with $CLOUDFLARE_ACCOUNT_ID, else the accounts `login` saved under ~/.config/forge.",
  "",
  "  zones [--search q]                     one line per zone, across every account",
  "  zone <zone-id>                         one zone's detail",
  "  dns <zone-id> [--type A] [--name www]  the zone's records",
  "  dns add <zone-id> --type T --name N --content C [--ttl n] [--proxied true|false] [--priority n]",
  "  dns set <record-id> --zone <zone-id> [--type T] [--name N] [--content C] [--ttl n]",
  "  dns rm <record-id> --zone <zone-id>    delete a record",
  "  purge <zone-id> [--file <url>]...      purge everything, or only the named files",
  "  search <query> [--scope all|zones|dns] [--type T]   zones and records together",
  "  login --name N --account-id A --token T | --forget N",
  "  accounts [--full]                      what resolved, and from where",
].join("\n");

/* One account from the environment, or every account the config holds. Provenance travels with
   them because `forge doctor` reports where each came from and never what it is. */
export const cloudflareAccounts = () => {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (apiToken && accountId) {
    return { from: "$CLOUDFLARE_API_TOKEN", accounts: [{ name: "environment", accountId, apiToken }] };
  }
  /* Half a pair reports rather than falling through: reading the config file instead would hide the
     typo in whichever name was set. It reports, and does not throw, because doctor prints every
     finding in one pass. */
  if (apiToken || accountId) {
    const missing = apiToken ? "$CLOUDFLARE_ACCOUNT_ID" : "$CLOUDFLARE_API_TOKEN";
    return { from: "the environment", accounts: [], problem: `${missing} is not set` };
  }
  const held = (userConfig().cloudflare?.accounts ?? []).filter((one) => one.apiToken && one.accountId);
  return { from: held.length ? CONFIG_PATH : null, accounts: held };
};

const NO_ACCOUNT =
  "No Cloudflare account is configured. Save one with\n" +
  "  forge cloudflare login --name <label> --account-id <id> --token <api-token>\n" +
  "or export CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.";

const configured = () => {
  const { accounts, problem } = cloudflareAccounts();
  if (problem) fail(`Cloudflare is half configured from the environment: ${problem}.`);
  if (!accounts.length) fail(NO_ACCOUNT);
  return accounts;
};

/* Cloudflare answers 200 with `success: false`, so the status alone is not the verdict. */
const cfFetch = async (token, path, method = "GET", body) => {
  const response = await fetch(`${CF_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!response.ok || !parsed?.success) {
    throw new Error(parsed?.errors?.[0]?.message ?? `HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return parsed;
};

/* A failing account is named, never swallowed: aggregating in silence makes a revoked token look
   like an account holding no zones. */
const zonesOf = async (account) => {
  const query = new URLSearchParams({ "account.id": account.accountId, per_page: String(ZONE_PAGE) });
  try {
    const { result } = await cfFetch(account.apiToken, `/zones?${query}`);
    return { zones: result.map((zone) => ({ ...zone, account })), failed: null };
  } catch (error) {
    console.error(`cloudflare: account ${account.name} answered ${error.message}`);
    return { zones: [], failed: account.name };
  }
};

export const everyZone = async (accounts) => {
  const answers = await Promise.all(accounts.map(zonesOf));
  return {
    zones: answers.flatMap((answer) => answer.zones),
    failed: answers.map((answer) => answer.failed).filter(Boolean),
  };
};

/* Every account refusing is a failure, not an empty tracker: `0 zone(s)` and exit 0 would let a
   caller pipe a revoked token into a decision. One that answered is enough to carry on. */
const gathered = async (accounts) => {
  const { zones, failed } = await everyZone(accounts);
  if (failed.length === accounts.length) {
    fail(`Every configured Cloudflare account refused: ${failed.join(", ")}.`);
  }
  return zones;
};

/* Which account holds a zone is written down nowhere, so it is asked. Sequential on purpose: the
   first hit ends the probe, and one account is the common case. */
export const accountForZone = async (accounts, zone) => {
  const refused = [];
  for (const account of accounts) {
    try {
      await cfFetch(account.apiToken, `/zones/${zone}`);
      return account;
    } catch (error) {
      refused.push(`${account.name}: ${error.message}`);
    }
  }
  /* Each account's own words, because a revoked token and a zone in nobody's account both end the
     probe the same way and only one of them is about the zone. */
  return fail(`No configured Cloudflare account holds zone ${zone}.\n  ${refused.join("\n  ")}`);
};

const boolFlag = (raw, name) => {
  if (raw === undefined) return undefined;
  if (raw === "true" || raw === "false") return raw === "true";
  return fail(`cloudflare: ${name} takes true or false, not \`${raw}\`.`);
};

const intFlag = (raw, name) => {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    fail(`cloudflare: ${name} takes a whole number, not \`${raw}\`.`);
  }
  return value;
};


const zoneLine = (zone) =>
  `${zone.id.padEnd(ID_WIDTH)} ${(zone.status ?? "").padEnd(8)} ${zone.name}${zone.paused ? "  paused" : ""}`;

const ttlOf = (record) => (record.ttl === 1 ? "ttl=auto" : `ttl=${record.ttl}`);

export const recordLine = (record) =>
  [
    record.id.padEnd(ID_WIDTH),
    (record.type ?? "").padEnd(6),
    (record.name ?? "").padEnd(NAME_WIDTH),
    record.content ?? "",
    record.proxied ? "  proxied" : "",
    `  ${ttlOf(record)}`,
    record.priority === undefined || record.priority === null ? "" : `  priority=${record.priority}`,
  ].join("");

const printZones = (zones) => {
  for (const zone of zones) console.log(zoneLine(zone));
  console.log(`\n${zones.length} zone(s)`);
};

const printRecords = (records) => {
  for (const record of records) console.log(recordLine(record));
  console.log(`\n${records.length} record(s)`);
};

/* Every write says which zone and which account it landed on, the way `forge`'s own writes do:
   the zone is an argument but the account was chosen by a probe nobody watched. */
const announce = (what, zone, account) =>
  console.error(`cloudflare ${what} -> zone ${zone}, account ${account.name}`);

const dnsQuery = (type, name) => {
  const query = new URLSearchParams({ per_page: String(DNS_PAGE) });
  if (type) query.set("type", type);
  if (name) query.set("name", name);
  return query;
};

const RECORD_FIELDS = ["id", "type", "name", "content", "proxied", "ttl", "priority"];

const slim = (record, extra = {}) =>
  Object.assign(Object.fromEntries(RECORD_FIELDS.map((key) => [key, record[key]])), extra);

/* Two filters per zone because Cloudflare has no OR: a query matches a record's name or its
   content, and the same record can answer both. */
const recordsMatching = async (zone, query, type) => {
  const found = [];
  for (const filter of ["name.contains", "content.contains"]) {
    const params = new URLSearchParams({ per_page: String(DNS_PAGE) });
    params.set(filter, query);
    if (type) params.set("type", type);
    try {
      const { result } = await cfFetch(zone.account.apiToken, `/zones/${zone.id}/dns_records?${params}`);
      for (const record of result) found.push(slim(record, { zone_id: zone.id, zone_name: zone.name }));
    } catch (error) {
      console.error(`cloudflare: zone ${zone.name} answered ${error.message}`);
    }
  }
  return found;
};

/* A query naming a host matches the zone that host sits in, so `www.example.com` reaches
   example.com's records without the zone being named. */
const searchable = (zones, needle) =>
  zones
    .filter((zone) => {
      const name = zone.name.toLowerCase();
      return needle.endsWith(name) || needle.includes(name) || name.includes(needle);
    })
    .slice(0, SEARCH_ZONE_CAP);

const dedupe = (records) => {
  const seen = new Set();
  const kept = [];
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    kept.push(record);
  }
  return kept;
};

export const searchDns = async (zones, query, type) => {
  const needle = query.toLowerCase();
  const perZone = await Promise.all(
    searchable(zones, needle).map((zone) => recordsMatching(zone, query, type)),
  );
  return dedupe(perZone.flat());
};

const masked = (token, full) => {
  if (!full) return `set (${token.length} chars)`;
  return token.length <= 12 ? "set" : `${token.slice(0, 6)}…${token.slice(-4)} (${token.length} chars)`;
};

const saveAccount = (rest) => {
  const { name, "account-id": accountId, token, forget } = flags(rest, "cloudflare login");
  const held = userConfig().cloudflare?.accounts ?? [];
  if (forget) {
    const kept = held.filter((one) => one.name !== forget);
    if (kept.length === held.length) fail(didYouMean("account", forget, held.map((one) => one.name)));
    saveConfig({ cloudflare: { accounts: kept } });
    console.log(`Dropped ${forget}; ${kept.length} account(s) left in ${CONFIG_PATH}`);
    return;
  }
  if (!name || !accountId || !token) {
    fail("cloudflare login needs --name, --account-id and --token, or --forget <name>.");
  }
  const kept = held.filter((one) => one.name !== name);
  saveConfig({ cloudflare: { accounts: [...kept, { name, accountId, apiToken: token }] } });
  console.log(`Saved ${name} to ${CONFIG_PATH} (0600); ${kept.length + 1} account(s) configured.`);
};

const listAccounts = (rest) => {
  const { full } = flags(rest, "cloudflare accounts", ["--full"]);
  const { accounts, from, problem } = cloudflareAccounts();
  if (problem) fail(`Cloudflare is half configured from the environment: ${problem}.`);
  if (!accounts.length) {
    console.log(NO_ACCOUNT);
    return;
  }
  for (const account of accounts) {
    console.log(
      `${account.name.padEnd(20)} account ${masked(account.accountId, full)}  token ${masked(account.apiToken, full)}`,
    );
  }
  console.log(`\n${accounts.length} account(s) ← ${from}`);
};

const dnsAdd = async ([zone, ...rest]) => {
  if (!zone) fail("Usage: forge cloudflare dns add <zone-id> --type T --name N --content C");
  const given = flags(rest, "cloudflare dns add");
  if (!given.type || !given.name || !given.content) {
    fail("cloudflare dns add needs --type, --name and --content.");
  }
  const body = {
    type: given.type,
    name: given.name,
    content: given.content,
    ttl: intFlag(given.ttl, "--ttl") ?? 1,
    proxied: boolFlag(given.proxied, "--proxied") ?? false,
  };
  const priority = intFlag(given.priority, "--priority");
  if (priority !== undefined) body.priority = priority;
  const account = await accountForZone(configured(), zone);
  announce("dns add", zone, account);
  const { result } = await cfFetch(account.apiToken, `/zones/${zone}/dns_records`, "POST", body);
  console.log(`created  ${recordLine(slim(result))}`);
};

/* A PATCH, so an unnamed field keeps its value: the whole record is not retyped to move one. */
const dnsSet = async ([record, ...rest]) => {
  if (!record) fail("Usage: forge cloudflare dns set <record-id> --zone <zone-id> [--content C] …");
  const given = flags(rest, "cloudflare dns set");
  if (!given.zone) fail("cloudflare dns set needs --zone <zone-id>; a record id alone names no zone.");
  const body = {};
  for (const key of ["type", "name", "content"]) if (given[key]) body[key] = given[key];
  const ttl = intFlag(given.ttl, "--ttl");
  if (ttl !== undefined) body.ttl = ttl;
  const proxied = boolFlag(given.proxied, "--proxied");
  if (proxied !== undefined) body.proxied = proxied;
  const priority = intFlag(given.priority, "--priority");
  if (priority !== undefined) body.priority = priority;
  if (!Object.keys(body).length) fail("cloudflare dns set was given nothing to change.");
  const account = await accountForZone(configured(), given.zone);
  announce("dns set", given.zone, account);
  const { result } = await cfFetch(
    account.apiToken,
    `/zones/${given.zone}/dns_records/${record}`,
    "PATCH",
    body,
  );
  console.log(`updated  ${recordLine(slim(result))}`);
};

const dnsRemove = async ([record, ...rest]) => {
  if (!record) fail("Usage: forge cloudflare dns rm <record-id> --zone <zone-id>");
  const { zone } = flags(rest, "cloudflare dns rm");
  if (!zone) fail("cloudflare dns rm needs --zone <zone-id>; a record id alone names no zone.");
  const account = await accountForZone(configured(), zone);
  announce("dns rm", zone, account);
  await cfFetch(account.apiToken, `/zones/${zone}/dns_records/${record}`, "DELETE");
  console.log(`deleted  ${record}`);
};

const dnsList = async ([zone, ...rest]) => {
  if (!zone) fail("Usage: forge cloudflare dns <zone-id> [--type A] [--name www]");
  const { type, name } = flags(rest, "cloudflare dns");
  const account = await accountForZone(configured(), zone);
  const { result } = await cfFetch(
    account.apiToken,
    `/zones/${zone}/dns_records?${dnsQuery(type, name)}`,
  );
  printRecords(result.map((record) => slim(record)));
};

const DNS_SUBS = { add: dnsAdd, set: dnsSet, rm: dnsRemove };

const dns = (rest) => {
  const handler = Object.hasOwn(DNS_SUBS, rest[0] ?? "") ? DNS_SUBS[rest[0]] : null;
  return handler ? handler(rest.slice(1)) : dnsList(rest);
};

const SCOPES = ["all", "zones", "dns"];

const search = async ([query, ...rest]) => {
  if (!query) fail("Usage: forge cloudflare search <query> [--scope all|zones|dns] [--type T]");
  const { scope = "all", type } = flags(rest, "cloudflare search");
  if (!SCOPES.includes(scope)) fail(didYouMean("scope", scope, SCOPES));
  const zones = await gathered(configured());
  if (scope !== "dns") {
    const needle = query.toLowerCase();
    printZones(zones.filter((zone) => zone.name.toLowerCase().includes(needle)));
  }
  if (scope !== "zones") {
    if (scope === "all") console.log("");
    printRecords(await searchDns(zones, query, type));
  }
};

const zones = async (rest) => {
  const { search: needle } = flags(rest, "cloudflare zones");
  const found = await gathered(configured());
  const wanted = needle ? found.filter((zone) => zone.name.toLowerCase().includes(needle.toLowerCase())) : found;
  printZones(wanted);
};

const ZONE_FIELDS = ["id", "name", "status", "paused", "name_servers", "original_name_servers"];

const zone = async ([wanted]) => {
  if (!wanted) fail("Usage: forge cloudflare zone <zone-id>");
  const account = await accountForZone(configured(), wanted);
  const { result } = await cfFetch(account.apiToken, `/zones/${wanted}`);
  const detail = Object.fromEntries(ZONE_FIELDS.map((key) => [key, result[key]]));
  console.log(JSON.stringify({ ...detail, plan: result.plan?.name }, null, 2));
};

const purge = async ([wanted, ...rest]) => {
  if (!wanted) fail("Usage: forge cloudflare purge <zone-id> [--file <url>]...");
  const { values: files, rest: others } = pullRepeated(rest, "--file", "cloudflare purge");
  flags(others, "cloudflare purge");
  const account = await accountForZone(configured(), wanted);
  const body = files.length ? { files } : { purge_everything: true };
  announce("purge", wanted, account);
  await cfFetch(account.apiToken, `/zones/${wanted}/purge_cache`, "POST", body);
  console.log(`purged  ${files.length ? `${files.length} file(s)` : "everything"}`);
};

const SUBS = { zones, zone, dns, purge, search, login: saveAccount, accounts: listAccounts };

export const cloudflare = async ([sub, ...rest]) => {
  const asked = sub === "-h" || sub === "--help";
  if (asked || !sub || !Object.hasOwn(SUBS, sub)) {
    if (sub && !asked) console.error(didYouMean("cloudflare action", sub, Object.keys(SUBS)));
    console.error(USAGE);
    process.exit(asked ? 0 : 1);
  }
  await SUBS[sub](rest);
};
