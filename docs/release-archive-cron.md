# Release archive scheduling

Friday releases are archived by Supabase Cron after their individual deadline:
Sunday 00:01 in `Europe/Berlin`.

The cron job runs every minute during Saturday 22:00–23:59 UTC. These two UTC
hours cover both CEST and CET. The database function checks the Berlin deadline
for every release, so early ticks are harmless and a delayed or missed tick is
retried by the next minute.

The operation is idempotent: only published rows with `archived_at is null`
are updated. The old GitHub Actions workflow was removed because scheduled
Actions may start late while its exact-minute guard silently skipped the work.

## Production checks

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'archive-due-friday-releases';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'archive-due-friday-releases'
)
order by start_time desc
limit 20;

select private.release_archive_due_at(date '2026-07-24');
```

For 2026-07-24, the expected deadline is
`2026-07-25 22:01:00+00`, which is Sunday 2026-07-26 00:01 CEST.
