/* The tracker's own binding of the deployment platform to this project, as declared rows: the path
   names the project and nothing here names a Coolify instance or reads a file this checkout carries.
   Its own file to keep `routes.mjs` within one reading, and handed the two helpers it builds with
   rather than copying them, so there is still one `one` and one `query`. docs/cli/one-transport.md. */
import { filled } from "../answers/projections.mjs";

/* Six rows the MCP surface carries and three it does not. The deploy, cancel and the two reads are
   `forge_coolify.*` the tracker tool answers as actions; the rollback whose own listing read does
   not answer for a healthy binding is refused before it reaches here, and three more are on no
   project-scoped route at all. The env trio core's ISS-827 added is CLI-only: `forge coolify env`
   sends it over this transport, and MCP delivery being REST (MCP_DELIVERY_IS_REST names the env
   route), it is not in `TRACKER_SERVED` and so not an MCP action. The rows that act declare
   `writes`, so a transient answer is not sent again under them. */
export const coolifyRoutes = ({ one, query }) => ({
  "forge_coolify.list": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify`),
    sends: [],
  },
  "forge_coolify.targets": {
    project: true,
    requests: (args, project) =>
      one(`/projects/${project}/integrations/coolify/targets${query({ integrationId: args.integrationId })}`),
    sends: ["integrationId"],
  },
  "forge_coolify.status": {
    project: true,
    requests: (args, project) =>
      one(`/projects/${project}/integrations/coolify/status${query({ integrationId: args.integrationId })}`),
    sends: ["integrationId"],
  },
  "forge_coolify.rollback_images": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/rollback-images`
      + query({ integrationId: args.integrationId, resourceUuid: args.resourceUuid })),
    sends: ["integrationId", "resourceUuid"],
  },
  /* The body is the route's own strict object: a key it does not declare refuses the whole call at
     its end, so `filled` is what keeps an argument nobody gave out of it. */
  "forge_coolify.deploy": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/deploy`, "POST",
      filled({ issueId: args.issueId, pipelineRunId: args.pipelineRunId, integrationId: args.integrationId })),
    sends: ["issueId", "pipelineRunId", "integrationId"],
  },
  "forge_coolify.cancel": {
    project: true,
    writes: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/cancel`, "POST",
      filled({ integrationId: args.integrationId, deploymentUuid: args.deploymentUuid })),
    sends: ["integrationId", "deploymentUuid"],
  },
  /* `key` rides the path and so is declared sent though no body carries it, and `value` is the one
     field core reads off a PUT that a DELETE does not (ISS-47). */
  "forge_coolify.env_list": {
    project: true,
    requests: (args, project) => one(`/projects/${project}/integrations/coolify/env`
      + query({ integrationId: args.integrationId, resourceUuid: args.resourceUuid })),
    sends: ["integrationId", "resourceUuid"],
  },
  "forge_coolify.env_set": {
    project: true,
    writes: true,
    requests: (args, project) => one(
      `/projects/${project}/integrations/coolify/env/${encodeURIComponent(args.key)}`, "PUT",
      filled({ value: args.value, integrationId: args.integrationId, resourceUuid: args.resourceUuid,
        redeploy: args.redeploy })),
    sends: ["key", "value", "integrationId", "resourceUuid", "redeploy"],
  },
  "forge_coolify.env_delete": {
    project: true,
    writes: true,
    requests: (args, project) => one(
      `/projects/${project}/integrations/coolify/env/${encodeURIComponent(args.key)}`, "DELETE",
      filled({ integrationId: args.integrationId, resourceUuid: args.resourceUuid, redeploy: args.redeploy })),
    sends: ["key", "integrationId", "resourceUuid", "redeploy"],
  },
});
