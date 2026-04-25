create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminder_enabled boolean not null default false,
  reminder_time time not null default '20:00:00'::time,
  timezone text not null default 'UTC',
  last_reminder_sent_at timestamptz null
);

alter table public.user_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'Users can view their own preferences'
  ) then
    create policy "Users can view their own preferences"
      on public.user_preferences
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'Users can insert their own preferences'
  ) then
    create policy "Users can insert their own preferences"
      on public.user_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'Users can update their own preferences'
  ) then
    create policy "Users can update their own preferences"
      on public.user_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'Users can delete their own preferences'
  ) then
    create policy "Users can delete their own preferences"
      on public.user_preferences
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
