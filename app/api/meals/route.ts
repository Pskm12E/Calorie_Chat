import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/api';
import { mealSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  let query = auth.supabase.from('meals').select('*').order('consumed_at');
  if (date) query = query.eq('date', date);
  const { data, error } = await query;
  return NextResponse.json(error ? { error: error.message } : { meals: data }, {
    status: error ? 400 : 200,
  });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = mealSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  const { data, error } = await auth.supabase
    .from('meals')
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select()
    .single();
  return NextResponse.json(error ? { error: error.message } : { meal: data }, {
    status: error ? 400 : 201,
  });
}
