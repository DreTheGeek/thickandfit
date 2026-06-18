import { createClient } from '@/lib/supabase/server';
import { NavLinks } from './nav-links';
import type { Role } from '@/lib/auth/session';

export async function AppNav(): Promise<React.ReactElement | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role: Role = (profile?.role as Role) ?? 'subscriber';
  return <NavLinks role={role} />;
}
