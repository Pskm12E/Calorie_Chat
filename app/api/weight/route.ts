import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/api';
import { weightSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = weightSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  const { data, error } = await auth.supabase
    .from('weight_entries')
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select()
    .single();
  return NextResponse.json(
    error ? { error: error.message } : { weight: data },
    { status: error ? 400 : 201 },
  );
}
