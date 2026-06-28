'use server';

// Account self-service: GDPR/CCPA right-to-erasure. Deleting the auth user cascades to public.profiles
// (profiles.id references auth.users on delete cascade), which in turn cascades to every profile-owned
// table (food_log, habits, habit_logs, progress_photos, coach_messages, ...). One call erases the user.
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function deleteAccountAction(): Promise<void> {
  const ctx = await requireAuth();

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(ctx.userId);
  if (error) {
    console.error('deleteAccountAction:', error.message);
    throw new Error('delete_failed');
  }

  // The session now points at a deleted user; clear the auth cookies before leaving the app.
  const sb = await createClient();
  await sb.auth.signOut();
  redirect('/?deleted=1');
}
