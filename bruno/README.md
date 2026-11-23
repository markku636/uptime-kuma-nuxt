# Bruno collection

This folder is a ready-to-use [Bruno](https://www.usebruno.com/) collection for the
Uptime Kuma Nuxt API.

## Environments

| Environment | `baseUrl` | Use |
| --- | --- | --- |
| `Local` | `http://localhost:32400` | Full smoke + CRUD |
| `Production` | `https://uptime.226network.com` | Read-only `smoke` requests only |

`Production` intentionally leaves `password` and `apiKey` secrets empty. Fill them
locally (Bruno keeps secrets outside version control) if you need authenticated
requests.

## Global API key

Generate or rotate `gk_...` in **Settings → Security → Global API key**. Paste it
into the `apiKey` secret of the selected environment. The collection pre-request
script sends it as `x-api-key` only to `/api/v1/*`; Auth, Settings and API-key
management endpoints still require the session cookie from **Auth / Login**.

## Run

```bash
# read-only smoke against production
bru run --env Production --tags smoke

# full local run (create/delete requests mutate local data)
bru run --env Local
```

## In-app Bruno monitors

The application's Bruno monitor type stores one declarative `.bru` request per
monitor and executes it with a bounded HTTP transport. Scripts and tests are
ignored by the parser, so keep monitor requests self-contained and use the
`assert { ... }` block for status/JSON/text assertions. Monitor requests can use
`{{variable}}` placeholders resolved from the workspace environment variables in
**Settings → Workspaces → Environment variables**.
