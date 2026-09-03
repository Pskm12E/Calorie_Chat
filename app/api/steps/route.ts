import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/api';
import { stepsSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = stepsSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  const { data, error } = await auth.supabase
    .from('step_entries')
    .upsert(
      { ...parsed.data, user_id: auth.user.id },
      { onConflict: 'user_id,date' },
    )
    .select()
    .single();
  return NextResponse.json(error ? { error: error.message } : { steps: data }, {
    status: error ? 400 : 201,
  });
}
