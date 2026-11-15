# Heartbeat history and retention

Hourly aggregation runs only in worker/all roles. Each transaction locks at most 32 monitors and seals at most 24 UTC hours per monitor, ending at least five minutes behind the database clock. The hourly record stores durations and ping sum/count; percentages are calculated from totals. Legacy observations use an estimated 120-second coverage cap. New checks snapshot their coverage cap; paused boundaries stop the preceding UP segment.

`HEARTBEAT_RETENTION_ENABLED=false` is the default. Enabling it permits deletion of at most 1,000 raw rows per batch, only after a continuous checkpoint covers the cutoff. `HEARTBEAT_RAW_HOURS=48` and `HEARTBEAT_HOURLY_DAYS=400` are defaults. One raw anchor before the cutoff remains per monitor. Late inserts into retained, sealed hours invalidate the checkpoint and rebuild those hours; inserts older than the deleted boundary fail and require an explicit restore. All writers serialize on the monitor row. Raw/hourly reads share a repeatable snapshot.

Old ranges whose exact raw edges were removed expand to UTC hour boundaries and return `precision: hourly`, `rangeStart`, and `rangeEnd`. Missing, stale and maintenance time is excluded from the UP/DOWN denominator; zero observed duration returns `uptime: null`. A valid zero-millisecond response remains a sample. Coverage identifies incomplete observations.

Owner-only history clearing returns HTTP 202 with a job ID. Poll `/api/v1/maintenance/clear-heartbeats/{id}`. Batches remove observations before the captured cutoff and hourly summaries, preserving monitor configuration, new observations, and self-contained operational state. Clearing does not reset notification delivery deduplication. TLS notification keys live until the associated monitor/channel is removed, independently of the shorter outbox retention.

Before enabling deletion: back up PostgreSQL, compare representative raw and hourly results, verify worker readiness and checkpoint progress, and size disk/WAL headroom. Turning deletion off stops future batches; it cannot restore deleted raw rows. Rollback must preserve the hourly/checkpoint tables and use a compatible reader or restore a backup. Never substitute `db push` for the migration command.

## Measured storage context

The local PostgreSQL16.14 fixture inserted 5,760,000 minimal heartbeat rows (4,000 monitors × 1,440 one-minute checks) in 92.3 seconds. Database size was 1,298,013,207 bytes; heartbeat rows 536,371,200 bytes and indexes 750,755,840 bytes. This fixture omits full assertion payloads, concurrent ingestion, WAL growth, vacuum overhead and production metadata, so it is not a complete production capacity estimate.

At that measured density, 48 hours of raw observations is roughly 2.6 GB before those additions. Hourly retention is additional: 4,000 × 24 × 400 = **38.4 million hourly rows**, with primary/scope/time indexes, WAL, backups and vacuum space to budget separately. Measure the actual hourly schema and payload on the deployment storage before selecting retention and disk limits. A 10 GiB demo PVC retaining five paused monitors is not a promise that 4,000 active monitors can retain 400 days there.
