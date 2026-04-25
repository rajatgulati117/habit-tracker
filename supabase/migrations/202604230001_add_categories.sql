create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  constraint categories_user_id_name_key unique (user_id, name)
);

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists categories_created_at_idx on public.categories (created_at);

alter table public.categories enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Users can view their own categories'
  ) then
    create policy "Users can view their own categories"
      on public.categories
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Users can insert their own categories'
  ) then
    create policy "Users can insert their own categories"
      on public.categories
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Users can update their own categories'
  ) then
    create policy "Users can update their own categories"
      on public.categories
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'Users can delete their own categories'
  ) then
    create policy "Users can delete their own categories"
      on public.categories
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;

alter table public.habits
  add column if not exists category_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habits_category_id_fkey'
  ) then
    alter table public.habits
      add constraint habits_category_id_fkey
      foreign key (category_id)
      references public.categories (id)
      on delete set null;
  end if;
end
$$;

create index if not exists habits_category_id_idx on public.habits (category_id);

create or replace function public.seed_default_categories_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, color)
  values
    (new.id, 'Health', '#22C55E'),
    (new.id, 'Learning', '#3B82F6'),
    (new.id, 'Mindfulness', '#A855F7')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.seed_default_categories_for_user();

insert into public.categories (user_id, name, color)
select
  users.id,
  defaults.name,
  defaults.color
from auth.users as users
cross join (
  values
    ('Health', '#22C55E'),
    ('Learning', '#3B82F6'),
    ('Mindfulness', '#A855F7')
) as defaults(name, color)
on conflict (user_id, name) do nothing;
