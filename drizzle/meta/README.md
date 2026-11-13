# drizzle/meta

## Hand-written migration 0009 (2026-11-13)

`0009_conversion_events.sql` was written by hand and committed with its journal entry,
but **no `0009_snapshot.json` was generated** (the authoring environment could not run
drizzle-kit). `bun run db:migrate` does not read snapshots, so deploys are unaffected.

Before the next `bunx drizzle-kit generate`, recover the snapshot or the generator will
produce a duplicate migration creating `conversion_events` (which already exists):

1. Run `bunx drizzle-kit generate --name conversion_events`. It creates a new
   migration (e.g. `0010_*`) plus a snapshot whose `prevId` points at `0008`.
2. Delete the generated `0010_*.sql` file and its journal entry (keep the hand-written
   `0009` SQL and journal entry as the source of truth).
3. Rename the generated snapshot to `0009_snapshot.json`.

After that, `db:generate` diffs against the real schema again.
