import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/api';

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const date =
    new URL(request.url).searchParams.get('date') ??
    new Date().toISOString().slice(0, 10);
  const [meals, settings, steps, weight] = await Promise.all([
    auth.supabase
      .from('meals')
      .select('*')
      .eq('date', date)
      .order('consumed_at'),
    auth.supabase.from('user_settings').select('*').maybeSingle(),
    auth.supabase
      .from('step_entries')
      .select('*')
      .eq('date', date)
      .maybeSingle(),
    auth.supabase
      .from('weight_entries')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const error = meals.error || settings.error || steps.error || weight.error;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const calories = (meals.data ?? []).reduce(
    (sum, meal) => sum + meal.calories,
    0,
  );
  const goal = settings.data?.daily_calorie_goal ?? 1900;
  return NextResponse.json({
    date,
    calories,
    goal,
    remaining: goal - calories,
    meals: meals.data,
    steps: steps.data?.steps ?? null,
    weight: weight.data ?? null,
  });
}
