// Coach view of one subscriber. Coach-guarded + company-scoped. Real Overview + Workouts.
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchHistory } from '@/lib/workout/logging';
import { SubscriberProfile, type ProfileData } from '@/components/coach/subscriber-profile';

export const dynamic = 'force-dynamic';

type Targets = { calories: number; macros: { protein_g: number; carbs_g: number; fat_g: number } };

export default async function CoachSubscriberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const ctx = await requireCoach();
  const { id } = await params;
  const locale = await getLocale();
  if (!ctx.companyId) notFound();

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, full_name, email, role, ui_locale, is_legacy_client, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!profile || profile.company_id !== ctx.companyId) notFound();

  const [{ data: onb }, { data: assignment }, history] = await Promise.all([
    supabase.from('onboarding_responses').select('computed_targets').eq('profile_id', id).maybeSingle(),
    supabase
      .from('plan_assignments')
      .select('plan:plan_id (name_en, name_es)')
      .eq('profile_id', id)
      .eq('company_id', ctx.companyId)
      .maybeSingle(),
    fetchHistory(ctx.companyId, id),
  ]);

  const targets = (onb?.computed_targets ?? null) as Targets | null;
  const plan = (assignment?.plan ?? null) as { name_en: string; name_es: string | null } | { name_en: string; name_es: string | null }[] | null;
  const planObj = Array.isArray(plan) ? plan[0] : plan;

  const fmtDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtShort = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const created = new Date(profile.created_at);
  const days = Math.max(0, Math.round((new Date().getTime() - created.getTime()) / 86400_000));

  const data: ProfileData = {
    name: (profile.full_name ?? profile.email).trim(),
    email: profile.email,
    memberSince: fmtDate.format(created),
    role: profile.role,
    locale: profile.ui_locale,
    legacy: profile.is_legacy_client,
    workouts: history.length,
    days,
    calories: targets?.calories ?? null,
    macros: targets
      ? { p: targets.macros.protein_g, c: targets.macros.carbs_g, f: targets.macros.fat_g }
      : null,
    programName: planObj ? (locale === 'es' && planObj.name_es) || planObj.name_en : null,
    history: history.map((h) => ({
      id: h.id,
      date: fmtShort.format(new Date(h.performed_at)),
      completionPct: h.completion_pct,
      enjoyment: h.enjoyment,
    })),
  };

  return <SubscriberProfile data={data} />;
}
