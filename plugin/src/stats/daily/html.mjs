/* The one escape every page of the reports passes its text through, shared by the day's page and the
   models' reading of it so neither imports the other. */
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/gu, (one) => ESCAPES[one]);
