-- Preserve all already-past Friday issues when the automatic archive status is introduced.
update public.releases
set archived_at = now()
where status = 'published'
  and archived_at is null
  and release_date < (now() at time zone 'Europe/Berlin')::date;
