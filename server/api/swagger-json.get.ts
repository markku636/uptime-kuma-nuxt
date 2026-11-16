import { buildOpenApiSpec } from '../openapi/spec'

/**
 * OpenAPI specification for the Uptime Kuma Nuxt API.
 * Generated from the catalogue in server/openapi/spec.ts.
 *
 * The server URL is the origin the request came in on, so the document can be
 * imported straight into API clients (Bruno, Postman, ...) and run as-is.
 */
export default defineEventHandler((event) => {
  return buildOpenApiSpec(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin)
})
