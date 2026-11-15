# Monitor and maintenance REST API

The authenticated `/api-docs` page and `/api/swagger-json` use the same current OpenAPI contract. Requests use cookie sessions, `x-api-key`, or `Authorization: Bearer`; use one credential method. API keys authenticate only `/api/v1`. Never put a key in a URL. Examples below use caller-provided environment variables and placeholder request values.

| Principal | Read selected scope | Monitor/window write | Workspace owners/members/secrets | Platform runtime |
|---|---|---|---|---|
| viewer/session | yes | no | no | no |
| editor/session | yes | yes | no | no |
| owner/session | yes | yes | yes | no |
| read key | yes | no | no | no |
| write key | yes | yes | no | no |
| platform admin session | membership applies | membership applies | owner membership applies | yes |

Select workspace/environment with `x-workspace-id` and `x-environment-id`. A key's bound workspace and optional environment cannot be changed by headers. Maintenance is a workspace resource and session/workspace-wide keys can link monitors across its environments. An environment-bound key can only access windows whose existing and proposed monitors all belong to that environment, and cannot access windows linked to status pages. Empty associations mean no affected monitors, not the whole workspace.

Set `BASE_URL`, `API_KEY`, `WORKSPACE_ID`, and `ENVIRONMENT_ID` yourself. Exported keys are displayed only at creation and stored hashed; avoid shell tracing.

```sh
curl -sS "$BASE_URL/api/v1/monitors" \
 -H "x-api-key: $API_KEY" -H "x-workspace-id: $WORKSPACE_ID" -H "x-environment-id: $ENVIRONMENT_ID"

curl -sS -X POST "$BASE_URL/api/v1/monitors" \
 -H "x-api-key: $API_KEY" -H "x-workspace-id: $WORKSPACE_ID" -H "x-environment-id: $ENVIRONMENT_ID" \
 -H 'content-type: application/json' --data '{"name":"Health contract","type":"http","url":"https://example.invalid/health","active":false,"interval":60,"timeout":5,"assertions":{"version":1,"mode":"all","rules":[{"id":"status","source":"status","operator":"equals","expected":200}]}}'
```

Take the returned `data.id` as `MONITOR_ID`. Creation returns HTTP200 with `{ok,data}`. Request URL, headers/body and credentials are write-only. Safe responses expose configured flags; omitted secret fields on PUT preserve existing configuration, supplied values replace it, `clearSecrets:["headers"]` explicitly clears it. Replacement wins if the same field is supplied and cleared. Editors are trusted to use workspace secrets; this does not prevent them sending preserved secrets to a changed destination.

```sh
curl -sS -X POST "$BASE_URL/api/v1/monitors/$MONITOR_ID/test" \
 -H "x-api-key: $API_KEY" -H "x-workspace-id: $WORKSPACE_ID" -H "x-environment-id: $ENVIRONMENT_ID" \
 -H 'content-type: application/json' --data '{}'

# Use the same headers for each operation:
# PUT /api/v1/monitors/{id} {"name":"Renamed health contract"}
# POST /api/v1/monitors/{id}/resume
# POST /api/v1/monitors/{id}/pause
# DELETE /api/v1/monitors/{id}
```

Lists default to100/max200 and return `page.nextCursor`; pass it unchanged and URL-encoded as `cursor` with the same scope/filters. No all-monitor endpoint is implied. History defaults50/max200, ordered `(time DESC,id DESC)` with a cursor-bound upper cutoff; `from`/`to` are RFC3339 timestamps. `summary` covers the full selected environment; `state`, `lookup`, and `recent-heartbeats` accept at most200 comma-separated IDs, rejecting the whole request if any ID is outside scope.

```sh
curl -sS -X POST "$BASE_URL/api/v1/maintenances" \
 -H "x-api-key: $API_KEY" -H "x-workspace-id: $WORKSPACE_ID" -H "x-environment-id: $ENVIRONMENT_ID" \
 -H 'content-type: application/json' \
 --data '{"title":"Planned deployment","strategy":"single","active":true,"startDate":"2026-12-01T02:00:00Z","endDate":"2026-12-01T02:30:00Z","timezone":"UTC","monitorIds":[],"statusPageIds":[]}'
```

Use the returned maintenance ID with GET/PUT/DELETE `/api/v1/maintenances/{id}` and POST `/{id}/pause` or `/{id}/resume`. PUT merges supplied fields with existing configuration before validating strategy requirements. Omitted relation arrays preserve; `[]` clears; mixed foreign IDs produce404 with no partial writes. Set monitorIds to the intended IDs to make the window effective.

Strategies: manual means enabled; single requires start/end, start inclusive/end exclusive; recurring-interval requires an anchor startDate, intervalDay and `["HH:mm","HH:mm"]` timeRange; recurring-weekday adds weekdays0–6; recurring-day-of-month adds days1–31 or `lastDay1`; cron uses a validated Croner expression, IANA timezone and duration **seconds** (1800=30minutes). Cross-midnight recurrence belongs to the starting day. Unsupported strategies and invalid timezone/time input return400.

401 means missing/expired/disabled credentials;403 means insufficient role or key scope;404 hides foreign resources/associations;400 means invalid input/cursor;409 means a preview/configuration changed. Monitor and maintenance changes invalidate in-flight results. During maintenance workers record status3 without making outbound requests.

Bruno: POST `/api/v1/bruno/preview` with collectionId, files `[{path,content}]`, optional mode create/skip/replace, variables/secrets and sourceEnvironment. Scripts/tests/hooks/settings outside the supported declarative subset are blocked. POST `/import` with the exact original input plus preview digest; commit is atomic and monitors start paused. Owner-session `/export?ids=...` exports1–20 supported monitors with unresolved secret placeholders. See BRUNO_COMPATIBILITY.md.

Prometheus `/api/v1/metrics` returns fixed-dimensional scoped current-state counts and ping sums/counts. It does not scan raw history or export URLs/hostnames. `/api/metrics` is platform-admin-only. Historical uptime returns null/N/A without observations and exposes coverage; see DATA_RETENTION.md.
