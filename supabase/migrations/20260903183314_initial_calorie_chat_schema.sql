create extension if not exists pgcrypto;

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack', 'drink');
create type public.meal_confidence as enum ('high', 'medium_high', 'medium', 'low');
create type public.entry_source as enum ('chatgpt_photo', 'chatgpt_text', 'manual', 'nutrition_label', 'saved_food');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_calorie_goal integer not null default 1900 check (daily_calorie_goal between 500 and 10000),
  timezone text not null default 'Asia/Singapore',
  target_weight numeric(5,2) check (target_weight is null or target_weight between 20 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_date date not null,
  calorie_goal integer not null check (calorie_goal between 500 and 10000),
  created_at timestamptz not null default now(),
  unique(user_id, effective_date)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  consumed_at timestamptz not null default now(),
  meal_type public.meal_type not null,
  food_name text not null check (char_length(food_name) between 1 and 200),
  quantity numeric(8,2) not null default 1 check (quantity > 0),
  calories integer not null check (calories between 0 and 20000),
  calorie_low integer check (calorie_low is null or calorie_low between 0 and 20000),
  calorie_high integer check (calorie_high is null or calorie_high between 0 and 20000),
  confidence public.meal_confidence not null default 'medium',
  notes text check (notes is null or char_length(notes) <= 2000),
  source public.entry_source not null default 'manual',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (calorie_low is null or calorie_high is null or calorie_low <= calorie_high),
  unique(user_id, idempotency_key)
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 500),
  recorded_at timestamptz not null default now()
);

create table public.step_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  steps integer not null check (steps between 0 and 200000),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create index meals_user_date_idx on public.meals(user_id, date, consumed_at);
create index weight_entries_user_recorded_idx on public.weight_entries(user_id, recorded_at desc);
create index daily_goals_user_date_idx on public.daily_goals(user_id, effective_date desc);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.daily_goals enable row level security;
alter table public.meals enable row level security;
alter table public.weight_entries enable row level security;
alter table public.step_entries enable row level security;

grant select, insert, update, delete on public.profiles, public.user_settings, public.daily_goals, public.meals, public.weight_entries, public.step_entries to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "settings_select_own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert_own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings_delete_own" on public.user_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "goals_select_own" on public.daily_goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.daily_goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.daily_goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on public.daily_goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy "meals_select_own" on public.meals for select to authenticated using ((select auth.uid()) = user_id);
create policy "meals_insert_own" on public.meals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "meals_update_own" on public.meals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meals_delete_own" on public.meals for delete to authenticated using ((select auth.uid()) = user_id);

create policy "weights_select_own" on public.weight_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "weights_insert_own" on public.weight_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weights_update_own" on public.weight_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weights_delete_own" on public.weight_entries for delete to authenticated using ((select auth.uid()) = user_id);

create policy "steps_select_own" on public.step_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "steps_insert_own" on public.step_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "steps_update_own" on public.step_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "steps_delete_own" on public.step_entries for delete to authenticated using ((select auth.uid()) = user_id);
