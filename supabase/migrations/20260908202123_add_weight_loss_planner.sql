alter table public.user_settings
  add column if not exists height_cm numeric(5,2)
    check (height_cm is null or height_cm between 100 and 250),
  add column if not exists age_years smallint
    check (age_years is null or age_years between 18 and 100),
  add column if not exists sex_for_equation text
    check (sex_for_equation is null or sex_for_equation in ('female', 'male')),
  add column if not exists activity_level text
    check (
      activity_level is null
      or activity_level in ('sedentary', 'light', 'active', 'very_active')
    ),
  add column if not exists weekly_weight_loss_kg numeric(3,2)
    check (
      weekly_weight_loss_kg is null
      or weekly_weight_loss_kg in (0.25, 0.50, 0.75)
    );

comment on column public.user_settings.sex_for_equation is
  'Sex-specific input used only by the Mifflin-St Jeor energy equation.';

comment on column public.user_settings.activity_level is
  'Physical activity level used to estimate total daily energy expenditure.';

comment on column public.user_settings.weekly_weight_loss_kg is
  'User-selected estimated weekly weight-loss pace in kilograms.';
