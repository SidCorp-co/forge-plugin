/* What a payload must not carry: every test credential a project holds, found wherever a write would
   send it, masked where a copy is already stored, and the refusals that say so. The project's
   bindings are read in ../project-config.mjs, which re-exports this file's surface so a caller
   imports the guard from where it reads the deploy. docs/cli/the-credential-guard.md. */

/* One walk serves three readers: what to print, what to withhold, what a payload must not carry. */
export const leaves = (value, at = []) => {
  if (typeof value === "string") return value ? [{ at, value }] : [];
  if (Array.isArray(value)) return value.flatMap((one, index) => leaves(one, [...at, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, held]) => leaves(held, [...at, key]));
  }
  return [];
};

/* Above the length, refused wherever a payload holds it; below it, only where a field is it,
   quoting aside — a field can hold `admin`. docs/cli/the-credential-guard.md states that edge
   rather than more. */
const SECRET = 12;
const bare = (text) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

const holds = (text, one) => {
  if (one.value.length >= SECRET) return text.includes(one.value);
  const held = bare(one.value);
  return Boolean(held) && bare(text) === held;
};

const matched = (text, guarded) => guarded.find((one) => holds(text, one));

const MASK = "[withheld]";
const AROUND = 40;

/* Every span of the field any guarded value covers, in its written and its bare form, overlaps
   included: masking one value at a time can split another that overlaps it and leave its tail. */
const spansOf = (text, guarded) => guarded
  .flatMap((one) => [one.value, bare(one.value)])
  .filter(Boolean)
  .flatMap((value) => {
    const found = [];
    for (let at = text.indexOf(value); at >= 0; at = text.indexOf(value, at + 1)) {
      found.push([at, at + value.length]);
    }
    return found;
  })
  .sort((one, two) => one[0] - two[0]);

const maskSpans = (text, spans) => {
  let out = "";
  let from = 0;
  for (const [start, end] of spans) {
    if (end <= from) continue;
    out += start > from ? `${text.slice(from, start)}${MASK}` : (out.endsWith(MASK) ? "" : MASK);
    from = end;
  }
  return out + text.slice(from);
};

/* Where in the author's own words the hit sits, so a false one is recognisable from the refusal.
   The field is masked whole before anything is cut, so no cut can leave part of a value showing,
   and a field that is a short value with punctuation round it is nothing but the mask. */
const nearOf = (text, guarded) => {
  if (guarded.some((one) => bare(one.value) && bare(one.value) === bare(text))) return MASK;
  const masked = maskSpans(text, spansOf(text, guarded)).replace(/\s+/gu, " ").trim();
  const at = Math.max(masked.indexOf(MASK), 0);
  const from = Math.max(at - AROUND, 0);
  const to = Math.min(at + MASK.length + AROUND, masked.length);
  return `${from ? "…" : ""}${masked.slice(from, to)}${to < masked.length ? "…" : ""}`;
};

const guardedOf = (deploy) => deploy?.withheld.filter((one) => one.guarded) ?? [];

/** Every string of a payload the guard would refuse, once for each credential it carries, with where
 *  it sits: a string holding two is two hits, since a redaction masks both and says so. */
export const credentialHits = (data, deploy) => {
  const guarded = guardedOf(deploy);
  if (!guarded.length) return [];
  return leaves(data).flatMap((one) => {
    const labels = [...new Set(guarded.filter((held) => holds(one.value, held)).map((held) => held.label))];
    const near = labels.length ? nearOf(one.value, guarded) : null;
    return labels.map((credential) => ({ at: one.at, field: one.at.join("."), credential, near }));
  });
};

/* A string the tracker already holds at the same leaf path of the same record, word for word, is
   one a write re-sends rather than supplies: sending it again gives the tracker nothing it has not
   taken, and refusing it made an issue whose stored record once took a credential unwritable
   (ISS-1380). The path is the whole of `hit.field`, not its top-level key: a stored value read at
   one path and typed fresh at another is a new placement of that text, not the record it already
   holds, and is judged as any caller-supplied string is (ISS-2837). */
