alter table public.habits
  add column if not exists frequency_type text not null default 'daily',
  add column if not exists frequency_value integer null,
  add column if not exists frequency_days integer[] null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habits_frequency_type_check'
  ) then
    alter table public.habits
      add constraint habits_frequency_type_check
      check (frequency_type in ('daily', 'weekly_count', 'specific_days'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'habits_frequency_config_check'
  ) then
    alter table public.habits
      add constraint habits_frequency_config_check
      check (
        (
          frequency_type = 'daily'
          and frequency_value is null
          and frequency_days is null
        ) or (
          frequency_type = 'weekly_count'
          and frequency_value between 1 and 7
          and frequency_days is null
        ) or (
          frequency_type = 'specific_days'
          and frequency_value is null
          and frequency_days is not null
          and cardinality(frequency_days) between 1 and 7
          and frequency_days <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
        )
      );
  end if;
end
$$;

create index if not exists habits_frequency_type_idx
  on public.habits (frequency_type);
