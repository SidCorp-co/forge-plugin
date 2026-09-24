import { fail } from "../../src/resolve/settings.mjs";

/* What a gate meets when the tracker turns its token down: `fail()`, which outside the harness ends the process. */
export const run = () => fail("UNAUTHENTICATED: Forge answered 401");
