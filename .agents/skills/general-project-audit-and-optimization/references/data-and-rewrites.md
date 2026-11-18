# Database decisions and cross-language rewrites

Use these routes independently. Changing a driver, database engine and implementation language at once makes a regression expensive to locate. Separate them when the contracts permit it.

## Locate the cost

Capture the actual engine and driver versions, including embedded/native engines shipped inside an application. Map data ownership, keys, transactions, concurrency, durability, peak volume and backups. Trace a slow user request through application CPU, pool wait, database execution, lock wait and network time. Compare spans from the *same requests*. Tail percentiles from unrelated distributions cannot be subtracted to locate a bottleneck. Inspect emitted SQL, round trips, cardinality and query plans on representative data. PostgreSQL's `EXPLAIN ANALYZE` executes the statement, so use a suitable disposable dataset for statements with effects. [PostgreSQL query plans](https://www.postgresql.org/docs/current/using-explain.html)

| Route | Evidence that warrants it | What to verify |
| --- | --- | --- |
| Tune the existing engine | N+1 queries, missing index, excess rows, long transactions or pool saturation | Query count, plan, write overhead, contention and end-to-end latency on the same workload |
| Change the access layer | A measured limitation in generated SQL, connection management or needed protocol support | Old and new SQL/results, cancellation, transaction boundaries, error mapping and pool behavior |
| Upgrade engine or change deployment | End of support, a confirmed fixed defect, capacity or recovery requirement | Server **and** driver/extension support, upgrade path, client compatibility and a restore rehearsal |
| Change engine | A documented concurrency, durability, access pattern or operational requirement stays unmet | Compare the incumbent and candidate on representative reads, writes, failures, migration and recovery effort |

SQLite suits embedded/local data when the write profile fits. WAL allows readers alongside a writer and permits one writer at a time. A multi-host shared filesystem changes the design. Compare PostgreSQL or MySQL for transactional services that need multiple writers or independent hosts. For analytical scans or Parquet, consider DuckDB before adding an operational service. Test existing full-text facilities or an extension such as pgvector against search quality and latency before adding a separate search or vector store. Determine the self-hosted operating cost and backup owner for each option. [SQLite use cases](https://www.sqlite.org/whentouse.html), [SQLite WAL](https://www.sqlite.org/wal.html), [DuckDB](https://duckdb.org/), [PostgreSQL support policy](https://www.postgresql.org/support/versioning/) and [pgvector](https://github.com/pgvector/pgvector)

Identify which layer an alternative replaces. A driver speaks the database protocol. A query builder constructs SQL. Code generation derives typed access from SQL or schema. An ORM maps application models and manages persistence. A library can serve more than one role.

| Ecosystem | Examples to evaluate against the incumbent |
| --- | --- |
| TypeScript | pg or postgres.js for PostgreSQL connectivity, Kysely for query building, Drizzle or Prisma when model mapping and migrations are needed. Verify dialect and version support per feature. [Kysely](https://kysely.dev/) |
| Go | Inspect `database/sql` pool behavior, pgx for PostgreSQL, sqlc for generated access or the existing ORM for model operations. Check transaction-scoped handles. [Go connection management](https://go.dev/doc/database/manage-connections), [pgx](https://github.com/jackc/pgx) and [sqlc](https://docs.sqlc.dev/en/latest/) |
| Rust | Compare SQLx with an existing Diesel or SeaORM integration. SQLx query macros require schema information from a build-time database or prepared offline metadata. Exercise CI without production credentials. [SQLx query macros](https://docs.rs/sqlx/latest/sqlx/macro.query.html) |
| Python | Compare the current DB driver, psycopg with explicit SQL, or SQLAlchemy/Django ORM. Measure emitted queries and loading behavior on the real operation. [SQLAlchemy performance FAQ](https://docs.sqlalchemy.org/en/20/faq/performance.html) |

For data migration, rehearse against a restored, sanitized copy. Check row counts, keys, constraints, nulls, precision, collations, time zones, sequences and business totals as applicable. Test writes during migration, restart a partially completed backfill, prove it is idempotent, and reconcile changes since the snapshot. Use expand/backfill/switch/contract when old and new consumers overlap. Define who owns writes at cutover, tolerated downtime/data loss, and how writes made **after** cutover will survive fallback. Delay destructive cleanup until the applicable recovery window closes. Verify the restored copy with a business operation. [PostgreSQL backup and restore](https://www.postgresql.org/docs/current/backup.html)

## Evaluate a requested rewrite

1. Name the target language, bottleneck, baseline and acceptance threshold. Compare the smallest same-stack fix, one isolated hotspot or service boundary, and a wider rewrite only when warranted. Include the cost of crossing that boundary, carrying two toolchains, operating, hiring or maintaining expertise, and exiting the new implementation.
2. Pick one slice with a real caller. Capture representative sanitized inputs and expected outputs **and effects**. Include errors, ordering, timeouts, cancellation, retries, old records and concurrent writes where supported. Establish which differences are intentional. A known incumbent bug needs an explicit expected result. Record/replay in rust-anything illustrates this approach, which can also be used for Go, TypeScript or other targets. [rust-anything](https://github.com/erkamyaman/rust-anything)
3. Run the old and candidate implementations against the same cases and workload. Compare response semantics, persisted state, side effects, latency, throughput and resources relevant to the claim. Shadow reads or suppress writes, emails, payments and other external effects during replay. Report the corpus boundary and the uncertainty outside it.
4. Recommend **continue, narrow, stop or keep current** against the agreed threshold. A wider rollout needs an observable canary, a stop trigger and a recovery path for code, data and effects that the switch cannot reverse. A successful trial closes the experiment. Production cutover follows its own authorization.
