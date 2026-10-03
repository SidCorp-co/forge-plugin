/* One run, one lease holder: a wave's agents inherit the dispatching session's id, so the lease refuses nothing between
   two of them (ISS-445). Both records sit in the worktree's git directory, not the config directory a wave would race, and
   both are minted beside their readers in the plugin, since a dispatch's brief mints them too (ISS-467, ISS-1682, ISS-2524). */
export { RUN_ID_VAR, SCRATCH, mintRunId, runIdAt, scratchAt, scratchMinted } from "../../../plugin/src/resolve/session/run-id.mjs";
