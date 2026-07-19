-- Stage every published issue until Wednesday 00:00 Europe/Berlin,
-- based on its own release date rather than on the upload time.
create or replace function public.set_release_visible_from()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'published'
       or old.release_date is distinct from new.release_date
     ) then
    new.visible_from := (new.release_date::timestamp - interval '2 days')
      at time zone 'Europe/Berlin';
  end if;

  return new;
end;
$$;

-- Bring any already staged current or future issues onto the same rule.
update public.releases
set visible_from = (release_date::timestamp - interval '2 days')
  at time zone 'Europe/Berlin'
where status = 'published'
  and release_date >= (now() at time zone 'Europe/Berlin')::date;
