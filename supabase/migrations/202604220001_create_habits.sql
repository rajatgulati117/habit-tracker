create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  archived boolean not null default false,
  constraint habits_id_user_id_key unique (id, user_id)
);

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  constraint habit_completions_habit_id_completed_on_key unique (habit_id, completed_on),
  constraint habit_completions_habit_id_user_id_fkey
    foreign key (habit_id, user_id)
    references public.habits (id, user_id)
    on delete cascade
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habits_archived_idx on public.habits (archived);
create index if not exists habit_completions_user_id_idx on public.habit_completions (user_id);
create index if not exists habit_completions_habit_id_idx on public.habit_completions (habit_id);
create index if not exists habit_completions_completed_on_idx on public.habit_completions (completed_on);

alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

create policy "Users can view their own habits"
  on public.habits
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habits"
  on public.habits
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on public.habits
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on public.habits
  for delete
  using (auth.uid() = user_id);

create policy "Users can view their own habit completions"
  on public.habit_completions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habit completions"
  on public.habit_completions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habit completions"
  on public.habit_completions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own habit completions"
  on public.habit_completions
  for delete
  using (auth.uid() = user_id);
