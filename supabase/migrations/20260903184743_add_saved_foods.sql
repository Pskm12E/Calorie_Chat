create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null check (char_length(food_name) between 1 and 200),
  meal_type public.meal_type not null default 'snack',
  quantity numeric(8,2) not null default 1 check (quantity > 0),
  calories integer not null check (calories between 0 and 20000),
  notes text check (notes is null or char_length(notes) <= 2000),
  times_logged integer not null default 0 check (times_logged >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index saved_foods_user_name_idx
  on public.saved_foods(user_id, lower(food_name));

create index saved_foods_user_recent_idx
  on public.saved_foods(user_id, last_used_at desc nulls last, created_at desc);

alter table public.saved_foods enable row level security;

grant select, insert, update, delete on public.saved_foods to authenticated;

create policy "saved_foods_select_own"
  on public.saved_foods for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_foods_insert_own"
  on public.saved_foods for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saved_foods_update_own"
  on public.saved_foods for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "saved_foods_delete_own"
  on public.saved_foods for delete
  to authenticated
  using ((select auth.uid()) = user_id);
