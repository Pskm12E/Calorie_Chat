import { NextResponse } from 'next/server';
import { authenticatedClient } from '@/lib/supabase/api';
import { mealSchema } from '@/lib/validation';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = mealSchema.partial().safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  const { id } = await context.params;
  const { data, error } = await auth.supabase
    .from('meals')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return NextResponse.json(error ? { error: error.message } : { meal: data }, {
    status: error ? 400 : 200,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient(request);
  if ('error' in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const { error } = await auth.supabase.from('meals').delete().eq('id', id);
  return NextResponse.json(error ? { error: error.message } : { ok: true }, {
    status: error ? 400 : 200,
  });
}
