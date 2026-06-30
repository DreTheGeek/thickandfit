'use server';

// Coach notes: free-text notes a coach records on a subscriber (profile) or CRM client (contact).
// Coach-guarded + company-scoped via the service client (RLS is the backstop). Soft-delete supported.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export type NoteSubject = 'profile' | 'contact';
export type CoachNote = { id: string; body: string; authorName: string; createdAt: string };
export type NoteResult = { ok: boolean; error?: string };

const AddInput = z.object({
  subjectType: z.enum(['profile', 'contact']),
  subjectId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

function subjectPath(subjectType: NoteSubject, subjectId: string): string {
  return subjectType === 'profile' ? `/coach/subscribers/${subjectId}` : `/coach/clients/${subjectId}`;
}

export async function addCoachNoteAction(input: unknown): Promise<NoteResult> {
  const parsed = AddInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const svc = createServiceClient();
  const { error } = await svc.from('coach_notes').insert({
    company_id: ctx.companyId,
    subject_type: parsed.data.subjectType,
    subject_id: parsed.data.subjectId,
    author_id: ctx.userId,
    body: parsed.data.body,
  });
  if (error) {
    console.error('addCoachNoteAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath(subjectPath(parsed.data.subjectType, parsed.data.subjectId));
  return { ok: true };
}

export async function deleteCoachNoteAction(noteId: string, subjectType: NoteSubject, subjectId: string): Promise<NoteResult> {
  if (!z.string().uuid().safeParse(noteId).success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const svc = createServiceClient();
  const { error } = await svc
    .from('coach_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('deleteCoachNoteAction:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath(subjectPath(subjectType, subjectId));
  return { ok: true };
}

type NoteRow = {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

/** Notes for one subject, newest first. Coach-guarded + company-scoped. */
export async function getCoachNotes(subjectType: NoteSubject, subjectId: string): Promise<CoachNote[]> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return [];

  const svc = createServiceClient();
  const { data } = await svc
    .from('coach_notes')
    .select('id, body, created_at, author:author_id ( full_name, email )')
    .eq('company_id', ctx.companyId)
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return ((data ?? []) as NoteRow[]).map((n) => {
    const a = Array.isArray(n.author) ? n.author[0] : n.author;
    return {
      id: n.id,
      body: n.body,
      authorName: (a?.full_name ?? a?.email ?? 'Coach').trim() || 'Coach',
      createdAt: n.created_at,
    };
  });
}
