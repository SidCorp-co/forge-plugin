/* The one command that clears a warning core attaches to a write, keyed by the rule its sentence opens with. Core's
   words are printed whole above this line; what is added is the plugin verb doing what they ask, never their rule. */
const ROUTES = {
  "criteria-list-in-description": (ref) => `forge record criteria ${ref} <criteria.md>`,
};

export const clearedBy = (line, ref) => {
  const rule = Object.keys(ROUTES).find((one) => line.startsWith(`${one}:`));
  return rule ? ROUTES[rule](ref ?? "<ISS-nn>") : null;
};

export const issueRefOf = (bodies) =>
  bodies.map((body) => body?.issueId ?? body?.issue?.issueId ?? body?.data?.issueId).find(Boolean) ?? null;
