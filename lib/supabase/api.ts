import { createClient } from '@supabase/supabase-js';

export async function authenticatedClient(request: Request) {
  const token = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Unauthorized', status: 401 } as const;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user)
    return { error: 'Unauthorized', status: 401 } as const;
  return { supabase, user: data.user } as const;
}
