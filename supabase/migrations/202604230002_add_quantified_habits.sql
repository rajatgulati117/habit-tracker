alter table public.habits
  add column if not exists habit_type text not null default 'boolean',
  add column if not exists target_value numeric null,
  add column if not exists unit text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habits_habit_type_check'
  ) then
    alter table public.habits
      add constraint habits_habit_type_check
      check (habit_type in ('boolean', 'quantified'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'habits_target_value_check'
  ) then
    alter table public.habits
      add constraint habits_target_value_check
      check (
        (habit_type = 'boolean' and target_value is null)
        or (habit_type = 'quantified' and target_value is not null and target_value > 0)
      );
  end if;
end
$$;

alter table public.habit_completions
  add column if not exists value numeric null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habit_completions_value_nonnegative_check'
  ) then
    alter table public.habit_completions
      add constraint habit_completions_value_nonnegative_check
      check (value is null or value >= 0);
  end if;
end
$$;

create index if not exists habits_habit_type_idx on public.habits (habit_type);
