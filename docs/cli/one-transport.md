# One transport

**Rate limits.** The server states its own wait. Failing instead of honouring it turns a two-second
pause into a lost run; honouring it without a ceiling turns a server saying 3600 into an hour of sleep.

**Errors.** A schema violation returns a zod array carrying the full uuid regex per field; the path and
the message are the whole signal. `isError` is the tool's own refusal rather than a transport failure,
and must not read as a success.

**The tool surface is cached.** `tools/list` is 130 KB and every verb needs it; fetched per process it
was 75% of the traffic of `forge issue`. One fetch serves concurrent callers, because caching only what
has already arrived turned one fetch into five the moment anything ran in parallel. A miss refetches
before erroring: an absent name may be a typo or a tool the server grew since, and only one is worth an
error.

**Announcing a write is not a courtesy owed per verb**, which is how two of them were written without
it. It happens in the transport, so a verb added later cannot forget.
