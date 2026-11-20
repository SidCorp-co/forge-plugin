// cm:why a leaf the judge brief reads too: it is loaded by every hook event, which may not pull in the earned ladder for one string (ISS-122)
// cm:why `flow/route/close.mjs` reads this flag and every reply names it
export const UNMET_FORM = `--unmet '[{"criterion":<n>,"to":{"issue":"ISS-<n>"}}]'`;