const storedIn = (stored) => {
  const held = new Map(leaves(stored ?? {}).map((one) => [one.at.join("."), one.value]));
  return (hit, value) => held.get(hit.field) === value;
};

const splitHits = (data, deploy, stored) => {
  const isStored = storedIn(stored);
  const values = new Map(leaves(data).map((one) => [one.at.join("."), one.value]));
  const split = { supplied: [], stored: [] };
  for (const hit of credentialHits(data, deploy)) split[isStored(hit, values.get(hit.field)) ? "stored" : "supplied"].push(hit);
  return split;
};

/** Which field of a payload carries a value this project holds as a test credential, which
 *  credential, and the masked text around it. An empty `field` is a payload that is one string: a
 *  file's bytes have no field. A display name is withheld from the report and guarded here never. */
export const credentialLeak = (data, deploy, stored = null) => {
  const [found] = splitHits(data, deploy, stored).supplied;
  return found ? { field: found.field, credential: found.credential, near: found.near } : null;
};

/** The hits a write re-sends from the stored record rather than from its caller's input. */
export const storedCopies = (data, deploy, stored) => splitHits(data, deploy, stored).stored;

/* One value, and never a list of fields: a short credential is masked where the string is it, a
   long one wherever it sits written exactly, which is the matching rule above read as a mask. The
   bare form a refusal's quote also masks is no part of it: the guard refuses no string for holding
   that alone, so a redaction masking it would rewrite text nothing refused. */
const maskedLeaf = (text, guarded) => {
  if (guarded.some((one) => one.value.length < SECRET && holds(text, one))) {
    return MASK;
  }
  const spans = guarded
    .filter((one) => one.value.length >= SECRET)
    .flatMap((one) => {
      const found = [];
      for (let at = text.indexOf(one.value); at >= 0; at = text.indexOf(one.value, at + 1)) {
        found.push([at, at + one.value.length]);
      }
      return found;
    })
    .sort((one, two) => one[0] - two[0]);
  return maskSpans(text, spans);
};

const mapLeaves = (value, each) => {
  if (typeof value === "string") return each(value);
  if (Array.isArray(value)) return value.map((one) => mapLeaves(one, each));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, held]) => [key, mapLeaves(held, each)]));
  }
  return value;
};

/** The value with every string the guard would refuse masked, and every other string as it was. */
export const redactedCopy = (value, deploy) => {
  const guarded = guardedOf(deploy);
  return mapLeaves(value, (text) => (text && matched(text, guarded) ? maskedLeaf(text, guarded) : text));
};

export const REDACT_ROUTE = (ref) => `forge issue ${ref} --redact`;

/** Said of a copy the tracker already stores and a write re-sent: the write went, and the line is
 *  the route that takes the copy off, since no caller's input holds it to be taken out of. */
export const storedCopyLine = (hit, ref) =>
  `${ref}: ${hit.field} carries this project's ${hit.credential} as the tracker already stores it. `
  + "This write re-sent the stored copy unchanged and added nothing to it, so it went. The stored "
  + `copy is taken off with:\n  ${REDACT_ROUTE(ref)}`;

export const unreadRefusal = (refused, what) =>
  `${what} was not sent: this project's test credentials could not be read, so nothing here can say `
  + "whether the payload carries one, and there is no delete for what the tracker has taken. The "
  + `reading came back with: ${refused}\nSay whether the project reads, and send this again `
  + "unchanged once it does:\n  forge doctor";

export const leakRefusal = (found, what) =>
  `${what} carries this project's ${found.credential}`
  + `${found.field ? `, at ${found.field}` : ""}${found.near ? `, where it reads "${found.near}"` : ""}. `
  + "A test credential is read "
  + "at the authentication step and echoed nowhere after it — the tracker's own project-settings "
  + "guide, rule 2, and there is no delete for what the tracker has taken. Take the value out and "
  + "say where it is read instead:\n  forge doctor --credentials";
