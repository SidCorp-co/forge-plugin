/* How a saved value's shape is shown without showing the value, for `forge doctor` and `forge cloudflare accounts` alike: two copies of this printed one credential two ways and disagreed about its length (ISS-951). `masked` is for a credential and takes the scheme off first — a token is sometimes saved written `Bearer <token>`, and counting that spelling reports a length seven too high and prints the scheme as the token's head. `abbreviated` is for a value that is not a credential, an account id being one, and a call reaches for it by name so that showing an identifier does not read as showing a secret. Neither is `hook-log.mjs`'s `masked`, which strikes a credential out of text somebody will read, nor `stats/runs.mjs`'s `shortened`, which cuts a line to a width: this pair answers how long a saved value is and what its ends are, and nothing else does. docs/cli/doctor.md. */
const SHORT = 12;
const HEAD = 6;
const TAIL = 4;

export const abbreviated = (value, full) => {
  if (!full) return `set (${value.length} chars)`;
  return value.length <= SHORT ? "set" : `${value.slice(0, HEAD)}…${value.slice(-TAIL)} (${value.length} chars)`;
};

export const masked = (token, full) => abbreviated(token.replace(/^Bearer /u, ""), full);
