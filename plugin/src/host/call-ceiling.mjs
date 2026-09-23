export const CALL_CEILING_SECONDS = 600;

const CALL_MARGIN_SECONDS = 60;

export const heldMinutes = (ceiling = CALL_CEILING_SECONDS, margin = CALL_MARGIN_SECONDS) =>
  Math.max(1, Math.floor((ceiling - margin) / 60));

export const pastCeiling = (seconds) => seconds > CALL_CEILING_SECONDS;
