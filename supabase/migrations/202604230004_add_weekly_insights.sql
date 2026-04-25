create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  insight_text text not null,
  generated_at timestamptz not null default now(),
  constraint weekly_insights_user_id_week_start_key unique (user_id, week_start)
);

create index if not exists weekly_insights_user_id_idx
  on public.weekly_insights (user_id);

create index if not exists weekly_insights_week_start_idx
  on public.weekly_insights (week_start desc);

alter table public.weekly_insights enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Users can view their own weekly insights'
  ) then
    create policy "Users can view their own weekly insights"
      on public.weekly_insights
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Users can insert their own weekly insights'
  ) then
    create policy "Users can insert their own weekly insights"
      on public.weekly_insights
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Users can update their own weekly insights'
  ) then
    create policy "Users can update their own weekly insights"
      on public.weekly_insights
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_insights'
      and policyname = 'Users can delete their own weekly insights'
  ) then
    create policy "Users can delete their own weekly insights"
      on public.weekly_insights
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
